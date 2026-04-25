import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { lockEntry, isEntryLocked, unlockEntry, redis } from '@/lib/redis';
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
      // For ALL, get entries that are not COMPLETED or ARCHIVED
      whereClause.status = {
        in: ['PENDING', 'SKIPPED', 'FAILED'],
      };
    } else {
      // For specific status
      whereClause.status = statusFilter;
    }

    // Find next available entry - only select needed fields for performance
    const entries = await prisma.medicineEntry.findMany({
      where: whereClause,
      orderBy: { createdAt: 'asc' },
      take: 20, // Reduced from 50 for faster query
      select: {
        id: true,
        medicineName: true,
        originalImageUrl: true,
        status: true,
        createdAt: true,
        projectId: true,
      },
    });

    if (entries.length === 0) {
      return NextResponse.json({ entry: null, message: `No more ${statusFilter.toLowerCase()} entries` });
    }

    // For SKIPPED, FAILED, ARCHIVED - clear any old locks since they're being reworked
    if (['SKIPPED', 'FAILED', 'ARCHIVED'].includes(statusFilter)) {
      // Clear locks in parallel for speed
      await Promise.all(entries.map(entry => unlockEntry(entry.id)));
    }

    // Find first entry that's not locked
    let selectedEntry = null;
    
    for (const entry of entries) {
      // For non-PENDING statuses, we already cleared locks, so just take the first one
      if (['SKIPPED', 'FAILED', 'ARCHIVED'].includes(statusFilter)) {
        selectedEntry = entry;
        await lockEntry(entry.id, user.userId, 600);
        break;
      }
      
      // For PENDING and ALL, check locks normally
      const isLocked = await isEntryLocked(entry.id);
      if (isLocked) {
        continue;
      }
      
      // Try to acquire lock (10 minute TTL)
      const lockAcquired = await lockEntry(entry.id, user.userId, 600);
      if (lockAcquired) {
        selectedEntry = entry;
        break;
      }
    }

    if (!selectedEntry) {
      return NextResponse.json({ 
        entry: null, 
        message: `All ${statusFilter.toLowerCase()} entries are currently locked. Please try again.` 
      });
    }

    // Update status to IN_PROGRESS
    const updatedEntry = await prisma.medicineEntry.update({
      where: { id: selectedEntry.id },
      data: {
        status: 'IN_PROGRESS',
        assignedTo: user.userId,
        updatedAt: new Date(),
      },
    });

    // Prefetch next 3-4 entries in background (don't await)
    prefetchNextEntries(id, statusFilter, selectedEntry.id).catch(() => {});

    return NextResponse.json({ entry: updatedEntry });
  } catch (error) {
    console.error('Error fetching next entry:', error);
    return NextResponse.json({ error: 'Failed to fetch entry' }, { status: 500 });
  }
}

// Background prefetch function
async function prefetchNextEntries(projectId: string, statusFilter: string, currentEntryId: string) {
  try {
    // Build where clause based on status filter
    let whereClause: any = {
      projectId: projectId,
      id: { not: currentEntryId }, // Exclude current entry
    };

    if (statusFilter === 'ALL') {
      whereClause.status = {
        in: ['PENDING', 'SKIPPED', 'FAILED'],
      };
    } else {
      whereClause.status = statusFilter;
    }

    // Get next 3-4 entries to prefetch
    const entries = await prisma.medicineEntry.findMany({
      where: whereClause,
      orderBy: { createdAt: 'asc' },
      take: 4,
      select: {
        medicineName: true,
      },
    });

    if (entries.length === 0) {
      return;
    }

    console.log(`Started prefetching images for ${entries.length} upcoming entries`);

    // Check cache and prefetch only if not cached
    for (const entry of entries) {
      const query = `${entry.medicineName} buy in India`;
      const cacheKey = `images:${query}:0`;

      try {
        // Check if already in cache
        const cached = await redis.get(cacheKey);
        if (cached) {
          console.log(`✓ Already cached: ${entry.medicineName}`);
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
        }
      } catch (error: any) {
        console.error(`✗ Prefetch failed for ${entry.medicineName}:`, error.message);
      }
    }
  } catch (error) {
    console.error('Prefetch background task error:', error);
  }
}
