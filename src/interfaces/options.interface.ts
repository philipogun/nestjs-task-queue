import { RedisOptions } from 'ioredis';
import { Options as AmqpConnectionOptions } from 'amqplib/properties';
import { QueueType } from 'src/enums/queue-type.enum';
import { Task } from './task.interface';

/**
 * Common queue options applicable to all queue types
 */
export interface BaseQueueOptions {
  /**
   * Queue name (default: 'default')
   */
  name?: string;
  
  /**
   * Maximum number of retries for failed tasks (default: 3)
   */
  maxRetries?: number;
  
  /**
   * Delay between retries in milliseconds (default: 5000)
   */
  retryDelay?: number;
  
  /**
   * Maximum number of concurrent tasks (default: 5)
   */
  concurrency?: number;
  
  /**
   * Whether to start processing immediately (default: true)
   */
  autoStart?: boolean;
  
  /**
   * Default task priority (higher = more important) (default: 0)
   */
  defaultPriority?: number;
  
  /**
   * Maximum queue size (0 = unlimited) (default: 0)
   */
  maxSize?: number;
  
  /**
   * Prefix for all queue keys (default: 'nestjs-task-queue')
   */
  prefix?: string;
  
  /**
   * Whether to enable dead letter queue for failed tasks (default: true)
   */
  deadLetterQueue?: boolean;
  
  /**
   * Task timeout in milliseconds (0 = no timeout) (default: 0)
   */
  taskTimeout?: number;
}

/**
 * Redis-specific queue options
 */
export interface RedisQueueOptions extends BaseQueueOptions {
  /**
   * Redis connection options
   */
  connection?: RedisOptions;
  
  /**
   * Whether to use Redis streams instead of lists (default: false)
   */
  useStreams?: boolean;
  
  /**
   * Redis stream consumer group name (required if useStreams=true)
   */
  consumerGroup?: string;
  
  /**
   * Redis stream consumer name (required if useStreams=true)
   */
  consumerName?: string;
  
  /**
   * Whether to use Redis cluster (default: false)
   */
  cluster?: boolean;
  
  /**
   * Redis cluster nodes (required if cluster=true)
   */
  clusterNodes?: Array<{ host: string; port: number }>;
}

/**
 * RabbitMQ-specific queue options
 */
export interface RabbitMQQueueOptions extends BaseQueueOptions {
  /**
   * RabbitMQ connection options
   */
  connection?: AmqpConnectionOptions.Connect;
  
  /**
   * Queue options
   */
  queueOptions?: {
    /**
     * Whether the queue should survive broker restarts (default: true)
     */
    durable?: boolean;
    
    /**
     * Whether the queue should be deleted when unused (default: false)
     */
    autoDelete?: boolean;
    
    /**
     * Maximum queue length (default: undefined)
     */
    maxLength?: number;
    
    /**
     * Maximum queue size in bytes (default: undefined)
     */
    maxLengthBytes?: number;
    
    /**
     * Queue message TTL in milliseconds (default: undefined)
     */
    messageTtl?: number;
    
    /**
     * Dead letter exchange (default: undefined)
     */
    deadLetterExchange?: string;
    
    /**
     * Dead letter routing key (default: undefined)
     */
    deadLetterRoutingKey?: string;
  };
  
  /**
   * Exchange options
   */
  exchangeOptions?: {
    /**
     * Exchange name (default: 'nestjs-task-queue')
     */
    name?: string;
    
    /**
     * Exchange type (default: 'direct')
     */
    type?: 'direct' | 'topic' | 'headers' | 'fanout';
    
    /**
     * Whether the exchange should survive broker restarts (default: true)
     */
    durable?: boolean;
    
    /**
     * Whether the exchange should be deleted when unused (default: false)
     */
    autoDelete?: boolean;
  };
  
  /**
   * Consumer options
   */
  consumerOptions?: {
    /**
     * Whether to acknowledge messages automatically (default: false)
     */
    noAck?: boolean;
    
    /**
     * Consumer tag (default: undefined)
     */
    consumerTag?: string;
    
    /**
     * Exclusive consumer (default: false)
     */
    exclusive?: boolean;
    
    /**
     * Priority (default: undefined)
     */
    priority?: number;
  };
}

/**
 * In-memory queue options
 */
export interface MemoryQueueOptions extends BaseQueueOptions {
  /**
   * Maximum memory usage in MB (default: 100)
   */
  maxMemory?: number;
  
  /**
   * Whether to persist queue state to disk (default: false)
   */
  persist?: boolean;
  
  /**
   * Path to persist queue state (required if persist=true)
   */
  persistPath?: string;
  
  /**
   * Interval for saving state in milliseconds (default: 5000)
   */
  persistInterval?: number;
}

/**
 * Module configuration options
 */
export interface TaskQueueModuleOptions {
  /**
   * Default queue type (default: 'memory')
   */
  defaultQueueType?: QueueType;
  
  /**
   * Redis queue options
   */
  redis?: RedisQueueOptions;
  
  /**
   * RabbitMQ queue options
   */
  rabbitmq?: RabbitMQQueueOptions;
  
  /**
   * In-memory queue options
   */
  memory?: MemoryQueueOptions;
  
  /**
   * Whether to enable metrics collection (default: true)
   */
  metrics?: boolean;
  
  /**
   * Metrics collection interval in milliseconds (default: 5000)
   */
  metricsInterval?: number;
  
  /**
   * Whether to enable health checks (default: true)
   */
  healthChecks?: boolean;
  
  /**
   * Health check timeout in milliseconds (default: 3000)
   */
  healthCheckTimeout?: number;
  
  /**
   * Global task validation function
   */
  validateTask?: <T>(task: Task<T>) => Promise<void>;
  
  /**
   * Global error handler
   */
  onError?: (error: Error) => void;
}
