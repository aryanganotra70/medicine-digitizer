import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { projectId } = await request.json();

    // Reset all IN_PROGRESS entries back to PENDING
    const result = await prisma.medicineEntry.updateMany({
      where: {
        ...(projectId ? { projectId } : {}),
        status: 'IN_PROGRESS',
      },
      data: {
        status: 'PENDING',
        assignedTo: null,
      },
    });

    return NextResponse.json({ 
      success: true, 
      message: `Reset ${result.count} entries from IN_PROGRESS to PENDING` 
    });
  } catch (error) {
    console.error('Error resetting entries:', error);
    return NextResponse.json({ error: 'Failed to reset entries' }, { status: 500 });
  }
}
