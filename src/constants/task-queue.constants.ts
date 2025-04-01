/**
 * Constants for the Task Queue module
 */

// Module tokens
export const TASK_QUEUE_MODULE_OPTIONS = 'TASK_QUEUE_MODULE_OPTIONS';
export const TASK_QUEUE_MODULE_ID = 'TASK_QUEUE_MODULE_ID';

// Default values
export const DEFAULT_QUEUE_NAME = 'default';
export const DEFAULT_QUEUE_TYPE = 'memory';
export const DEFAULT_PRIORITY = 0;
export const DEFAULT_MAX_RETRIES = 3;
export const DEFAULT_RETRY_DELAY = 5000; // 5 seconds
export const DEFAULT_CONCURRENCY = 5;
export const DEFAULT_TASK_TIMEOUT = 30000; // 30 seconds
export const DEFAULT_TASK_TTL = 86400000; // 24 hours
export const DEFAULT_MAX_QUEUE_SIZE = 0; // Unlimited
export const DEFAULT_METRICS_INTERVAL = 5000; // 5 seconds
export const DEFAULT_HEALTH_CHECK_TIMEOUT = 3000; // 3 seconds
export const TASK_HANDLER_METADATA = 'TASK_HANDLER_METADATA';

// Redis constants
export const REDIS_DEFAULT_PREFIX = 'nestjs-task-queue';
export const REDIS_DEFAULT_CONNECTION_NAME = 'nestjs-task-queue-redis';
export const REDIS_DEFAULT_STREAM_GROUP = 'nestjs-task-queue-group';
export const REDIS_DEFAULT_CONSUMER_NAME = 'nestjs-task-queue-consumer';

// RabbitMQ constants
export const RABBITMQ_DEFAULT_QUEUE_OPTIONS = {
  durable: true,
  autoDelete: false,
};
export const RABBITMQ_DEFAULT_EXCHANGE = 'nestjs-task-queue';
export const RABBITMQ_DEFAULT_EXCHANGE_TYPE = 'direct';
export const RABBITMQ_DEFAULT_CONSUMER_OPTIONS = {
  noAck: false,
};

// Memory queue constants
export const MEMORY_QUEUE_DEFAULT_MAX_MEMORY = 100; // MB
export const MEMORY_QUEUE_DEFAULT_PERSIST_INTERVAL = 5000; // 5 seconds

// Event names
export const TASK_EVENTS = {
  ADDED: 'task:added',
  STARTED: 'task:started',
  COMPLETED: 'task:completed',
  FAILED: 'task:failed',
  PROGRESS: 'task:progress',
  REMOVED: 'task:removed',
  RETRY: 'task:retry',
} as const;

export const QUEUE_EVENTS = {
  READY: 'queue:ready',
  PAUSED: 'queue:paused',
  RESUMED: 'queue:resumed',
  DRAINED: 'queue:drained',
  ERROR: 'queue:error',
  HEALTHY: 'queue:healthy',
  UNHEALTHY: 'queue:unhealthy',
} as const;

// Metadata keys
export const TASK_METADATA_KEYS = {
  ORIGIN: 'origin',
  CORRELATION_ID: 'correlationId',
  USER_ID: 'userId',
  REQUEST_ID: 'requestId',
  CLIENT_ID: 'clientId',
} as const;

// Error codes
export const TASK_ERROR_CODES = {
  VALIDATION_FAILED: 'TASK_VALIDATION_FAILED',
  QUEUE_FULL: 'QUEUE_FULL',
  TASK_TIMEOUT: 'TASK_TIMEOUT',
  TASK_EXPIRED: 'TASK_EXPIRED',
  MAX_RETRIES_EXCEEDED: 'MAX_RETRIES_EXCEEDED',
  HANDLER_NOT_FOUND: 'HANDLER_NOT_FOUND',
  QUEUE_NOT_READY: 'QUEUE_NOT_READY',
} as const;

// Status constants
export const QUEUE_STATUS = {
  INITIALIZING: 'initializing',
  READY: 'ready',
  PAUSED: 'paused',
  DRAINED: 'drained',
  ERROR: 'error',
  SHUTTING_DOWN: 'shutting_down',
  CLOSED: 'closed',
} as const;

// Health check constants
export const HEALTH_CHECK_KEYS = {
  QUEUE_CONNECTION: 'queue-connection',
  QUEUE_WORKERS: 'queue-workers',
  QUEUE_THROUGHPUT: 'queue-throughput',
} as const;

// Metrics constants
export const METRIC_NAMES = {
  TASKS_ADDED: 'tasks_added_total',
  TASKS_COMPLETED: 'tasks_completed_total',
  TASKS_FAILED: 'tasks_failed_total',
  TASK_PROCESSING_TIME: 'task_processing_time_seconds',
  QUEUE_SIZE: 'queue_size',
  QUEUE_CONCURRENCY: 'queue_concurrency',
} as const;

// Task states
export const TASK_STATES = {
  PENDING: 'pending',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  FAILED: 'failed',
  DELAYED: 'delayed',
} as const;