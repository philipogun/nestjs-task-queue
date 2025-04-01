import Redis from 'ioredis';
import { Test } from '@nestjs/testing';
import { TaskQueueModule } from '../src/task-queue.module';

module.exports = async () => {
  // Start any required services (Redis, RabbitMQ containers)
  // This runs once before all tests
  global.__TEST_CONTAINERS__ = {
    redis: new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
    }),
  };

  // Initialize test module
  global.__TEST_MODULE__ = await Test.createTestingModule({
    imports: [
      TaskQueueModule.forRoot({
        queueType: 'memory', // Default to memory for most tests
      }),
    ],
  }).compile();
};