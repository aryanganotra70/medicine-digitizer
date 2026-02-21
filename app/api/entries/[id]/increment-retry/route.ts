import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

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
    const entry = await prisma.medicineEntry.findUnique({
      where: { id },
    });

    if (!entry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }

    if (entry.retryCount >= 3) {
      return NextResponse.json({ 
        error: 'Maximum retry attempts (3) reached' 
      }, { status: 400 });
    }

    // Increment retry count
    await prisma.medicineEntry.update({
      where: { id },
      data: {
        retryCount: entry.retryCount + 1,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error incrementing retry count:', error);
    return NextResponse.json({ error: 'Failed to increment retry count' }, { status: 500 });
  }
}
