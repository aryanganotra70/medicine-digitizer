import Redis from 'ioredis';

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

export const redis = globalForRedis.redis ?? new Redis({
  host: process.env.REDIS_HOST || 'redis',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis;

// Lock an entry for a user with TTL (default 10 minutes)
export async function lockEntry(entryId: string, userId: string, ttlSeconds: number = 600): Promise<boolean> {
  const lockKey = `lock:entry:${entryId}`;
  const result = await redis.set(lockKey, userId, 'EX', ttlSeconds, 'NX');
  return result === 'OK';
}

// Release lock on an entry
export async function unlockEntry(entryId: string): Promise<void> {
  const lockKey = `lock:entry:${entryId}`;
  await redis.del(lockKey);
}

// Check if entry is locked
export async function isEntryLocked(entryId: string): Promise<boolean> {
  const lockKey = `lock:entry:${entryId}`;
  const exists = await redis.exists(lockKey);
  return exists === 1;
}

// Get who locked the entry
export async function getEntryLock(entryId: string): Promise<string | null> {
  const lockKey = `lock:entry:${entryId}`;
  return await redis.get(lockKey);
}

// Extend lock TTL (when user is still working)
export async function extendLock(entryId: string, userId: string, ttlSeconds: number = 600): Promise<boolean> {
  const lockKey = `lock:entry:${entryId}`;
  const currentLock = await redis.get(lockKey);
  
  if (currentLock === userId) {
    await redis.expire(lockKey, ttlSeconds);
    return true;
  }
  
  return false;
}
