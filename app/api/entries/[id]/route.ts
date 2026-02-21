import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { lockEntry } from '@/lib/redis';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    // Get specific entry and lock it
    const entry = await prisma.medicineEntry.findUnique({
      where: { id },
    });

    if (!entry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }

    // Try to acquire lock (10 minute TTL)
    const lockAcquired = await lockEntry(entry.id, user.userId, 600);
    
    if (!lockAcquired) {
      return NextResponse.json({ 
        error: 'Entry is currently locked by another user' 
      }, { status: 409 });
    }

    // Update status to IN_PROGRESS
    const updatedEntry = await prisma.medicineEntry.update({
      where: { id },
      data: {
        status: 'IN_PROGRESS',
        assignedTo: user.userId,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ entry: updatedEntry });
  } catch (error) {
    console.error('Error fetching entry:', error);
    return NextResponse.json({ error: 'Failed to fetch entry' }, { status: 500 });
  }
}
