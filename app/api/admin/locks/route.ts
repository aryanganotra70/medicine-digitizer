import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { redis } from '@/lib/redis';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get all lock keys
    const keys = await redis.keys('lock:entry:*');
    
    const locks = await Promise.all(
      keys.map(async (key) => {
        const userId = await redis.get(key);
        const ttl = await redis.ttl(key);
        const entryId = key.replace('lock:entry:', '');
        
        return {
          entryId,
          userId,
          ttl,
          expiresIn: `${Math.floor(ttl / 60)}m ${ttl % 60}s`,
        };
      })
    );

    return NextResponse.json({ locks, total: locks.length });
  } catch (error) {
    console.error('Error fetching locks:', error);
    return NextResponse.json({ error: 'Failed to fetch locks' }, { status: 500 });
  }
}
