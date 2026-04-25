import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { lockEntry, isEntryLocked, unlockEntry } from '@/lib/redis';

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

    return NextResponse.json({ entry: updatedEntry });
  } catch (error) {
    console.error('Error fetching next entry:', error);
    return NextResponse.json({ error: 'Failed to fetch entry' }, { status: 500 });
  }
}
