import { EventEmitter } from 'events';
import { Queue, QueueEventType, QueueMetrics } from '../interfaces/queue.interface';
import { Task } from '../interfaces/task.interface';
import { 
  TASK_EVENTS, 
  QUEUE_EVENTS,
  DEFAULT_CONCURRENCY,
  DEFAULT_MAX_RETRIES,
  DEFAULT_RETRY_DELAY
} from '../constants/task-queue.constants';
import { TaskQueueError } from '../errors/task-queue.errors';

export class MemoryQueue<T = any> extends EventEmitter implements Queue<T> {
  private tasks: Task<T>[] = [];
  private readonly processing: Map<string, Task<T>> = new Map();
  private isPaused = false;
  private isShutdown = false;
  private handler?: (task: Task<T>) => Promise<void>;
  private readonly concurrency: number;
  private activeCount = 0;

  constructor(options: { 
    queueName?: string; 
    concurrency?: number;
    maxSize?: number;
  } = {}) {
    super();
    this.concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;
    this.setMaxListeners(100); // Prevent memory leak warnings
  }

  override eventNames(): QueueEventType[] {
    return super.eventNames() as QueueEventType[];
  }

  async start(): Promise<void> {
    await this.resume().catch(err => this.emit(QUEUE_EVENTS.ERROR, err));
  }

  async getMetrics(): Promise<QueueMetrics> {
    return {
      totalTasks: this.tasks.length + this.processing.size,
      completedTasks: this.tasks.filter(t => t.status === 'completed').length,
      failedTasks: this.tasks.filter(t => t.status === 'failed').length,
      activeTasks: this.activeCount,
      waitingTasks: this.tasks.length,
      delayedTasks: 0,
      retriedTasks: this.tasks.filter(t => (t.retryCount ?? 0) > 0).length,
      throughput: this.activeCount / (this.concurrency || 1),
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

    this.tasks.push(task);
    this.tasks.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

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

    const task = this.tasks.shift();
    if (!task) {
      if (this.activeCount === 0) {
        this.emit(QUEUE_EVENTS.DRAINED);
      }
      return;
    }

    if (!task.id) {
      throw new TaskQueueError('Task ID is required');
    }
    this.processing.set(task.id, task);
    this.activeCount++;
    this.emit(TASK_EVENTS.STARTED, task);

    try {
      const startTime = Date.now();
      await this.handler!(task);
      const duration = Date.now() - startTime;

      this.emit(TASK_EVENTS.COMPLETED, task, { duration });
    } catch (error) {
      await this.handleFailedTask(task, error);
    } finally {
      this.processing.delete(task.id);
      this.activeCount--;
      setImmediate(() => this.processNext());
    }
  }

  private async handleFailedTask(task: Task<T>, error: unknown): Promise<void> {
    const normalizedError = error instanceof Error ? error : new Error(String(error));
    task.retryCount = (task.retryCount ?? 0) + 1;

    this.emit(TASK_EVENTS.FAILED, task, normalizedError);

    if (task.retryCount < (task.maxRetries ?? DEFAULT_MAX_RETRIES)) {
      const delay = (task.delay ?? DEFAULT_RETRY_DELAY) * task.retryCount;
      this.emit(TASK_EVENTS.RETRY, task, { delay });

      await new Promise(resolve => setTimeout(resolve, delay));
      await this.add({ ...task, delay });
    } else {
      this.emit('task:failed:final', task, normalizedError);
    }
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

  private shouldSkipProcessing(): boolean {
    return (
      this.isShutdown ||
      this.isPaused ||
      !this.handler ||
      this.activeCount >= this.concurrency ||
      this.tasks.length === 0
    );
  }

  private generateTaskId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
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
    return {
      totalTasks: this.tasks.length + this.processing.size,
      pendingTasks: this.tasks.length,
      processingTasks: this.processing.size,
      failedTasks: 0, // Replace with actual logic to track failed tasks if applicable
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
    const status = options?.status ?? 'all';
    let tasks: Task<T>[] = [];

    if (status === 'pending' || status === 'all') {
      tasks = tasks.concat([...this.tasks]);
    }

    if (status === 'processing' || status === 'all') {
      tasks = tasks.concat([...this.processing.values()]);
    }

    if (options?.offset || options?.limit) {
      const offset = options.offset ?? 0;
      return tasks.slice(offset, offset + (options.limit ?? tasks.length));
    }

    return tasks;
  }


  async removeTask(taskId: string): Promise<boolean> {
    // Remove from pending
    const pendingIndex = this.tasks.findIndex(t => t.id === taskId);
    if (pendingIndex >= 0) {
      this.tasks.splice(pendingIndex, 1);
      return true;
    }

    // Remove from processing
    if (this.processing.has(taskId)) {
      this.processing.delete(taskId);
      return true;
    }

    return false;
  }

  async clear(): Promise<void> {
    this.tasks = [];
    this.processing.clear();
  }

  getName(): string {
    return 'memory';
  }

  getType(): string {
    return 'memory';
  }

  getOptions(): Record<string, any> {
    return { 
      concurrency: this.concurrency,
      maxListeners: this.getMaxListeners()
    };
  }

  getConnection(): any {
    return null;
  }

  async shutdown(): Promise<void> {
    if (this.isShutdown) return;

    this.isShutdown = true;
    this.handler = undefined;
    this.removeAllListeners();
    this.tasks = [];
    this.processing.clear();
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
