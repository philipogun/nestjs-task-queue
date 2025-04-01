 
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from '../interfaces/queue.interface';
import { Task } from '../interfaces/task.interface';

@Injectable()
export class MemoryQueue implements Queue, OnModuleDestroy {
  private tasks: Task[] = [];

  async add(task: Task): Promise<void> {
    this.tasks.push(task);
    this.tasks.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }

  process(handler: (task: Task) => Promise<void>): void {
    (async () => {
      while (this.tasks.length > 0) {
        const task = this.tasks.shift();
        if (task) await handler(task);
      }
    })();
  }

  async shutdown(): Promise<void> {
    this.tasks = [];
  }

  onModuleDestroy() {
    this.shutdown();
  }
}