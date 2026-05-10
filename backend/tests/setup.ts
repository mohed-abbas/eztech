import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const envFile = resolve(process.cwd(), '.env.test');
const lines = readFileSync(envFile, 'utf-8').split('\n');
for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const [key, ...rest] = trimmed.split('=');
  // always override — ensures .env.test wins over any previously loaded .env
  if (key) process.env[key] = rest.join('=');
}
