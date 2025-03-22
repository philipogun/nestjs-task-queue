import { Test, TestingModule } from '@nestjs/testing';
import { NestjsTaskQueueService } from './nestjs-task-queue.service';

describe('NestjsTaskQueueService', () => {
  let service: NestjsTaskQueueService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NestjsTaskQueueService],
    }).compile();

    service = module.get<NestjsTaskQueueService>(NestjsTaskQueueService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
