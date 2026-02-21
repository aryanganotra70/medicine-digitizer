import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { lockEntry, isEntryLocked } from '@/lib/redis';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    // Find next available entry that is:
    // 1. PENDING status
    // 2. Not locked in Redis
    const pendingEntries = await prisma.medicineEntry.findMany({
      where: {
        projectId: id,
        status: 'PENDING',
      },
      orderBy: { createdAt: 'asc' },
      take: 50, // Check first 50 to find unlocked one
    });

    console.log(`Found ${pendingEntries.length} PENDING entries for project ${id}`);

    if (pendingEntries.length === 0) {
      return NextResponse.json({ entry: null, message: 'No more entries' });
    }

    // Find first entry that's not locked
    let selectedEntry = null;
    let lockedCount = 0;
    
    for (const entry of pendingEntries) {
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

    console.log(`Checked ${pendingEntries.length} entries, ${lockedCount} were locked`);

    if (!selectedEntry) {
      return NextResponse.json({ 
        entry: null, 
        message: `All ${pendingEntries.length} pending entries are currently locked by other users. Please try again in a moment.` 
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
