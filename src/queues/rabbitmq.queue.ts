import * as amqp from 'amqplib';
import { Queue, QueueEventType, QueueMetrics } from '../interfaces/queue.interface';
import { Task } from '../interfaces/task.interface';
import { 
  TASK_EVENTS, 
  QUEUE_EVENTS,
  DEFAULT_CONCURRENCY,
  DEFAULT_MAX_RETRIES,
  DEFAULT_RETRY_DELAY,
  RABBITMQ_DEFAULT_EXCHANGE
} from '../constants/task-queue.constants';
import { TaskQueueError } from '../errors/task-queue.errors';
import EventEmitter from 'events';
import { normalizeError } from 'src/utils/error.utils';

export class RabbitMQQueue<T = any> extends EventEmitter implements Queue<T> {
  private channel?: amqp.Channel;
  private consumerTag?: string;
  private isPaused = false;
  private isShutdown = false;
  private handler?: (task: Task<T>) => Promise<void>;
  private channelModel?: amqp.ChannelModel;

  constructor(
    private readonly connection: amqp.Connection,
    private readonly options: {
      queueName: string;
      exchangeName?: string;
      exchangeType?: string;
      concurrency?: number;
      durable?: boolean;
      deadLetterExchange?: string;
    }
  ) {
    super();
    this.setMaxListeners(100);
  }

  static async create(
    connectionUrl: string | amqp.Options.Connect,
    options: {
      queueName: string;
      exchangeName?: string;
      exchangeType?: string;
      concurrency?: number;
      durable?: boolean;
      deadLetterExchange?: string;
    },
    socketOptions?: any
  ): Promise<RabbitMQQueue> {
    // Connect to RabbitMQ and get ChannelModel
    const channelModel = await amqp.connect(connectionUrl, socketOptions);
    const queue = new RabbitMQQueue(channelModel.connection, {
      queueName: options.queueName,
      exchangeName: options.exchangeName,
      exchangeType: options.exchangeType,
      concurrency: options.concurrency,
      durable: options.durable !== false,
      deadLetterExchange: options.deadLetterExchange,
    });
    queue.channelModel = channelModel;
    await queue.initialize();
    return queue;
  }

  private async initialize(): Promise<void> {
    if (!this.channelModel) {
      throw new TaskQueueError('ChannelModel not initialized');
    }
    
    // Create a confirm channel for better reliability
    this.channel = await this.channelModel.createConfirmChannel();
    const exchangeName = this.options.exchangeName ?? RABBITMQ_DEFAULT_EXCHANGE;
    const exchangeType = this.options.exchangeType ?? 'direct';
    const durable = this.options.durable !== false;

    await this.channel.assertExchange(exchangeName, exchangeType, { durable });
    
    const queueOptions: amqp.Options.AssertQueue = { 
      durable,
      deadLetterExchange: this.options.deadLetterExchange,
    };

    await this.channel.assertQueue(this.options.queueName, queueOptions);
    await this.channel.bindQueue(
      this.options.queueName,
      exchangeName,
      this.options.queueName
    );
  }

  override eventNames(): QueueEventType[] {
      return super.eventNames() as QueueEventType[];
    }
  
    async start(): Promise<void> {
      try {
        await this.resume();
      } catch (err) {
        this.emit(QUEUE_EVENTS.ERROR, err);
      }
    }
  
    async getMetrics(): Promise<QueueMetrics> {
      const status = await this.getStatus();
      return {
        totalTasks: status.totalTasks,
        completedTasks: 0,
        failedTasks: status.failedTasks,
        activeTasks: status.processingTasks,
        waitingTasks: status.pendingTasks,
        delayedTasks: 0,
        retriedTasks: 0,
        throughput: 0,
      };
    }
  
    onCompleted(listener: (task: Task<T>, result: any) => void): this {
      this.on(TASK_EVENTS.COMPLETED, listener);
      return this;
    }
  
    onFailed(listener: (task: Task<T>, error: Error) => void): this {
      this.on(TASK_EVENTS.FAILED, listener);
      return this;
    }
  
