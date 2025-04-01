 
import { Redis, RedisOptions } from 'ioredis';

/**
 * Creates a Redis client with connection pooling.
 * @param options - Redis connection options.
 * @returns A Redis client instance.
 */
export const createRedisClient = (options: RedisOptions): Redis => {
  return new Redis(options);
};

/**
 * Closes a Redis client.
 * @param client - The Redis client to close.
 */
export const closeRedisClient = async (client: Redis): Promise<void> => {
  await client.quit();
};