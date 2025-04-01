import { DynamicModule, Module, Provider } from '@nestjs/common';
import { TaskQueueService } from './services/task-queue.service';
import { QueueFactoryService } from './services/queue-factory.service';
import { TaskLoggerService } from './services/task-logger.service';
import { TaskQueueModuleOptions } from './interfaces/options.interface';
import { TASK_QUEUE_MODULE_OPTIONS } from './constants/task-queue.constants';
import { TaskMetricsPrometheus } from './metrics/task-metrics.prometheus';

@Module({})
export class NestJsTaskQueueModule {
  static forRoot(options: TaskQueueModuleOptions): DynamicModule {
    const providers: Provider[] = [
      {
        provide: TASK_QUEUE_MODULE_OPTIONS,
        useValue: options,
      },
      TaskLoggerService,
      TaskMetricsPrometheus,
      QueueFactoryService,
      TaskQueueService,
    ];

    return {
      module: NestJsTaskQueueModule,
      providers,
      exports: [TaskQueueService],
    };
  }

  static forRootAsync(options: {
    useFactory: (...args: any[]) => Promise<TaskQueueModuleOptions> | TaskQueueModuleOptions;
    inject?: any[];
  }): DynamicModule {
    const providers: Provider[] = [
      {
        provide: TASK_QUEUE_MODULE_OPTIONS,
        useFactory: options.useFactory,
        inject: options.inject || [],
      },
      TaskLoggerService,
      TaskMetricsPrometheus,
      QueueFactoryService,
      TaskQueueService,
    ];

    return {
      module: NestJsTaskQueueModule,
      providers,
      exports: [TaskQueueService],
    };
  }
}