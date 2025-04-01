/**
 * Queue status enum
 */
export enum QueueStatus {
    INITIALIZING = 'initializing',
    READY = 'ready',
    PAUSED = 'paused',
    DRAINED = 'drained',
    ERROR = 'error',
    SHUTTING_DOWN = 'shutting_down',
    CLOSED = 'closed'
  }