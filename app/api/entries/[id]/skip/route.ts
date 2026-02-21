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

  // Release Redis lock
  await unlockEntry(id);

  // Update database status
  await prisma.medicineEntry.update({
    where: { id },
    data: {
      status: 'SKIPPED',
      digitizedBy: user.userId,
      assignedTo: null,
    },
  });

  return NextResponse.json({ success: true });
}
