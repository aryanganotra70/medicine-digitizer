import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { unlockEntry } from '@/lib/redis';

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
    // Update entry status to ARCHIVED
    await prisma.medicineEntry.update({
      where: { id },
      data: {
        status: 'ARCHIVED',
        digitizedBy: user.userId,
        updatedAt: new Date(),
      },
    });

    // Release the Redis lock
    await unlockEntry(id);

    return NextResponse.json({ success: true, message: 'Entry archived' });
  } catch (error) {
    console.error('Failed to archive entry:', error);
    return NextResponse.json({ error: 'Failed to archive entry' }, { status: 500 });
  }
}
