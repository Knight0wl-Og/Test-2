import Redis from 'ioredis';
import { config } from '../config';

let redisClient: Redis | null = null;

function getRedis(): Redis | null {
  if (!redisClient) {
    try {
      redisClient = new Redis(config.redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null, // don't retry — Redis is optional
        enableOfflineQueue: false,
      });

      redisClient.on('error', (err) => {
        // Suppress connection errors when Redis is unavailable
        if (process.env.NODE_ENV !== 'test') {
          console.warn('Redis unavailable, caching disabled:', err.message);
        }
        redisClient = null;
      });
    } catch {
      return null;
    }
  }
  return redisClient;
}

export async function cached<T>(key: string, ttl: number, fn: () => Promise<T>): Promise<T> {
  const redis = getRedis();

  if (redis) {
    try {
      const hit = await redis.get(key);
      if (hit) return JSON.parse(hit) as T;
    } catch {
      // cache miss — fall through
    }
  }

  const data = await fn();

  if (redis) {
    try {
      await redis.setex(key, ttl, JSON.stringify(data));
    } catch {
      // ignore write errors
    }
  }

  return data;
}

export async function invalidate(key: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    try {
      await redis.del(key);
    } catch {
      // ignore
    }
  }
}
