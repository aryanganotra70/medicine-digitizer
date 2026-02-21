import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = params.id;

    // Get top 5 contributors for this project
    const leaderboard = await prisma.medicineEntry.groupBy({
      by: ['digitizedBy'],
      where: {
        projectId,
        digitizedBy: { not: null },
        status: 'COMPLETED',
      },
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
      take: 5,
    });

    // Get user details for each contributor
    const leaderboardWithUsers = await Promise.all(
      leaderboard.map(async (entry) => {
        const user = await prisma.user.findUnique({
          where: { id: entry.digitizedBy! },
          select: { username: true },
        });
        return {
          username: user?.username || 'Unknown',
          count: entry._count.id,
        };
      })
    );

    return NextResponse.json({ leaderboard: leaderboardWithUsers });
  } catch (error) {
    console.error('Failed to fetch leaderboard:', error);
    return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
  }
}
