import { z } from 'zod';

const Env = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_ACCESS_TTL: z.string().regex(/^\d+[smhdwy]$/, 'invalid TTL format').default('15m'),
  JWT_REFRESH_TTL: z.string().regex(/^\d+[smhdwy]$/, 'invalid TTL format').default('30d'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  // Stripe — fail-fast if missing; never logged (no pino redact exemption)
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_PUBLISHABLE_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  // single source of truth for the delivery fee (D-07); the frontend renders this value
  DELIVERY_FEE: z.coerce.number().nonnegative().default(4.99),
});

const parsed = Env.safeParse(process.env);
if (!parsed.success) {
  // fail-fast on misconfiguration so the process never reaches app.listen with bad env
  console.error('invalid environment configuration:');
  console.error(parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
