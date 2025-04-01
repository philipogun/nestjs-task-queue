 
export interface Task<T = any> {
    /**
     * Unique name of the task.
     */
    name: string;
  
    /**
     * Payload for the task.
     */
    payload: T;
  
    /**
     * Priority of the task (higher number = higher priority).
     * @default 0
     */
    priority?: number;
  
    /**
     * Number of retries if the task fails.
     * @default 0
     */
    retry?: number;
  
    /**
     * Delay (in milliseconds) before the task is processed.
     * @default 0
     */
    delay?: number;
  
    /**
     * Timeout (in milliseconds) for the task to complete.
     * @default 30000 (30 seconds)
     */
    timeout?: number;
  
    /**
     * Time-to-live (in milliseconds) for the task in the queue.
     * @default 86400000 (24 hours)
     */
    ttl?: number;
  
    /**
     * Optional ID for the task.
     */
    id?: string;
  
    /**
     * Optional timestamp for when the task was created.
     */
    createdAt?: number;
  
    /**
     * Optional timestamp for when the task was completed.
     */
    completedAt?: number;
  
    /**
     * Optional progress of the task (0 to 100).
     */
    progress?: number;
  }