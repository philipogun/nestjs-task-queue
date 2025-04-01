 
import { SetMetadata } from '@nestjs/common';

export const TASK_HANDLER_METADATA = 'task-handler';

/**
 * Decorator to register a task handler.
 * @param taskName - The name of the task to handle.
 */
export const TaskHandler = (taskName: string) => {
  return SetMetadata(TASK_HANDLER_METADATA, taskName);
};