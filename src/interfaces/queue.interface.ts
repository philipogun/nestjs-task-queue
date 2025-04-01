import { Task } from './task.interface';

export interface Queue {
  /**
   * Adds a task to the queue.
   * @param task - The task to add.
   */
  add(task: Task): Promise<void>;

  /**
   * Processes tasks from the queue.
   * @param handler - The handler function to process tasks.
   */
  process(handler: (task: Task) => Promise<void>): void;

  /**
   * Shuts down the queue and cleans up resources.
   */
  shutdown(): Promise<void>;
}