import pino from 'pino';
import { env } from '../config/env.js';

// pretty-print only in dev; structured JSON in prod for log aggregators
export const logger = pino({
  level: env.LOG_LEVEL,
  ...(env.NODE_ENV === 'development' && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:HH:MM:ss' },
    },
  }),
});
