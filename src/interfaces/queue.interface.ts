import { EventEmitter } from 'events';
import { Task } from './task.interface';

/**
 * Represents the status of a queue
 */
export interface QueueStatus {
  /** Total tasks in the queue (pending + processing) */
  totalTasks: number;
  /** Tasks waiting to be processed */
  pendingTasks: number;
  /** Tasks currently being processed */
  processingTasks: number;
  /** Tasks that have failed (in dead letter queue if enabled) */
  failedTasks: number;
  /** Whether the queue is currently paused */
  isPaused: boolean;
  /** Timestamp when queue was started */
  startedAt?: Date;
}

/**
 * Represents metrics for a queue
 */
export interface QueueMetrics {
  /** Total tasks processed since start */
  totalTasks: number;
  /** Successfully completed tasks */
  completedTasks: number;
  /** Failed tasks */
  failedTasks: number;
  /** Tasks currently being processed */
  activeTasks: number;
  /** Tasks waiting in queue */
  waitingTasks: number;
  /** Tasks scheduled for future execution */
  delayedTasks: number;
  /** Tasks that have been retried */
  retriedTasks: number;
  /** Throughput (tasks/second) */
  throughput: number;
}

/**
 * Queue event types
 */
export type QueueEventType = 
  | 'task:added'
  | 'task:started'
  | 'task:completed'
  | 'task:failed'
  | 'task:removed'
  | 'queue:paused'
  | 'queue:resumed'
  | 'queue:drained'
  | 'queue:error';

/**
 * A robust, type-safe queue interface for task processing
 * @template T - The type of task payload
 */
export interface Queue<T = any> extends EventEmitter {
  /**
   * Adds a task to the queue
   * @param task - The task to add
   * @throws {TaskValidationError} If task validation fails
   * @throws {QueueFullError} If queue is at capacity
   */
  add(task: Task<T>): Promise<void>;

  /**
   * Registers a handler function to process tasks
   * @param handler - Async function that processes tasks
   */
  process(handler: (task: Task<T>) => Promise<void>): void;

  /**
   * Starts processing tasks from the queue
   */
  start(): Promise<void>;

  /**
   * Pauses the queue (stops processing new tasks)
   */
  pause(): Promise<void>;

  /**
   * Resumes a paused queue
   */
  resume(): Promise<void>;

  /**
   * Gets current queue status
   */
  getStatus(): Promise<QueueStatus>;

  /**
   * Gets queue metrics and statistics
   */
  getMetrics(): Promise<QueueMetrics>;

  /**
   * Lists tasks in the queue
   * @param options - Filtering options
   */
  getTasks(options?: {
    status?: 'pending' | 'processing' | 'failed' | 'completed';
    limit?: number;
    offset?: number;
  }): Promise<Array<Task<T>>>;

  /**
   * Removes a specific task from the queue
   * @param taskId - ID of the task to remove
   * @returns True if task was found and removed
   */
  removeTask(taskId: string): Promise<boolean>;

  /**
   * Clears all tasks from the queue
   * @param includeFailed - Whether to also clear failed tasks
   */
  clear(includeFailed?: boolean): Promise<void>;

  /**
   * Gets the queue name
   */
  getName(): string;

  /**
   * Gets the queue type (e.g., 'redis', 'rabbitmq', 'memory')
   */
  getType(): string;

  /**
   * Gets the queue configuration options
   */
  getOptions(): Record<string, any>;

  /**
   * Gets the underlying queue connection/client
   */
  getConnection(): unknown;

  /**
   * Gracefully shuts down the queue
   */
  shutdown(): Promise<void>;

  // Enhanced EventEmitter typing
  on(event: QueueEventType, listener: (...args: any[]) => void): this;
  on(event: 'task:added', listener: (task: Task<T>) => void): this;
  on(event: 'task:started', listener: (task: Task<T>) => void): this;
  on(event: 'task:completed', listener: (task: Task<T>) => void): this;
  on(event: 'task:failed', listener: (task: Task<T>, error: Error) => void): this;
  on(event: 'task:removed', listener: (taskId: string) => void): this;
  on(event: 'queue:paused', listener: () => void): this;
  on(event: 'queue:resumed', listener: () => void): this;
  on(event: 'queue:drained', listener: () => void): this;
  on(event: 'queue:error', listener: (error: Error) => void): this;

  once(event: QueueEventType, listener: (...args: any[]) => void): this;
  prependListener(event: QueueEventType, listener: (...args: any[]) => void): this;
  prependOnceListener(event: QueueEventType, listener: (...args: any[]) => void): this;
  removeListener(event: QueueEventType, listener: (...args: any[]) => void): this;
  off(event: QueueEventType, listener: (...args: any[]) => void): this;
  removeAllListeners(event?: QueueEventType): this;
  emit(event: QueueEventType, ...args: any[]): boolean;
  eventNames(): QueueEventType[];
  listenerCount(event: QueueEventType): number;
  listeners(event: QueueEventType): Function[];

  // Convenience methods
  /**
   * Listens for task completion events
   */
  onCompleted(listener: (task: Task<T>) => void): this;

  /**
   * Listens for task failure events
   */
  onFailed(listener: (task: Task<T>, error: Error) => void): this;

  /**
   * Listens for queue errors
   */
  onError(listener: (error: Error) => void): this;
}