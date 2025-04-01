import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from '../interfaces/queue.interface.js';
import { RabbitMQOptions, TaskQueueModuleOptions } from '../interfaces/options.interface.js';
import { QueueType } from '../enums/queue-type.enum.js';
import { RedisQueue } from '../queues/redis.queue.js';
import { RabbitMQQueue } from '../queues/rabbitmq.queue.js';
import { MemoryQueue } from '../queues/memory.queue.js';
import { Task } from '../interfaces/task.interface.js';


@Injectable()
export class TaskQueueService implements OnModuleDestroy {
  private readonly queue: Queue;

  constructor(private readonly options: TaskQueueModuleOptions) {
    switch (this.options.defaultQueue) {
      case QueueType.REDIS:
        if (!this.options.redis) {
          throw new Error('Redis options must be provided for RedisQueue');
        }
        this.queue = new RedisQueue(this.options.redis);
        break;

      case QueueType.RABBITMQ: {
        if (!this.options.rabbitmq) {
          throw new Error('RabbitMQ options must be provided');
        }

        const rabbitMQOptions: RabbitMQOptions = {
          ...this.options.rabbitmq,
          queueName: this.options.rabbitmq.queueName || 'default_queue_name',
        };

        this.queue = new RabbitMQQueue(rabbitMQOptions);
        break;
      }

      default:
        this.queue = new MemoryQueue();
    }
  }

  async addTask(task: Task): Promise<void> {
    await this.queue.add(task);
  }

  async processTasks(handler: (task: Task) => Promise<void>): Promise<void> {
    this.queue.process(handler);
  }

  async shutdown(): Promise<void> {
    await this.queue.shutdown();
  }

  async onModuleDestroy(): Promise<void> {
    await this.shutdown();
  }
}
