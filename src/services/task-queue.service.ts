import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Queue } from '../interfaces/queue.interface';
import { Task } from '../interfaces/task.interface';
import { QueueFactoryService } from './queue-factory.service';
import { Reflector } from '@nestjs/core';
import { TASK_EVENTS, TASK_HANDLER_METADATA, QUEUE_EVENTS } from '../constants/task-queue.constants';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import { Module } from '@nestjs/core/injector/module';
import { ModulesContainer } from '@nestjs/core/injector/modules-container';
import { TaskLoggerService } from './task-logger.service';
import { 
  TaskQueueError,
  TaskValidationError, 
  QueueNotReadyError, 
  QueueConnectionError,
  TaskProcessingError
} from '../errors/task-queue.errors';
import { QueueType } from '../enums/queue-type.enum';

@Injectable()
export class TaskQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly queues = new Map<string, Queue>();
  private readonly handlers = new Map<
    string,
    {
      handler: (task: Task) => Promise<void>;
      concurrency: number;
      queueName: string;
    }
  >();

  constructor(
    private readonly queueFactory: QueueFactoryService,
    private readonly modulesContainer: ModulesContainer,
    private readonly reflector: Reflector,
    private readonly taskLogger: TaskLoggerService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      this.registerHandlers();
      await this.initializeQueues();
    } catch (error) {
      this.handleError(error, { context: 'Module initialization' });
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.shutdownQueues();
    } catch (error) {
      this.handleError(error, { context: 'Module destruction' });
    }
  }

  private registerHandlers(): void {
    const modules = [...this.modulesContainer.values()];
    for (const module of modules) {
      this.registerModuleHandlers(module);
    }
  }

  private registerModuleHandlers(module: Module): void {
    const providers = [...module.providers.values()];
    const controllers = [...module.controllers.values()];

    for (const provider of [...providers, ...controllers]) {
      this.registerProviderHandlers(provider);
    }
  }

  private registerProviderHandlers(provider: InstanceWrapper): void {
    if (!provider.instance) return;

    const instance = provider.instance;
    const prototype = Object.getPrototypeOf(instance);

    for (const methodName of Object.getOwnPropertyNames(prototype)) {
      const method = prototype[methodName];
      const metadata = this.reflector.get(TASK_HANDLER_METADATA, method);

      if (metadata) {
        const { name, concurrency = 1, queue = 'default' } = metadata;
        this.handlers.set(name, {
          handler: async (task: Task) => {
            try {
              return await method.call(instance, task);
            } catch (error) {
              throw this.createTaskProcessingError(task, error);
            }
          },
          concurrency,
          queueName: queue,
        });
      }
    }
  }

  private createTaskProcessingError(task: Task, error: unknown): TaskProcessingError {
    const normalizedError = this.normalizeError(error);
    this.taskLogger.logEvent(
      TASK_EVENTS.FAILED,
      `Handler failed for task ${task.id}`,
      { 
        taskId: task.id,
        error: normalizedError.message,
        stack: normalizedError.stack 
      }
    );
    return new TaskProcessingError(
      `Task processing failed: ${normalizedError.message}`,
      task,
      normalizedError
    );
  }

  private async initializeQueues(): Promise<void> {
    for (const [taskName, { queueName, concurrency }] of this.handlers) {
      try {
        if (!this.queues.has(queueName)) {
          const queue = await this.queueFactory.createQueue(
            QueueType.REDIS,
            queueName,
            { concurrency },
          );
          this.queues.set(queueName, queue);
          this.setupQueueListeners(queue);
          this.taskLogger.logEvent(
            QUEUE_EVENTS.READY,
            `Queue initialized`,
            { 
              queueName,
              taskName,
              concurrency 
            }
          );
        }
      } catch (error) {
        throw new QueueConnectionError(
          `Failed to initialize queue ${queueName}`,
          'redis',
          this.normalizeError(error)
        );
      }
    }

    for (const [taskName, { handler, queueName }] of this.handlers) {
      const queue = this.queues.get(queueName);
      if (queue) {
        queue.process(handler);
        this.taskLogger.logEvent(
          TASK_EVENTS.ADDED,
          `Handler registered`,
          { 
            taskName,
            queueName 
          }
        );
      }
    }
  }

  private setupQueueListeners(queue: Queue): void {
    queue.on(TASK_EVENTS.ADDED, (task: Task) => {
      this.taskLogger.logTaskLifecycle(task, "ADDED", {
        queueName: queue.getName()
      });

    });

    queue.on(TASK_EVENTS.STARTED, (task: Task) => {
      this.taskLogger.logTaskLifecycle(task, "STARTED", {
        queueName: queue.getName()
      });
    });

    queue.on(TASK_EVENTS.COMPLETED, (task: Task) => {
      const duration = task.startedAt && task.completedAt 
        ? task.completedAt.getTime() - task.startedAt.getTime()
        : 0;
      this.taskLogger.logTaskLifecycle(task, "COMPLETED", {
        queueName: queue.getName(),
        durationMs: duration
      });
    });

    queue.on(TASK_EVENTS.FAILED, (task: Task, error: Error) => {
      this.taskLogger.logTaskLifecycle(task, "FAILED", {
        queueName: queue.getName(),
        error: error.message,
        stack: error.stack
      });
    });

    queue.on(QUEUE_EVENTS.ERROR, (error: Error) => {
      this.taskLogger.logError(this.normalizeError(error), {
        queueName: queue.getName(),
        event: QUEUE_EVENTS.ERROR
      });
    });
  }

  private async shutdownQueues(): Promise<void> {
    await Promise.all(
      Array.from(this.queues.values()).map(async (queue) => {
        try {
          await queue.shutdown();
          this.taskLogger.logEvent(
            QUEUE_EVENTS.ERROR,
            `Queue shutdown`,
            { queueName: queue.getName() }
          );
        } catch (error) {
          this.handleError(error, {
            queueName: queue.getName(),
            context: 'Queue shutdown'
          });
        }
      })
    );
    this.queues.clear();
  }

  async addTask<T>(queueName: string, task: Task<T>): Promise<void> {
    try {
      this.validateTask(task);
      
      if (!this.queues.has(queueName)) {
        throw new QueueNotReadyError(queueName);
      }

      const queue = this.queues.get(queueName);
      if (!queue) {
        throw new Error(`Queue ${queueName} not found`);
      }

      task = this.setTaskDefaults(task);
      await queue.add(task);
    } catch (error) {
      this.handleError(error, {
        taskId: task.id,
        queueName,
        context: 'Adding task'
      });
    }
  }

  private setTaskDefaults<T>(task: Task<T>): Task<T> {
    return {
      ...task,
      id: task.id || this.generateTaskId(),
      createdAt: task.createdAt || new Date(),
      priority: task.priority ?? 0,
    };
  }

  private generateTaskId(): string {
    return `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  }

  private validateTask<T>(task: Task<T>): void {
    if (!task.name) {
      throw new TaskValidationError('Task name is required');
    }
    if (!task.payload) {
      throw new TaskValidationError('Task payload is required');
    }
    if (task.priority && (task.priority < 0 || task.priority > 100)) {
      throw new TaskValidationError('Task priority must be between 0 and 100');
    }
  }

  private normalizeError(error: unknown): TaskQueueError {
    if (error instanceof TaskQueueError) {
      return error;
    }
    
    if (error instanceof Error) {
      return new TaskQueueError(error.message);
    }

    return new TaskQueueError(String(error));
  }

  private handleError(error: unknown, context: Record<string, any> = {}): never {
    const normalizedError = this.normalizeError(error);
    this.taskLogger.logError(normalizedError, context);
    throw normalizedError;
  }

  async getQueue(queueName: string): Promise<Queue | undefined> {
    return this.queues.get(queueName);
  }

  async getQueueStatus(queueName: string): Promise<any> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }
    return queue.getStatus();
  }

  async pauseQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }
    await queue.pause();
  }

  async resumeQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }
    await queue.resume();
  }
}