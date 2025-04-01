import { RedisOptions } from 'ioredis';
import { Options } from 'amqplib';

export interface RabbitMQOptions extends Options.Connect {
  queueName: string;
}

export interface TaskQueueModuleOptions {
  /**
   * Default queue backend to use.
   * @default 'memory'
   */
  defaultQueue?: 'redis' | 'rabbitmq' | 'memory';

  /**
   * Redis connection options.
   */
  redis?: RedisOptions;

  /**
   * RabbitMQ connection options.
   */
  rabbitmq?: RabbitMQOptions;

  /**
   * In-memory queue options.
   */
  memory?: {
    /**
     * Maximum number of tasks to keep in memory.
     * @default 1000
     */
    maxTasks?: number;
  };
}
