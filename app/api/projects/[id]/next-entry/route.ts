import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { lockEntry, isEntryLocked, unlockEntry } from '@/lib/redis';

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

    // Find next available entry
    const entries = await prisma.medicineEntry.findMany({
      where: whereClause,
      orderBy: { createdAt: 'asc' },
      take: 50, // Check first 50 to find unlocked one
    });

    console.log(`Found ${entries.length} ${statusFilter} entries for project ${id}`);

    if (entries.length === 0) {
      return NextResponse.json({ entry: null, message: `No more ${statusFilter.toLowerCase()} entries` });
    }

    // For SKIPPED, FAILED, ARCHIVED - clear any old locks since they're being reworked
    if (['SKIPPED', 'FAILED', 'ARCHIVED'].includes(statusFilter)) {
      console.log(`Clearing old locks for ${statusFilter} entries`);
      for (const entry of entries) {
        await unlockEntry(entry.id);
      }
    }

    // Find first entry that's not locked (or just take first one for non-PENDING)
    let selectedEntry = null;
    let lockedCount = 0;
    
    for (const entry of entries) {
      // For non-PENDING statuses, we already cleared locks, so just take the first one
      if (['SKIPPED', 'FAILED', 'ARCHIVED'].includes(statusFilter)) {
        selectedEntry = entry;
        // Acquire new lock
        await lockEntry(entry.id, user.userId, 600);
        console.log(`Lock acquired for ${statusFilter} entry ${entry.id} by user ${user.userId}`);
        break;
      }
      
      // For PENDING and ALL, check locks normally
      const isLocked = await isEntryLocked(entry.id);
      if (isLocked) {
        lockedCount++;
        console.log(`Entry ${entry.id} is locked`);
        continue;
      }
      
      // Try to acquire lock (10 minute TTL)
      const lockAcquired = await lockEntry(entry.id, user.userId, 600);
      if (lockAcquired) {
        selectedEntry = entry;
        console.log(`Lock acquired for entry ${entry.id} by user ${user.userId}`);
        break;
      }
    }

    console.log(`Checked ${entries.length} entries, ${lockedCount} were locked`);

    if (!selectedEntry) {
      return NextResponse.json({ 
        entry: null, 
        message: `All ${entries.length} ${statusFilter.toLowerCase()} entries are currently locked by other users. Please try again in a moment.` 
      });
    }

    // Update status to IN_PROGRESS (for tracking, but Redis lock is the source of truth)
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