    onError(listener: (error: Error) => void): this {
      this.on(QUEUE_EVENTS.ERROR, listener);
      return this;
    }

  async add(task: Task<T>): Promise<void> {
    if (this.isShutdown) {
      throw new TaskQueueError('Queue is shutdown');
    }
    if (!this.channel) {
      throw new TaskQueueError('Channel not initialized');
    }

    this.validateTask(task);
    task = this.normalizeTask(task);

    await this.channel.publish(
      this.options.exchangeName ?? RABBITMQ_DEFAULT_EXCHANGE,
      this.options.queueName,
      Buffer.from(JSON.stringify(task)),
      {
        persistent: true,
        headers: {
          'x-priority': task.priority ?? 0,
          'x-delay': task.delay ?? 0,
          'x-retry-count': task.retryCount ?? 0,
        },
      }
    );

    this.emit(TASK_EVENTS.ADDED, task);
  }

  process(handler: (task: Task<T>) => Promise<void>): void {
    if (this.handler) {
      throw new TaskQueueError('Handler already registered');
    }
    if (!this.channel) {
      throw new TaskQueueError('Channel not initialized');
    }

    this.handler = handler;
    this.channel.prefetch(this.options.concurrency ?? DEFAULT_CONCURRENCY);

    this.channel.consume(
      this.options.queueName,
      (msg) => {
        if (!msg || (this.isPaused ?? false) || (this.isShutdown ?? false)) {
          return;
        }

        (async () => {
          try {
            const task = this.parseMessage(msg);
            this.emit(TASK_EVENTS.STARTED, task);

            const startTime = Date.now();
            await this.handler!(task);
            const duration = Date.now() - startTime;

            this.channel!.ack(msg);
            this.emit(TASK_EVENTS.COMPLETED, task, { duration });
          } catch (error) {
            await this.handleFailedTask(msg, error);
          }
        })();
      },
      { noAck: false }
    ).then((result) => {
      this.consumerTag = result.consumerTag;
    });
  }

  private parseMessage(msg: amqp.ConsumeMessage | amqp.GetMessage): Task<T> {
      const task = JSON.parse(msg.content.toString());
      task.priority = msg.properties.headers?.['x-priority'] || 0;
      task.delay = (msg.properties.headers?.['x-delay'] ?? 0);
      task.retryCount = (msg.properties.headers?.['x-retry-count'] ?? 0);
      return task;
    }

  private async handleFailedTask(
    msg: amqp.ConsumeMessage,
    error: unknown
  ): Promise<void> {
    const task = this.parseMessage(msg);
    const normalizedError = normalizeError(error);
    task.retryCount = (task.retryCount ?? 0) + 1;

    this.emit(TASK_EVENTS.FAILED, task, normalizedError);

    if (task.retryCount < (task.maxRetries || DEFAULT_MAX_RETRIES)) {
      const delay = (task.delay || DEFAULT_RETRY_DELAY) * task.retryCount;
      this.emit(TASK_EVENTS.RETRY, task, { delay });
      
      // Requeue with delay
      await this.channel!.publish(
        this.options.exchangeName ?? RABBITMQ_DEFAULT_EXCHANGE,
        this.options.queueName,
        msg.content,
        {
          persistent: true,
          headers: {
            ...msg.properties.headers,
            'x-delay': delay,
            'x-retry-count': task.retryCount,
          },
        }
      );
      this.channel!.ack(msg);
    } else {
      // Dead letter if enabled
      this.channel!.nack(msg, false, false);
      this.emit('task:failed:final', task, normalizedError);
    }
  }

  private validateTask(task: Task<T>): void {
    if (!task || typeof task !== 'object') {
      throw new TaskQueueError('Invalid task: Task must be an object');
    }
    if (!task.id || typeof task.id !== 'string') {
      throw new TaskQueueError('Invalid task: Task must have a valid "id"');
    }
    if (task.priority && typeof task.priority !== 'number') {
      throw new TaskQueueError('Invalid task: "priority" must be a number');
    }
    if (task.delay && typeof task.delay !== 'number') {
      throw new TaskQueueError('Invalid task: "delay" must be a number');
    }
  }

