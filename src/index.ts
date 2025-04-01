// This file is the entry point for the library and exports all the necessary modules, services, interfaces, decorators, enums, queues, health checks, and metrics.

// modules
export * from './nestjs-task-queue.module';

// services
export * from './services/task-queue.service';
export * from './services/queue-factory.service';
export * from './services/task-logger.service';

// interfaces
export * from './interfaces/task.interface';
export * from './interfaces/queue.interface';
export * from './interfaces/options.interface';
export * from './constants/task-queue.constants';

// constants
export * from './constants/task-queue.constants';

// decorators
export * from './decorators/task-handler.decorator';

// enums
export * from './enums/queue-type.enum';
export { QueueStatus as QueueStatusEnum } from './enums/queue-status.enum';

// errors
export * from './errors/task-queue.errors';

// Queues
export * from './queues/memory.queue';
export * from './queues/redis.queue';
export * from './queues/rabbitmq.queue';

// utils
export { TaskQueueError as UtilsTaskQueueError } from './utils/error.utils';
export * from './utils/redis.util';
export * from './utils/rabbitmq.util';
export * from './utils/redis-lock.util';

// Health Checks
export * from './health/task-queue.health';

// metrics
export * from './metrics/task-metrics.prometheus';
export * from './metrics/task-metrics.service';

// middleware
export * from './middleware/task-logging.middleware';