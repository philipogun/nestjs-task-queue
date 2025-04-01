import Redis from 'ioredis';
import { Queue, QueueEventType, QueueMetrics } from '../interfaces/queue.interface';
import { Task } from '../interfaces/task.interface';
import { 
  TASK_EVENTS, 
  QUEUE_EVENTS,
  DEFAULT_CONCURRENCY,
  DEFAULT_MAX_RETRIES,
  DEFAULT_RETRY_DELAY,
  REDIS_DEFAULT_PREFIX
} from '../constants/task-queue.constants';
import { TaskQueueError } from '../errors/task-queue.errors';
import EventEmitter from 'events';

export class RedisQueue<T = any> extends EventEmitter implements Queue<T> {
  private readonly queueKey: string;
  private readonly processingQueueKey: string;
  private readonly deadLetterQueueKey: string;
  private handler?: (task: Task<T>) => Promise<void>;
  private isPaused = false;
  private isShutdown = false;
  private activeCount = 0;
  private readonly concurrency: number;

  constructor(
    private readonly redis: Redis,
    options: {
      queueName?: string;
      prefix?: string;
      concurrency?: number;
      deadLetterQueue?: boolean;
      useStreams?: boolean;
      maxSize?: number;
      consumerName?: string;
      consumerGroup?: string;
      consumerGroupName?: string;
      consumerGroupId?: string;
      consumerGroupAutoJoin?: boolean;
      consumerGroupRetryMinTimeout?: number;
      consumerGroupMaxRetryTime?: number;
      consumerGroupMaxAttempts?: number;
      consumerGroupIdleTimeout?: number;
      streamKey?: string;
      streamName?: string;
      connectionName?: string;
    } = {}
  ) {
    super();
    const prefix = options.prefix ?? REDIS_DEFAULT_PREFIX;
    const queueName = options.queueName ?? 'default';
    
    this.queueKey = `${prefix}:${queueName}`;
    this.processingQueueKey = `${this.queueKey}:processing`;
    this.deadLetterQueueKey = `${this.queueKey}:dead`;
    this.concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;
    this.setMaxListeners(100);
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
      completedTasks: 0, // Placeholder, update with actual logic if available
      failedTasks: status.failedTasks,
      activeTasks: status.activeCount,
      waitingTasks: status.pendingTasks,
      delayedTasks: 0, // Placeholder, update with actual logic if available
      retriedTasks: 0, // Placeholder, update with actual logic if available
      throughput: 0, // Placeholder, update with actual logic if available
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

    this.validateTask(task);
    task = this.normalizeTask(task);

    const score = this.calculateScore(task);
    const taskStr = JSON.stringify(task);

    await this.redis.zadd(this.queueKey, score, taskStr);
    this.emit(TASK_EVENTS.ADDED, task);
    this.processNext().catch(err => this.emit(QUEUE_EVENTS.ERROR, err));
  }

  process(handler: (task: Task<T>) => Promise<void>): void {
    if (this.handler) {
      throw new TaskQueueError('Handler already registered');
    }
    this.handler = handler;
    this.processNext().catch(err => this.emit(QUEUE_EVENTS.ERROR, err));
  }

  private async processNext(): Promise<void> {
    if (this.shouldSkipProcessing()) return;

    try {
      const now = Date.now();
      const result = await this.redis
        .multi()
        .zrangebyscore(this.queueKey, '-inf', now, 'LIMIT', 0, 1)
        .exec();

      if (!result?.[0]) {
        return;
      }

      const [, taskStr] = result[0] || [];
      if (typeof taskStr !== 'string') {
        throw new TaskQueueError('Invalid task format received from Redis');
      }

      if (!taskStr) {
        if (this.activeCount === 0) {
          this.emit(QUEUE_EVENTS.DRAINED);
        }
        return;
      }

      await this.processTask(taskStr);
    } catch (error) {
      this.emit(QUEUE_EVENTS.ERROR, this.normalizeError(error));
    } finally {
      if (!this.isPaused && !this.isShutdown) {
        setImmediate(() => this.processNext());
      }
    }
  }

