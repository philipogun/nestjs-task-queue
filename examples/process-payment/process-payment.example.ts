 
import { Injectable } from '@nestjs/common';
import { TaskQueueService } from '../../src/services/task-queue.service';
import { Task } from '../../src/interfaces/task.interface';

@Injectable()
export class ProcessPaymentExample {
  constructor(private readonly taskQueueService: TaskQueueService) {}

  async processPayment(orderId: string, amount: number): Promise<void> {
    const task: Task = {
      name: 'process-payment',
      payload: { orderId, amount },
    };
    await this.taskQueueService.addTask(task);
  }
}