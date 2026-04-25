import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { redis } from '@/lib/redis';
import axios from 'axios';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get('status') || 'PENDING';

  try {
    // Build where clause based on status filter
    let whereClause: any = {
      projectId: id,
    };

    if (statusFilter === 'ALL') {
      whereClause.status = {
        in: ['PENDING', 'SKIPPED', 'FAILED'],
      };
    } else {
      whereClause.status = statusFilter;
    }

    // Get next 5 entries to prefetch (skip first one as it's current)
    const entries = await prisma.medicineEntry.findMany({
      where: whereClause,
      orderBy: { createdAt: 'asc' },
      skip: 1,
      take: 5,
      select: {
        medicineName: true,
      },
    });

    if (entries.length === 0) {
      return NextResponse.json({ prefetched: 0, cached: 0 });
    }

    let cachedCount = 0;
    let prefetchedCount = 0;

    // Check cache and prefetch only if not cached
    for (const entry of entries) {
      const query = `${entry.medicineName} buy in India`;
      const cacheKey = `images:${query}:0`;

      try {
        // Check if already in cache
        const cached = await redis.get(cacheKey);
        if (cached) {
          console.log(`✓ Already cached: ${entry.medicineName}`);
          cachedCount++;
          continue;
        }

        // Not in cache - fetch from DataForSEO
        console.log(`⟳ Prefetching: ${entry.medicineName}`);
        
        const dataForSeoLogin = process.env.DATAFORSEO_LOGIN;
        const dataForSeoPassword = process.env.DATAFORSEO_PASSWORD;

        if (!dataForSeoLogin || !dataForSeoPassword) {
          console.log(`⚠ DataForSEO credentials not configured`);
          continue;
        }

        const auth = Buffer.from(`${dataForSeoLogin}:${dataForSeoPassword}`).toString('base64');
        
        const postData = [{
          keyword: query,
          location_code: 2356, // India
          language_code: 'en',
          device: 'desktop',
          os: 'windows',
          depth: 100,
        }];

        const response = await axios.post(
          'https://api.dataforseo.com/v3/serp/google/images/live/advanced',
          postData,
          {
            headers: {
              'Authorization': `Basic ${auth}`,
              'Content-Type': 'application/json',
            },
            timeout: 15000,
          }
        );

        if (response.data.tasks && response.data.tasks[0]?.result) {
          const items = response.data.tasks[0].result[0]?.items || [];
          const paginatedItems = items.slice(0, 30);
          
          const images = paginatedItems
            .filter((item: any) => item.type === 'images_search')
            .map((item: any) => ({
              url: item.source_url || item.encoded_url,
              thumbnail: item.thumbnail || item.source_url,
              title: item.title || query,
            }));

          const result = {
            images,
            hasMore: items.length > 30,
            nextStart: 30,
          };

          // Cache the result for 24 hours
          await redis.setex(cacheKey, 86400, JSON.stringify(result));
          
          console.log(`✓ Prefetched & cached: ${entry.medicineName} (${images.length} images)`);
          prefetchedCount++;
        }
      } catch (error: any) {
        console.error(`✗ Prefetch failed for ${entry.medicineName}:`, error.message);
      }
    }

    console.log(`Prefetch complete: ${prefetchedCount} fetched, ${cachedCount} already cached`);

    return NextResponse.json({ 
      prefetched: prefetchedCount, 
      cached: cachedCount,
      total: entries.length 
    });
  } catch (error) {
    console.error('Prefetch error:', error);
    return NextResponse.json({ error: 'Prefetch failed' }, { status: 500 });
  }
}
