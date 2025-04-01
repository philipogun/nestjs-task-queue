import { SetMetadata } from '@nestjs/common';
import { TASK_HANDLER_METADATA } from '../constants/task-queue.constants';
import { Task } from '../interfaces/task.interface';

/**
 * Task handler decorator options
 */
export interface TaskHandlerOptions<T extends object = object> {
  /**
   * Name of the task this handler will process
   */
  name: string;
  
  /**
   * Number of concurrent tasks this handler can process
   * @default 1
   */
  concurrency?: number;
  
  /**
   * Whether to automatically validate the task payload
   * @default false
   */
  validate?: boolean;
  
  /**
   * Optional payload validation schema (class-validator compatible)
   */
  schema?: new () => T;
  
  /**
   * Queue name this handler should listen to
   * @default 'default'
   */
  queue?: string;
}

/**
 * Decorator that marks a method as a task handler
 * @param options Task handler configuration
 */
export function TaskHandler<T extends object = object>(options: TaskHandlerOptions<T>): MethodDecorator {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;
    
    // Wrap the original method with validation if enabled
    if (options.validate && options.schema) {
      descriptor.value = async function(task: Task<T>) {
        await validateTaskPayload(task.payload, options.schema!);
        return originalMethod.apply(this, [task]);
      };
    }

    SetMetadata(TASK_HANDLER_METADATA, {
      ...options,
      methodName: propertyKey.toString(),
    })(target, propertyKey, descriptor);
  };
}

async function validateTaskPayload<T extends object>(payload: T, schema: new () => T): Promise<void> {
  const { validate } = await import('class-validator');
  const errors = await validate(Object.assign(new schema(), payload));
  if (errors.length > 0) {
    const errorMessages = errors.flatMap(error => Object.values(error.constraints || {}));
    throw new Error(`Task validation failed: ${errorMessages.join(', ')}`);
  }
}