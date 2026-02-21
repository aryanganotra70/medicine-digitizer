import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const user = await verifyAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get total completed by this user
    const completed = await prisma.medicineEntry.count({
      where: {
        digitizedBy: user.id,
        status: 'COMPLETED',
      },
    });

    // Get total skipped by this user
    const skipped = await prisma.medicineEntry.count({
      where: {
        digitizedBy: user.id,
        status: 'SKIPPED',
      },
    });

    return NextResponse.json({
      completed,
      skipped,
      total: completed + skipped,
    });
  } catch (error) {
    console.error('Failed to fetch user stats:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
