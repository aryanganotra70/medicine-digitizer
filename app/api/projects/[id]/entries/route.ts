import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const searchParams = request.nextUrl.searchParams;
  const cursor = searchParams.get('cursor');
  const limit = parseInt(searchParams.get('limit') || '50');
  const search = searchParams.get('search');
  const status = searchParams.get('status');

  const where: any = { projectId: id };
  
  if (search) {
    where.medicineName = { contains: search, mode: 'insensitive' };
  }
  
  if (status && status !== 'ALL') {
    where.status = status;
  }

  const entries = await prisma.medicineEntry.findMany({
    where,
    take: limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    orderBy: { createdAt: 'asc' },
    include: {
      user: {
        select: {
          username: true,
        },
      },
    },
  });

  const hasMore = entries.length > limit;
  const items = hasMore ? entries.slice(0, -1) : entries;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return NextResponse.json({ entries: items, nextCursor, hasMore });
}
