import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';

// Test MongoDB lifecycle — mirrors tests/helpers/db.ts (single-responsibility helper module).
// Starts an in-memory mongodb-memory-server, exposes its URI, and injects it into
// process.env.MONGODB_URI so buildApp()/initMongo resolve it under test.

let _server: MongoMemoryServer | null = null;
let _client: MongoClient | null = null;

// Started in tests/globalSetup.ts; the helper guards against a missing URI like db.ts does.
export async function startTestMongo(): Promise<string> {
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
async function client(): Promise<MongoClient> {
  if (!_client) {
    _client = new MongoClient(getUri());
    await _client.connect();
  }
  return _client;
}

export async function riderPositions() {
  return (await client()).db().collection('riderPositions');
}

export async function clearRiderPositions(): Promise<void> {
  await (await riderPositions()).deleteMany({});
}
