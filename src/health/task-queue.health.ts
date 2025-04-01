import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { QueueFactoryService } from '../services/queue-factory.service';

@Injectable()
export class TaskQueueHealth extends HealthIndicator {
  constructor(private readonly queueFactory: QueueFactoryService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      // Check Redis connection if used
      if (this.queueFactory['redisClient']) {
        await this.queueFactory['redisClient'].ping();
      }

      // Check RabbitMQ connection if used
      if (this.queueFactory['rabbitMQChannelModel']) {
        const channel = await this.queueFactory['rabbitMQChannelModel'].createChannel();
        await channel.close();
      }

      return this.getStatus(key, true, {
        status: 'connected',
        backends: this.getActiveBackends(),
      });
    } catch (error) {
      throw new HealthCheckError(
        'TaskQueue health check failed',
        this.getStatus(key, false, {
          error: (error instanceof Error ? error.message : String(error)),
          backends: this.getActiveBackends(),
        }),
      );
    }
  }

  private getActiveBackends(): string[] {
    const backends = [];
    if (this.queueFactory['redisClient']) backends.push('redis');
    if (this.queueFactory['rabbitMQChannelModel']) backends.push('rabbitmq');
    return backends;
  }

}

