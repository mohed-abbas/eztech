import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { startTestMongo, stopTestMongo } from './helpers/mongo.js';

const TEST_DB_URL = 'postgresql://postgres:postgres@localhost:5432/eztech_test';

// Write the live test MONGODB_URI back into .env.test so the forked worker's tests/setup.ts
// (override-always loader) picks it up — globalSetup runs in the main process and its
// process.env does not propagate to the singleFork worker.
function persistMongoUri(uri: string) {
  const envFile = resolve(process.cwd(), '.env.test');
  if (!existsSync(envFile)) return;
  const lines = readFileSync(envFile, 'utf-8').split('\n');
  let found = false;
  const next = lines.map((line) => {
    if (line.trim().startsWith('MONGODB_URI=')) {
      found = true;
      return `MONGODB_URI=${uri}`;
    }
    return line;
  });
  if (!found) next.push(`MONGODB_URI=${uri}`);
  writeFileSync(envFile, next.join('\n'));
}

// vitest globalSetup — runs once before the entire suite in the main process
export async function setup() {
  // CI supplies MONGODB_URI pointing at a service container — skip mongodb-memory-server
  // entirely in that case and leave the pre-set URI in place. Local dev (no MONGODB_URI)
  // still starts the in-memory server and persists its URI for the forked worker.
  const startedInMemory = !process.env['MONGODB_URI'];
  if (startedInMemory) {
    const mongoUri = await startTestMongo();
    persistMongoUri(mongoUri);
  }

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

  // teardown — only stop the in-memory MongoDB if this process actually started it
  return async () => {
    if (startedInMemory) {
      await stopTestMongo();
    }
  };
}
