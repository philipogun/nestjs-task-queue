/**
 * Represents a task to be processed by the queue system
 * @template T - Type of the task payload
 */
export interface Task<T = any> {
    /**
     * Unique identifier for the task
     * @default Auto-generated UUID if not provided
     * @pattern ^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-4[a-fA-F0-9]{3}-[89aAbB][a-fA-F0-9]{3}-[a-fA-F0-9]{12}$
     * @example "550e8400-e29b-41d4-a716-446655440000"
     */
    id?: string;
  
    /**
     * Name of the task that corresponds to a registered handler
     * @required
     * @pattern ^[a-zA-Z0-9_-]+$
     * @example "send-email"
     */
    name: string;
  
    /**
     * The data payload for the task
     * @required
     * @example { to: "user@example.com", subject: "Welcome" }
     */
    payload: T;
  
    /**
     * Task priority (higher numbers = higher priority)
     * @default 0
     * @minimum 0
     * @maximum 100
     */
    priority?: number;
  
    /**
     * Number of times the task has been retried
     * @default 0
     * @minimum 0
     */
    retryCount?: number;
  
    /**
     * Maximum number of retry attempts
     * @default 3
     * @minimum 0
     */
    maxRetries?: number;
  
    /**
     * Delay before processing (milliseconds)
     * @default 0
     * @minimum 0
     */
    delay?: number;
  
    /**
     * Timeout for task execution (milliseconds)
     * @default 30000
     * @minimum 1000
     */
    timeout?: number;
  
    /**
     * Time-to-live in queue (milliseconds)
     * @default 86400000 (24 hours)
     * @minimum 60000
     */
    ttl?: number;
  
    /**
     * When the task was created
     * @default Date.now()
     */
    createdAt?: Date;
  
    /**
     * When the task was started (set by queue)
     */
    startedAt?: Date;
  
    /**
     * When the task was completed (set by queue)
     */
    completedAt?: Date;
  
    /**
     * Progress percentage (0-100)
     * @minimum 0
     * @maximum 100
     */
    progress?: number;
  
    /**
     * Whether the task is scheduled for future execution
     * @default false
     */
    scheduled?: boolean;
  
    /**
     * When the task is scheduled to run
     */
    scheduledAt?: Date;
  
    /**
     * The queue this task belongs to
     */
    queue?: string;

    /**
     * Current status of the task
     * @default 'pending'
     */
    status?: 'pending' | 'processing' | 'completed' | 'failed';
  
    /**
     * Additional metadata about the task
     */
    metadata?: {
      /**
       * Origin of the task (service name)
       * @example "user-service"
       */
      origin?: string;
      
      /**
       * Correlation ID for tracing
       */
      correlationId?: string;
      
      /**
       * User ID who initiated the task
       */
      userId?: string;
      
      /**
       * Additional custom fields
       */
      [key: string]: any;
    };
  
    /**
     * Error details if task failed
     */
    error?: {
      /**
       * Error message
       */
      message: string;
      
      /**
       * Error stack trace
       */
      stack?: string;
      
      /**
       * Error code
       */
      code?: string;
      
      /**
       * When the error occurred
       */
      timestamp?: Date;
    };
  }