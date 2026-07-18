import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';

// Test MongoDB lifecycle — mirrors tests/helpers/db.ts (single-responsibility helper module).
// Starts an in-memory mongodb-memory-server, exposes its URI, and injects it into
// process.env.MONGODB_URI so buildApp()/initMongo resolve it under test.

let _server: MongoMemoryServer | null = null;
let _client: MongoClient | null = null;

// Started in tests/globalSetup.ts; the helper guards against a missing URI like db.ts does.
// When MONGODB_URI is already set (CI service container), this is a no-op that returns
// the existing URI — mongodb-memory-server never starts.
export async function startTestMongo(): Promise<string> {
  const preset = process.env['MONGODB_URI'];
  if (preset) return preset;
  if (_server) return _server.getUri();
  _server = await MongoMemoryServer.create();
  const uri = _server.getUri();
  process.env['MONGODB_URI'] = uri;
  return uri;
}

export async function stopTestMongo(): Promise<void> {
  if (_client) {
    await _client.close();
    _client = null;
  }
  if (_server) {
    await _server.stop();
    _server = null;
  }
}

function getUri(): string {
  const uri = process.env['MONGODB_URI'];
  if (!uri) throw new Error('MONGODB_URI must be set before importing the test mongo helper');
  return uri;
}

// Lazy client bound to the test URI — used by tests to seed/assert riderPositions directly.
// Self-healing: a failed connect() must NOT leave a poisoned client cached, or every remaining
// test in the file instantly fails with MongoTopologyClosedError instead of retrying (this was the
// root cause of a whole-suite cascade when the very first connection attempt hit a transient
// hiccup). serverSelectionTimeoutMS bounds a bad connection to well under vitest's hook timeout
// instead of hanging until the driver's default (~30s) and blowing through it.
async function client(): Promise<MongoClient> {
  if (_client) return _client;
  const candidate = new MongoClient(getUri(), { serverSelectionTimeoutMS: 5000 });
  try {
    await candidate.connect();
  } catch (err) {
    await candidate.close().catch(() => undefined);
    throw err;
  }
  _client = candidate;
  return _client;
}

export async function riderPositions() {
  return (await client()).db().collection('riderPositions');
}

export async function clearRiderPositions(): Promise<void> {
  await (await riderPositions()).deleteMany({});
}
