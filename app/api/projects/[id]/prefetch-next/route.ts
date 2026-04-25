import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

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

    // Get next 3 entries to prefetch (skip first one as it's current)
    const entries = await prisma.medicineEntry.findMany({
      where: whereClause,
      orderBy: { createdAt: 'asc' },
      skip: 1, // Skip the current entry
      take: 3,
      select: {
        medicineName: true,
      },
    });

    if (entries.length === 0) {
      return NextResponse.json({ prefetched: 0 });
    }

    // Prefetch images for next entries in background
    const baseUrl = request.nextUrl.origin;
    const prefetchPromises = entries.map(async (entry) => {
      const query = `${entry.medicineName} buy in India`;
      try {
        // Use absolute URL for server-side fetch
        const response = await fetch(`${baseUrl}/api/google-images?q=${encodeURIComponent(query)}&start=0`, {
          method: 'GET',
          headers: {
            'Cookie': request.headers.get('cookie') || '', // Pass auth cookies
          },
        });
        console.log(`Prefetched: ${entry.medicineName} - Status: ${response.status}`);
      } catch (error) {
        console.error(`Prefetch failed for ${entry.medicineName}:`, error);
      }
    });

    // Don't await - let them run in background
    Promise.all(prefetchPromises).catch(() => {});

    console.log(`Started prefetching images for ${entries.length} upcoming entries`);

    return NextResponse.json({ prefetched: entries.length });
  } catch (error) {
    console.error('Prefetch error:', error);
    return NextResponse.json({ error: 'Prefetch failed' }, { status: 500 });
  }
}
