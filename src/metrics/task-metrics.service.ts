 
import { Injectable } from '@nestjs/common';

@Injectable()
export class TaskMetricsService {
  private readonly metrics = {
    totalTasks: 0,
    completedTasks: 0,
    failedTasks: 0,
  };

  trackTaskAdded(): void {
    this.metrics.totalTasks++;
  }

  trackTaskCompleted(): void {
    this.metrics.completedTasks++;
  }

  trackTaskFailed(): void {
    this.metrics.failedTasks++;
  }

  getMetrics() {
    return this.metrics;
  }
}