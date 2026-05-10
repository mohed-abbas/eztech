import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';

// reuse a single client across hot-reloads in dev; one per process in prod
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.__prisma ??
  new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['warn', 'error'],
  });

if (env.NODE_ENV !== 'production') globalThis.__prisma = prisma;
