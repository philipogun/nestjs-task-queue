 
import { Test, TestingModule } from '@nestjs/testing';
import { TaskQueueService } from '../../../src/services/task-queue.service';
import { QueueType } from '../../../src/enums/queue-type.enum';
import { MemoryQueue } from '../../../src/queues/memory.queue';

describe('TaskQueueService', () => {
  let taskQueueService: TaskQueueService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskQueueService,
        {
          provide: 'TASK_QUEUE_MODULE_OPTIONS',
          useValue: { defaultQueue: QueueType.MEMORY },
        },
      ],
    }).compile();

    taskQueueService = module.get<TaskQueueService>(TaskQueueService);
  });

  it('should create a memory queue by default', () => {
    expect(taskQueueService).toBeDefined();
    expect(taskQueueService['queue']).toBeInstanceOf(MemoryQueue);
  });

  it('should add a task to the queue', async () => {
    const task = { name: 'test', payload: {} };
    await taskQueueService.addTask(task);
    // Add assertions based on the queue implementation
  });

  it('should process tasks from the queue', async () => {
    const handler = jest.fn().mockResolvedValue(undefined);
    await taskQueueService.processTasks(handler);
    // Add assertions based on the queue implementation
  });
});