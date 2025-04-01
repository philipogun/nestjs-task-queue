import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import * as amqp from 'amqplib';
import { Queue } from '../interfaces/queue.interface';
import { RedisQueue } from '../queues/redis.queue';
import { RabbitMQQueue } from '../queues/rabbitmq.queue';
import { MemoryQueue } from '../queues/memory.queue';
import {
  REDIS_DEFAULT_CONNECTION_NAME,
  REDIS_DEFAULT_PREFIX,
  RABBITMQ_DEFAULT_QUEUE_OPTIONS,
  RABBITMQ_DEFAULT_EXCHANGE,
  DEFAULT_CONCURRENCY,
} from '../constants/task-queue.constants';
import { QueueType } from 'src/enums/queue-type.enum';

@Injectable()
export class QueueFactoryService implements OnModuleDestroy {
  private redisClient!: Redis;
  private rabbitMQChannelModel!: amqp.ChannelModel;
  private readonly queues = new Map<string, Queue>();

  constructor() {}

  async createQueue(
    type: QueueType,
    name: string,
    options: any = {},
  ): Promise<Queue> {
    const queueKey = `${type}:${name}`;

    if (this.queues.has(queueKey)) {
      return this.queues.get(queueKey)!;
    }

    let queue: Queue;

    switch (type) {
      case QueueType.REDIS:
        queue = await this.createRedisQueue(name, options);
        break;
      case QueueType.RABBITMQ:
        queue = await this.createRabbitMQQueue(name, options);
        break;
      case QueueType.MEMORY:
        queue = this.createMemoryQueue(name, options);
        break;
      default:
        throw new Error(`Unsupported queue type: ${type}`);
    }

    this.queues.set(queueKey, queue);
    return queue;
  }

  private async createRedisQueue(name: string, options: any): Promise<Queue> {
    if (!this.redisClient) {
      this.redisClient = new Redis({
        ...options.connection,
        connectionName: REDIS_DEFAULT_CONNECTION_NAME,
      });
    }

    return new RedisQueue(this.redisClient, {
      queueName: name,
      prefix: options.prefix || REDIS_DEFAULT_PREFIX,
      concurrency: options.concurrency || DEFAULT_CONCURRENCY,
      useStreams: options.useStreams || false,
      consumerGroup: options.consumerGroup,
      consumerName: options.consumerName,
    });
  }

  private async createRabbitMQQueue(name: string, options: any): Promise<Queue> {
    if (!this.rabbitMQChannelModel) {
      this.rabbitMQChannelModel = await amqp.connect(options.connection);
    }

    const channel = await this.rabbitMQChannelModel.createChannel();
    await channel.assertExchange(
      options.exchange?.name || RABBITMQ_DEFAULT_EXCHANGE,
      options.exchange?.type || 'direct',
      options.exchange?.options,
    );

    await channel.assertQueue(name, {
      ...RABBITMQ_DEFAULT_QUEUE_OPTIONS,
      ...options.queue,
    });

    await channel.bindQueue(
      name,
      options.exchange?.name || RABBITMQ_DEFAULT_EXCHANGE,
      name,
    );

    return new RabbitMQQueue(this.rabbitMQChannelModel.connection, {
      queueName: name,
      exchangeName: options.exchange?.name || RABBITMQ_DEFAULT_EXCHANGE,
      concurrency: options.concurrency || DEFAULT_CONCURRENCY,
    });
  }

  private createMemoryQueue(name: string, options: any): Queue {
    return new MemoryQueue({
      queueName: name,
      concurrency: options.concurrency || DEFAULT_CONCURRENCY,
      maxSize: options.maxMemory,
    });
  }

  public hasRedisConnection(): boolean {
    return !!this.redisClient;
  }
  
  public hasRabbitMQConnection(): boolean {
    return !!this.rabbitMQChannelModel;
  }
  
  public async checkRabbitMQConnection(): Promise<void> {
    if (!this.rabbitMQChannelModel) {
      throw new Error('RabbitMQ not connected');
    }
    const channel = await this.rabbitMQChannelModel.createChannel();
    await channel.close();
  }

  async onModuleDestroy() {
    await Promise.all(
      Array.from(this.queues.values()).map((queue) => queue.shutdown()),
    );
    this.queues.clear();

    if (this.redisClient) {
      await this.redisClient.quit();
    }

    if (this.rabbitMQChannelModel) {
      await this.rabbitMQChannelModel.close();
    }
  }
}