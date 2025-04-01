 
import { Test, TestingModule } from '@nestjs/testing';
import { RedisQueue } from '../../../src/queues/redis.queue';
import { Redis } from 'ioredis';
import { Task } from '../../../src/interfaces/task.interface';

describe('RedisQueue', () => {
  let redisQueue: RedisQueue;
  let mockRedis: jest.Mocked<Redis>;

  beforeEach(async () => {
    mockRedis = {
      zadd: jest.fn().mockResolvedValue(1),
      zpopmax: jest.fn().mockResolvedValue(['{"name":"test","payload":{}}']),
      quit: jest.fn().mockResolvedValue('OK'),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisQueue,
        {
          provide: 'REDIS_OPTIONS',
          useValue: {},
        },
        {
          provide: Redis,
          useValue: mockRedis,
        },
      ],
    }).compile();

    redisQueue = module.get<RedisQueue>(RedisQueue);
  });

  it('should add a task to the queue', async () => {
    const task: Task = { name: 'test', payload: {} };
    await redisQueue.add(task);
    expect(mockRedis.zadd).toHaveBeenCalledWith('tasks', task.priority ?? 0, JSON.stringify(task));
  });

  it('should process tasks from the queue', async () => {
    const handler = jest.fn().mockResolvedValue(undefined);
    redisQueue.process(handler);
    expect(mockRedis.zpopmax).toHaveBeenCalledWith('tasks');
    expect(handler).toHaveBeenCalledWith({ name: 'test', payload: {} });
  });

  it('should shutdown the queue', async () => {
    await redisQueue.shutdown();
    expect(mockRedis.quit).toHaveBeenCalled();
  });
});