  private async processTask(taskStr: string): Promise<void> {
    const task: Task<T> = JSON.parse(taskStr);
    this.activeCount++;

    try {
      const startTime = Date.now();
      
      // Atomically move task to processing queue
      const execResult = await this.redis
        .multi()
        .zrem(this.queueKey, taskStr)
        .lpush(this.processingQueueKey, taskStr)
        .exec();

      if (!execResult || execResult[0][1] === 0) {
        throw new TaskQueueError('Task was already processed');
      }

      this.emit(TASK_EVENTS.STARTED, task);

      await this.handler!(task);
      
      // Remove from processing queue on success
      await this.redis.lrem(this.processingQueueKey, 0, taskStr);
      
      const duration = Date.now() - startTime;
      this.emit(TASK_EVENTS.COMPLETED, task, { duration });
    } catch (error) {
      await this.handleFailedTask(task, taskStr, error);
    } finally {
      this.activeCount--;
    }
  }

  private async handleFailedTask(
    task: Task<T>,
    taskStr: string,
    error: unknown
  ): Promise<void> {
    const normalizedError = this.normalizeError(error);
    task.retryCount = (task.retryCount ?? 0) + 1;

    this.emit(TASK_EVENTS.FAILED, task, normalizedError);

    if (task.retryCount < (task.maxRetries ?? DEFAULT_MAX_RETRIES)) {
      const delay = (task.delay ?? DEFAULT_RETRY_DELAY) * task.retryCount;
      this.emit(TASK_EVENTS.RETRY, task, { delay });
      
      // Return task to main queue with delay
      await this.redis.zadd(
        this.queueKey,
        this.calculateScore({ ...task, delay }),
        taskStr
      );
    } else {
      // Move to dead letter queue if enabled
      await this.redis.lpush(this.deadLetterQueueKey, taskStr);
      this.emit('task:failed:final', task, normalizedError);
    }

    // Remove from processing queue
    await this.redis.lrem(this.processingQueueKey, 0, taskStr);
  }

  private calculateScore(task: Task<T>): number {
    const now = Date.now();
    const delay = task.delay ?? 0;
    const priority = task.priority ?? 0;
    return now + delay - priority * 1000;
  }

  private normalizeTask(task: Task<T>): Task<T> {
    return {
      ...task,
      id: task.id ?? this.generateTaskId(),
      createdAt: task.createdAt || new Date(),
      priority: task.priority ?? 0,
      retryCount: task.retryCount ?? 0,
    };
  }

  private validateTask(task: Task<T>): void {
    if (!task.name) throw new TaskQueueError('Task name is required');
    if (task.priority && (task.priority < 0 || task.priority > 100)) {
      throw new TaskQueueError('Priority must be between 0-100');
    }
  }

  private normalizeError(error: unknown): Error {
    return error instanceof Error ? error : new Error(String(error));
  }

  private shouldSkipProcessing(): boolean {
    return (
      this.isShutdown ||
      this.isPaused ||
      !this.handler ||
      this.activeCount >= this.concurrency
    );
  }

