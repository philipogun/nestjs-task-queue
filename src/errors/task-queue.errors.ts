export class TaskQueueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class TaskValidationError extends TaskQueueError {
  constructor(
    message: string,
    public readonly field?: string,
    public readonly value?: any,
  ) {
    super(message);
  }
}

export class TaskProcessingError extends TaskQueueError {
  constructor(
    message: string,
    public readonly task: any,
    public readonly originalError?: Error,
  ) {
    super(message);
  }
}

export class QueueConnectionError extends TaskQueueError {
  constructor(
    message: string,
    public readonly queueType: string,
    public readonly originalError: Error,
  ) {
    super(message);
  }
}

export class QueueFullError extends TaskQueueError {
  constructor(
    message: string,
    public readonly queueName: string,
    public readonly maxSize: number,
  ) {
    super(message);
  }
}

export class TaskNotFoundError extends TaskQueueError {
  constructor(taskId: string) {
    super(`Task with ID ${taskId} not found`);
  }
}

export class QueueNotReadyError extends TaskQueueError {
  constructor(queueName: string) {
    super(`Queue ${queueName} is not ready`);
  }
}