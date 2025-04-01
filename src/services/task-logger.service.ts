import { Injectable, Logger } from '@nestjs/common';
import { Task } from '../interfaces/task.interface';
import { TaskQueueError } from '../errors/task-queue.errors';
import { TASK_EVENTS, QUEUE_EVENTS } from '../constants/task-queue.constants';

@Injectable()
export class TaskLoggerService {
  private readonly logger = new Logger('TaskQueue');

  logEvent(event: string, message: string, context?: Record<string, any>) {
    const logContext = context ? JSON.stringify(context) : '';
    switch (event) {
      case TASK_EVENTS.ADDED:
        this.logger.log(`[Task Added] ${message}`, logContext);
        break;
      case TASK_EVENTS.STARTED:
        this.logger.debug(`[Task Started] ${message}`, logContext);
        break;
      case TASK_EVENTS.COMPLETED:
        this.logger.log(`[Task Completed] ${message}`, logContext);
        break;
      case TASK_EVENTS.FAILED:
        this.logger.error(`[Task Failed] ${message}`, logContext);
        break;
      case QUEUE_EVENTS.ERROR:
        this.logger.error(`[Queue Error] ${message}`, logContext);
        break;
      default:
        this.logger.verbose(`[${event}] ${message}`, logContext);
    }
  }

  logTaskLifecycle(task: Task, event: keyof typeof TASK_EVENTS, metadata?: Record<string, any>) {
    const context = {
      taskId: task.id,
      taskName: task.name,
      ...metadata,
    };
    this.logEvent(event, `Task ${task.id} (${task.name})`, context);
  }

  logQueueEvent(queueName: string, event: keyof typeof QUEUE_EVENTS, metrics?: Record<string, any>) {
    const context = {
      queueName,
      ...metrics,
    };
    this.logEvent(event, `Queue ${queueName}`, context);
  }

  logError(error: TaskQueueError, context?: Record<string, any>) {
    const errorContext = {
      error: error.message,
      stack: error.stack,
      ...context,
    };
    this.logger.error(`[Error] ${error.message}`, JSON.stringify(errorContext));
  }

  logTaskProcessingTime(task: Task, durationMs: number) {
    this.logger.debug(
      `Task ${task.id} completed in ${durationMs}ms`,
      { taskId: task.id, durationMs },
    );
  }
}