  private generateTaskId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }


  async pause(): Promise<void> {
    if (this.isShutdown) throw new TaskQueueError('Queue is shutdown');
    this.isPaused = true;
    this.emit(QUEUE_EVENTS.PAUSED);
  }

  async resume(): Promise<void> {
    if (this.isShutdown) throw new TaskQueueError('Queue is shutdown');
    this.isPaused = false;
    this.emit(QUEUE_EVENTS.RESUMED);
    this.processNext().catch(err => this.emit(QUEUE_EVENTS.ERROR, err));
  }

  async getStatus(): Promise<{
    totalTasks: number;
    pendingTasks: number;
    processingTasks: number;
    failedTasks: number;
    isPaused: boolean;
    isShutdown: boolean;
    concurrency: number;
    activeCount: number;
  }> {
    const [pendingCount, processingCount, deadLetterCount] = await Promise.all([
      this.redis.zcard(this.queueKey),
      this.redis.llen(this.processingQueueKey),
      this.redis.llen(this.deadLetterQueueKey),
    ]);

    return {
      totalTasks: pendingCount + processingCount + deadLetterCount,
      pendingTasks: pendingCount,
      processingTasks: processingCount,
      failedTasks: deadLetterCount,
      isPaused: this.isPaused,
      isShutdown: this.isShutdown,
      concurrency: this.concurrency,
      activeCount: this.activeCount,
    };
  }

  async getTasks(options?: { 
    status?: 'pending' | 'processing' | 'failed' | 'completed' | 'all';
    limit?: number;
    offset?: number;
  }): Promise<Task<T>[]> {
    const limit = options?.limit ?? 100;
    let tasks: Task<T>[] = [];
    const status = options?.status ?? 'all'; // Define a local status variable
    if (status === 'pending' || status === 'all') {
      const pendingTasks = await this.redis.zrange(this.queueKey, 0, limit - 1);
      tasks = tasks.concat(pendingTasks.map(t => JSON.parse(t)));
    }

    if ((status === 'processing' || status === 'all') && tasks.length < limit) {
      const processingTasks = await this.redis.lrange(
        this.processingQueueKey, 
        0, 
        limit - tasks.length - 1
      );
      tasks = tasks.concat(processingTasks.map(t => JSON.parse(t)));
    }

    if ((status === 'failed' || status === 'all') && tasks.length < limit) {
      const failedTasks = await this.redis.lrange(
        this.deadLetterQueueKey, 
        0, 
        limit - tasks.length - 1
      );
      tasks = tasks.concat(failedTasks.map(t => JSON.parse(t)));
    }

    return tasks.slice(0, limit);
  }

  async removeTask(taskId: string): Promise<boolean> {
    // Check pending tasks
    const pendingTasks = await this.redis.zrange(this.queueKey, 0, -1);
    for (const taskStr of pendingTasks) {
      const task = JSON.parse(taskStr);
      if (task.id === taskId) {
        await this.redis.zrem(this.queueKey, taskStr);
        return true;
      }
    }

    // Check processing tasks
    const processingTasks = await this.redis.lrange(this.processingQueueKey, 0, -1);
    for (const taskStr of processingTasks) {
      const task = JSON.parse(taskStr);
      if (task.id === taskId) {
        await this.redis.lrem(this.processingQueueKey, 0, taskStr);
        return true;
      }
    }

    // Check dead letter queue
    const deadTasks = await this.redis.lrange(this.deadLetterQueueKey, 0, -1);
    for (const taskStr of deadTasks) {
      const task = JSON.parse(taskStr);
      if (task.id === taskId) {
        await this.redis.lrem(this.deadLetterQueueKey, 0, taskStr);
        return true;
      }
    }

    return false;
  }

  async clear(): Promise<void> {
    await Promise.all([
      this.redis.del(this.queueKey),
      this.redis.del(this.processingQueueKey),
      this.redis.del(this.deadLetterQueueKey),
    ]);
  }

  getName(): string {
    return this.queueKey.split(':').pop() ?? 'default';
  }

  getType(): string {
    return 'redis';
  }

  getOptions(): Record<string, any> {
    return {
      prefix: this.queueKey.split(':')[0],
      concurrency: this.concurrency,
      deadLetterQueue: true,
    };
  }

  getConnection(): Redis {
    return this.redis;
  }

  async shutdown(): Promise<void> {
    if (this.isShutdown) return;
    
    this.isShutdown = true;
    this.handler = undefined;

    // Move processing tasks back to main queue
    const processingTasks = await this.redis.lrange(this.processingQueueKey, 0, -1);
    if (processingTasks.length > 0) {
      const multi = this.redis.multi();
      for (const taskStr of processingTasks) {
        const task = JSON.parse(taskStr);
        multi.zadd(this.queueKey, this.calculateScore(task), taskStr);
      }
      multi.del(this.processingQueueKey);
      await multi.exec();
    }

    this.removeAllListeners();
  }

    // Enhanced EventEmitter methods
    on(event: string, listener: (...args: any[]) => void): this {
      super.on(event, listener);
      return this;
    }
  
    once(event: string, listener: (...args: any[]) => void): this {
      super.once(event, listener);
      return this;
    }
  
    removeListener(event: string, listener: (...args: any[]) => void): this {
      super.removeListener(event, listener);
      return this;
    }
}