import { Module } from '@nestjs/common';
import { NestjsTaskQueueService } from './nestjs-task-queue.service';

@Module({
  providers: [NestjsTaskQueueService],
  exports: [NestjsTaskQueueService],
})
export class NestjsTaskQueueModule {}
