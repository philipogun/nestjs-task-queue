 
import { Injectable } from '@nestjs/common';
import { TaskQueueService } from '../../src/services/task-queue.service';
import { Task } from '../../src/interfaces/task.interface';

@Injectable()
export class SendEmailExample {
  constructor(private readonly taskQueueService: TaskQueueService) {}

  async sendEmail(to: string, subject: string, body: string): Promise<void> {
    const task: Task = {
      name: 'send-email',
      payload: { to, subject, body },
    };
    await this.taskQueueService.addTask(task);
  }
}