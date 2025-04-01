import { Injectable } from '@nestjs/common';
import { Counter, Gauge, Histogram, Registry } from 'prom-client';

@Injectable()
export class TaskMetricsPrometheus {
  public readonly registry = new Registry();
  public readonly tasksAdded: Counter<string>;
  public readonly tasksCompleted: Counter<string>;
  public readonly tasksFailed: Counter<string>;
  public readonly taskProcessingTime: Histogram<string>;
  public readonly queueSize: Gauge<string>;

  constructor() {
    this.registry.setDefaultLabels({
      app: 'nestjs-task-queue',
    });

    this.tasksAdded = new Counter({
      name: 'task_queue_tasks_added_total',
      help: 'Total number of tasks added to the queue',
      labelNames: ['queue'],
      registers: [this.registry],
    });

    this.tasksCompleted = new Counter({
      name: 'task_queue_tasks_completed_total',
      help: 'Total number of tasks completed successfully',
      labelNames: ['queue', 'task'],
      registers: [this.registry],
    });

    this.tasksFailed = new Counter({
      name: 'task_queue_tasks_failed_total',
      help: 'Total number of tasks that failed',
      labelNames: ['queue', 'task', 'error'],
      registers: [this.registry],
    });

    this.taskProcessingTime = new Histogram({
      name: 'task_queue_processing_time_seconds',
      help: 'Time taken to process tasks',
      labelNames: ['queue', 'task'],
      buckets: [0.1, 0.5, 1, 2, 5, 10],
      registers: [this.registry],
    });

    this.queueSize = new Gauge({
      name: 'task_queue_size',
      help: 'Current size of the queue',
      labelNames: ['queue'],
      registers: [this.registry],
    });

    require('prom-client').collectDefaultMetrics({
      register: this.registry,
      prefix: 'task_queue_',
    });
  }

  recordTaskAdded(queueName: string) {
    this.tasksAdded.labels(queueName).inc();
  }

  recordTaskCompleted(queueName: string, taskName: string, durationMs: number) {
    this.tasksCompleted.labels(queueName, taskName).inc();
    this.taskProcessingTime
      .labels(queueName, taskName)
      .observe(durationMs / 1000);
  }

  recordTaskFailed(queueName: string, taskName: string, error: Error) {
    this.tasksFailed
      .labels(queueName, taskName, error.constructor.name)
      .inc();
  }

  updateQueueSize(queueName: string, size: number) {
    this.queueSize.labels(queueName).set(size);
  }

  async getMetrics() {
    return this.registry.metrics();
  }
}