import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = params.id;
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status') || 'PENDING';

    // Build where clause based on status filter
    let whereClause: any = {
      projectId,
    };

    if (statusFilter === 'ALL') {
      whereClause.status = {
        in: ['PENDING', 'SKIPPED', 'FAILED'],
      };
    } else {
      whereClause.status = statusFilter;
    }

    const count = await prisma.medicineEntry.count({
      where: whereClause,
    });

    return NextResponse.json({ count });
  } catch (error) {
    console.error('Failed to fetch remaining count:', error);
    return NextResponse.json({ error: 'Failed to fetch count' }, { status: 500 });
  }
}
