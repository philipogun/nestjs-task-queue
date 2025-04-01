 
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Redis, RedisOptions } from 'ioredis';
import { Queue } from '../interfaces/queue.interface';
import { Task } from '../interfaces/task.interface';
import { createRedisClient, closeRedisClient } from '../utils/redis.util';

@Injectable()
export class RedisQueue implements Queue, OnModuleDestroy {
  private readonly client: Redis;

  constructor(private readonly options: RedisOptions) {
    this.client = createRedisClient(options);
  }

  async add(task: Task): Promise<void> {
    const taskString = JSON.stringify(task);
    await this.client.zadd('tasks', task.priority ?? 0, taskString);
  }

  process(handler: (task: Task) => Promise<void>): void {
    const processTasks = async () => {
      while (true) {
        const taskString = await this.client.zpopmax('tasks');
        if (!taskString) break;

        const task: Task = JSON.parse(taskString[0]);
        await handler(task);
      }
    };

    processTasks().catch((error) => {
      console.error('Error processing tasks:', error);
    });
  }

  async shutdown(): Promise<void> {
    await closeRedisClient(this.client);
  }

  onModuleDestroy() {
    this.shutdown();
  }
}