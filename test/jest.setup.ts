import 'jest-extended';
import { Logger } from '@nestjs/common';

// Disable NestJS logging during tests
Logger.overrideLogger(true);