import { Injectable } from '@nestjs/common';
import { RabbitMQOptions, TaskQueueModuleOptions } from '../interfaces/options.interface.js';
import { Queue } from '../interfaces/queue.interface.js';
import { QueueType } from '../enums/queue-type.enum.js';
import { RedisQueue } from '../queues/redis.queue.js';
import { RabbitMQQueue } from '../queues/rabbitmq.queue.js';
import { MemoryQueue } from '../queues/memory.queue.js';

@Injectable()
export class QueueFactoryService {
  createQueue(options: TaskQueueModuleOptions): Queue {
    switch (options.defaultQueue) {
      case QueueType.REDIS:
        if (!options.redis) {
          throw new Error('Redis options must be provided for RedisQueue');
        }
        return new RedisQueue(options.redis);

      case QueueType.RABBITMQ: {
        if (!options.rabbitmq) {
          throw new Error('RabbitMQ options must be provided');
        }

        const rabbitMQOptions: RabbitMQOptions = {
          ...options.rabbitmq,
          queueName: options.rabbitmq.queueName || 'default_queue_name',
        };

        return new RabbitMQQueue(rabbitMQOptions);
      }

      default:
        return new MemoryQueue();
    }
  }
}
