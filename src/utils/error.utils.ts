import { Logger } from '@nestjs/common';

const logger = new Logger('ErrorNormalizer');

export function normalizeError(
  error: unknown,
  context?: Record<string, any>
): TaskQueueError {
  try {
    // Null/undefined case
    if (error == null) {
      return new TaskQueueError('Unknown error', context);
    }

    // TaskQueueError passthrough
    if (error instanceof TaskQueueError) {
      if (context) {
        error.addContext(context);
      }
      return error;
    }

    // Error objects
    if (error instanceof Error) {
      return new TaskQueueError(error.message, context);
    }

    // Objects with message
    if (typeof error === 'object' && error !== null) {
      const message = 'message' in error 
        ? String(error.message)
        : JSON.stringify(error);
      
      return new TaskQueueError(message, context);
    }

    // Primitive types
    return new TaskQueueError(JSON.stringify(error), context);
  } catch (normalizationError) {
    logger.error('Failed to normalize error', {
      originalError: error,
      normalizationError,
      context
    });
    return new TaskQueueError('Critical error normalization failure');
  }
}

export class TaskQueueError extends Error {
  public context?: Record<string, any>;

  constructor(message: string, context?: Record<string, any>) {
    super(message);
    this.name = this.constructor.name;
    this.context = context;
    Error.captureStackTrace(this, this.constructor);
  }

  addContext(context: Record<string, any>): void {
    this.context = this.context 
      ? { ...this.context, ...context }
      : context;
  }
}