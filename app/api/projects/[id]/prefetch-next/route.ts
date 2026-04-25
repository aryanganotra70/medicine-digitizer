import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import axios from 'axios';

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

    // Get next 3 entries to prefetch
    const entries = await prisma.medicineEntry.findMany({
      where: whereClause,
      orderBy: { createdAt: 'asc' },
      take: 3,
      select: {
        medicineName: true,
      },
    });

    if (entries.length === 0) {
      return NextResponse.json({ prefetched: 0 });
    }

    // Prefetch images for next entries in background (don't await)
    entries.forEach((entry) => {
      const query = `${entry.medicineName} buy in India`;
      // Fire and forget - just trigger the cache
      fetch(`${request.nextUrl.origin}/api/google-images?q=${encodeURIComponent(query)}&start=0`)
        .catch(() => {}); // Ignore errors
    });

    console.log(`Prefetching images for ${entries.length} upcoming entries`);

    return NextResponse.json({ prefetched: entries.length });
  } catch (error) {
    console.error('Prefetch error:', error);
    return NextResponse.json({ error: 'Prefetch failed' }, { status: 500 });
  }
}
