import { execSync } from 'node:child_process';

const TEST_DB_URL = 'postgresql://postgres:postgres@localhost:5432/eztech_test';

// vitest globalSetup — runs once before the entire suite in the main process
export function setup() {
  // apply any pending migrations to test DB (non-destructive), then seed admin
  execSync('npx prisma migrate deploy', {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
    stdio: 'inherit',
  });
  execSync('npx prisma db seed', {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL: TEST_DB_URL,
      ADMIN_EMAIL: 'admin@eztech.fr',
      ADMIN_PASSWORD: 'adminpass123',
    },
    stdio: 'inherit',
  });
}
