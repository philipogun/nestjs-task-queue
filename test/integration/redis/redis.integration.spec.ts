 
import { RedisQueue } from '../../../src/queues/redis.queue';
import { Redis } from 'ioredis';
import { Task } from '../../../src/interfaces/task.interface';

describe('RedisQueue Integration', () => {
  let redisQueue: RedisQueue;
  let redisClient: Redis;

  beforeAll(async () => {
    redisClient = new Redis();
    redisQueue = new RedisQueue({});
  });

  afterAll(async () => {
    await redisClient.quit();
  });

  it('should add and process a task', async () => {
    const task: Task = { name: 'test', payload: {} };
    await redisQueue.add(task);

    const handler = jest.fn().mockResolvedValue(undefined);
    redisQueue.process(handler);

    expect(handler).toHaveBeenCalledWith(task);
  });
});