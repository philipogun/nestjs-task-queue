import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Task } from '../interfaces/task.interface';
import { TASK_EVENTS } from '../constants/task-queue.constants';

@Injectable()
export class TaskMetricsService {
  private metrics = {
    tasksAdded: 0,
    tasksCompleted: 0,
    tasksFailed: 0,
    tasksRetried: 0,
    totalProcessingTime: 0,
    lastUpdated: new Date(),
  };

  constructor(private readonly eventEmitter: EventEmitter2) {
    this.registerListeners();
  }

  private registerListeners() {
    this.eventEmitter.on(TASK_EVENTS.ADDED, () => this.metrics.tasksAdded++);
    this.eventEmitter.on(TASK_EVENTS.COMPLETED, () => this.metrics.tasksCompleted++);
    this.eventEmitter.on(TASK_EVENTS.FAILED, () => this.metrics.tasksFailed++);
    this.eventEmitter.on(TASK_EVENTS.RETRY, () => this.metrics.tasksRetried++);
    
    this.eventEmitter.on(TASK_EVENTS.COMPLETED, (task: Task) => {
      if (task.startedAt && task.completedAt) {
        const duration = task.completedAt.getTime() - task.startedAt.getTime();
        this.metrics.totalProcessingTime += duration;
      }
    });
  }

  getMetrics() {
    const now = new Date();
    const timeWindow = now.getTime() - this.metrics.lastUpdated.getTime();
    const throughput = timeWindow > 0 
      ? (this.metrics.tasksCompleted / (timeWindow / 1000)).toFixed(2)
      : 0;

    return {
      ...this.metrics,
      throughput: parseFloat(throughput.toString()),
      avgProcessingTime: this.metrics.tasksCompleted > 0
        ? (this.metrics.totalProcessingTime / this.metrics.tasksCompleted).toFixed(2)
        : 0,
      lastUpdated: this.metrics.lastUpdated,
    };
  }

  resetMetrics() {
    this.metrics = {
      tasksAdded: 0,
      tasksCompleted: 0,
      tasksFailed: 0,
      tasksRetried: 0,
      totalProcessingTime: 0,
      lastUpdated: new Date(),
    };
  }
}