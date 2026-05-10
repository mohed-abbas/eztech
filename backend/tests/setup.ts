import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Load .env.test if present; otherwise rely on process.env already set by the caller.
// Run `cp .env.test.example .env.test` and edit before running tests locally.
const envFile = resolve(process.cwd(), '.env.test');
if (existsSync(envFile)) {
  const lines = readFileSync(envFile, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...rest] = trimmed.split('=');
    // always override — ensures .env.test wins over any previously loaded .env
    if (key) process.env[key] = rest.join('=');
  }
}
