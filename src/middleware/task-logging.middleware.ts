import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TaskLoggerService } from '../services/task-logger.service';
import { TASK_EVENTS } from '../constants/task-queue.constants';

@Injectable()
export class TaskLoggingMiddleware implements NestMiddleware {
  constructor(private readonly taskLogger: TaskLoggerService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    const { method, originalUrl, ip, headers } = req;

    // Skip health checks
    if (originalUrl === '/health') return next();

    // Log request start
    this.taskLogger.logEvent(TASK_EVENTS.STARTED, `${method} ${originalUrl}`, {
      method,
      path: originalUrl,
      ip,
      userAgent: headers['user-agent'],
      referrer: headers['referer'],
    });

    // Response finish handler
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const { statusCode } = res;

      // Log response
      this.taskLogger.logEvent(
        statusCode >= 400 ? TASK_EVENTS.FAILED : TASK_EVENTS.COMPLETED,
        `${method} ${originalUrl}`,
        {
          statusCode,
          durationMs: duration,
          method,
          path: originalUrl,
          ip,
          userAgent: headers['user-agent'],
        }
      );
    });

    // Error handler
    res.on('error', (error) => {
      const duration = Date.now() - startTime;
      this.taskLogger.logEvent(TASK_EVENTS.FAILED, `${method} ${originalUrl}`, {
        statusCode: res.statusCode,
        durationMs: duration,
        error: error.message,
        stack: error.stack,
        method,
        path: originalUrl,
        ip,
      });
    });

    next();
  }
}