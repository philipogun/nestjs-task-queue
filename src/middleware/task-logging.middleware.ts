 
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { Task } from '../interfaces/task.interface';

@Injectable()
export class TaskLoggingMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const task: Task = req.body;
    console.log(`[Task Logging] Task ${task.name} received with payload:`, task.payload);
    next();
  }
}