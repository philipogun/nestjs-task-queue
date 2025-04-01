import Redis from 'ioredis';
import { Injectable } from '@nestjs/common';
import { TaskQueueError } from '../errors/task-queue.errors';

@Injectable()
export class RedisLock {
  private readonly unlockScript = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;

  constructor(
    private readonly redis: Redis,
    private readonly defaultTtl = 10000,
  ) {}

  async acquire(
    lockKey: string,
    ttl?: number,
    retryOptions = { delay: 100, maxAttempts: 10 },
  ): Promise<string | null> {
    const lockId = Math.random().toString(36).substring(2, 15);
    const finalTtl = ttl ?? this.defaultTtl;
    let attempts = 0;

    while (attempts < retryOptions.maxAttempts) {
      const acquired = await this.redis.set(
        lockKey,
        lockId,
        'PX',
        finalTtl,
        'NX',
      );

      if (acquired === 'OK') {
        return lockId;
      }

      attempts++;
      await new Promise((resolve) => setTimeout(resolve, retryOptions.delay));
    }

    return null;
  }

  async release(lockKey: string, lockId: string): Promise<boolean> {
    try {
      const result = await this.redis.eval(
        this.unlockScript,
        1,
        lockKey,
        lockId,
      );
      return result === 1;
    } catch (error) {
      if (error instanceof Error) {
        throw new TaskQueueError(`Failed to release lock: ${error.message}`);
      }
      throw new TaskQueueError('Failed to release lock due to an unknown error');
    }
  }

  async withLock<T>(
    lockKey: string,
    fn: () => Promise<T>,
    options?: {
      ttl?: number;
      retry?: { delay: number; maxAttempts: number };
    },
  ): Promise<T> {
    const lockId = await this.acquire(
      lockKey,
      options?.ttl,
      options?.retry,
    );

    if (!lockId) {
      throw new TaskQueueError(`Could not acquire lock for key: ${lockKey}`);
    }

    try {
      return await fn();
    } finally {
      await this.release(lockKey, lockId);
    }
  }

  async extendLock(lockKey: string, lockId: string, ttl: number): Promise<boolean> {
    const result = await this.redis.eval(
      `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("pexpire", KEYS[1], ARGV[2])
      else
        return 0
      end
      `,
      1,
      lockKey,
      lockId,
      ttl,
    );
    return result === 1;
  }
}