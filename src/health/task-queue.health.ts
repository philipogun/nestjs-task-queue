import { Injectable } from '@nestjs/common';
import { HealthCheckService, HealthIndicatorResult } from '@nestjs/terminus';
import { Queue } from '../interfaces/queue.interface.js';

@Injectable()
export class TaskQueueHealth {
  constructor(
    private readonly queue: Queue,
    private readonly healthCheckService: HealthCheckService,
  ) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      // Perform a health check by adding a dummy task to the queue
      await this.queue.add({ name: 'health-check', payload: {} });

      // If the task is added successfully, return a healthy status
      return {
        [key]: {
          status: 'up',
        },
      };
    } catch (error) {
      // If an error occurs, return an unhealthy status with the error message
      return {
        [key]: {
          status: 'down',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }
}