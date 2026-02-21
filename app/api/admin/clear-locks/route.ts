import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { redis } from '@/lib/redis';

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { projectId } = await request.json();

    // Get all lock keys
    const keys = await redis.keys('lock:entry:*');
    
    if (keys.length > 0) {
      await redis.del(...keys);
    }

    return NextResponse.json({ 
      success: true, 
      message: `Cleared ${keys.length} locks` 
    });
  } catch (error) {
    console.error('Error clearing locks:', error);
    return NextResponse.json({ error: 'Failed to clear locks' }, { status: 500 });
  }
}
