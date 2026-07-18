import { MongoClient } from 'mongodb';
import type { Collection, Document } from 'mongodb';
import { env } from '../config/env.js';

// MongoDB native-driver singleton (D-09) — mirrors lib/prisma.ts's global-cache guard so a single
// MongoClient survives `tsx watch` hot-reloads in dev (one per process in prod). Getter form:
// initMongo() connects + creates indexes, getMongo() returns the live client or throws.

// rider GPS positions live in this collection; one upsert-latest doc per active delivery (D-07).
const RIDER_POSITIONS = 'riderPositions';
// TTL: rider positions auto-expire ~24h after write (D-04, GDPR-friendly, no manual cleanup).
const TTL_SECONDS = 86400;

declare global {
  // reuse a single client across hot-reloads in dev; one per process in prod
  var __mongo: MongoClient | undefined;
}

let _client: MongoClient | null = null;

// idempotent — createIndex is a no-op when the index already exists with the same spec.
async function ensureIndexes(client: MongoClient): Promise<void> {
  const col = client.db().collection(RIDER_POSITIONS);
  // 2dsphere for geo queries on the GeoJSON Point (D-07).
  await col.createIndex({ location: '2dsphere' });
  // TTL on the write timestamp — Mongo expires docs ~24h after `at` (D-04).
  await col.createIndex({ at: 1 }, { expireAfterSeconds: TTL_SECONDS });
}

// Connect (or reuse the cached client) and ensure the riderPositions indexes exist.
export async function initMongo(uri: string): Promise<void> {
  if (_client) return;
  const client = globalThis.__mongo ?? new MongoClient(uri);
  await client.connect();
  await ensureIndexes(client);
  _client = client;
  if (env.NODE_ENV !== 'production') globalThis.__mongo = client;
}

// Live client accessor — throws if initMongo has not run (getter pattern, RESEARCH Pattern 2).
export function getMongo(): MongoClient {
  if (!_client) throw new Error('MongoDB not initialized — call initMongo() first');
  return _client;
}

// riderPositions collection helper so handlers/tests share one collection reference.
export function riderPositions<T extends Document = Document>(): Collection<T> {
  return getMongo().db().collection<T>(RIDER_POSITIONS);
}

// Close the client and clear both the module and global caches (extends SIGTERM/SIGINT shutdown, D-09).
export async function closeMongo(): Promise<void> {
  if (_client) {
    await _client.close();
    _client = null;
  }
  globalThis.__mongo = undefined;
}