  private normalizeTask(task: Task<T>): Task<T> {
    return {
      ...task,
      priority: task.priority ?? 0,
      delay: task.delay ?? 0,
      retryCount: task.retryCount ?? 0,
    };
  }

  async pause(): Promise<void> {
    if (this.isShutdown) throw new TaskQueueError('Queue is shutdown');
    if (!this.channel || !this.consumerTag) {
      throw new TaskQueueError('Queue not initialized');
    }
    
    this.isPaused = true;
    await this.channel.cancel(this.consumerTag);
    this.emit(QUEUE_EVENTS.PAUSED);
  }

  async resume(): Promise<void> {
    if (this.isShutdown) throw new TaskQueueError('Queue is shutdown');
    if (!this.channel || !this.handler) {
      throw new TaskQueueError('Queue not initialized');
    }
    
    this.isPaused = false;
    this.process(this.handler);
    this.emit(QUEUE_EVENTS.RESUMED);
  }

  async getStatus(): Promise<{
    totalTasks: number;
    pendingTasks: number;
    processingTasks: number;
    failedTasks: number;
    isPaused: boolean;
    isShutdown: boolean;
    concurrency: number;
  }> {
    if (!this.channel) {
      throw new TaskQueueError('Channel not initialized');
    }

    const queueInfo = await this.channel.checkQueue(this.options.queueName);
    return {
      totalTasks: queueInfo.messageCount,
      pendingTasks: queueInfo.messageCount,
      processingTasks: 0, // RabbitMQ doesn't expose this directly
      failedTasks: 0, // Placeholder as RabbitMQ doesn't expose this directly
      isPaused: this.isPaused,
      isShutdown: this.isShutdown,
      concurrency: this.options.concurrency ?? DEFAULT_CONCURRENCY,
    };
  }

  async getTasks(options?: { 
    limit?: number;
  }): Promise<Task<T>[]> {
    if (!this.channel) {
      throw new TaskQueueError('Channel not initialized');
    }

    const limit = options?.limit ?? 100;
    const tasks: Task<T>[] = [];
    let count = 0;

    while (count < limit) {
      const msg = await this.channel.get(this.options.queueName, { noAck: false });
      if (!msg) break;

      tasks.push(this.parseMessage(msg));
      count++;

      // Requeue the message
      this.channel.nack(msg, false, true);
    }

    return tasks;
  }

  async removeTask(taskId: string): Promise<boolean> {
    // RabbitMQ doesn't support direct removal by message content
    // This is a best-effort implementation that may miss messages
    if (!this.channel) {
      throw new TaskQueueError('Channel not initialized');
    }

    let found = false;
    let count = 0;
    const maxChecks = 1000; // Prevent infinite loops

    while (!found && count < maxChecks) {
      const msg = await this.channel.get(this.options.queueName, { noAck: false });
      if (!msg) break;

      const task = this.parseMessage(msg);
      if (task.id === taskId) {
        this.channel.ack(msg);
        found = true;
      } else {
        this.channel.nack(msg, false, true);
      }
      count++;
    }

    return found;
  }

  async clear(): Promise<void> {
    if (!this.channel) {
      throw new TaskQueueError('Channel not initialized');
    }
    await this.channel.purgeQueue(this.options.queueName);
  }

  getName(): string {
    return this.options.queueName;
  }

  getType(): string {
    return 'rabbitmq';
  }

  getOptions(): Record<string, any> {
    return {
      ...this.options,
      exchangeName: this.options.exchangeName || RABBITMQ_DEFAULT_EXCHANGE,
    };
  }

  getConnection(): amqp.Connection {
    return this.connection;
  }

  async shutdown(): Promise<void> {
    if (this.isShutdown) return;
    
    this.isShutdown = true;
    this.handler = undefined;

    try {
      if (this.channel && this.consumerTag) {
        await this.channel.cancel(this.consumerTag);
        await this.channel.close();
      }
    } catch (error) {
      this.emit(QUEUE_EVENTS.ERROR, error);
    } finally {
      this.removeAllListeners();
    }
  }
}