import { describe, it, expect, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { buildApp } from '../src/app.js';
import { truncateAuthTables, testPrisma } from './helpers/db.js';
import { issueVerificationToken, consumeVerificationToken } from '../src/lib/verification-token.js';

const app = buildApp();

const USER = {
  email: 'verify-me@example.com',
  password: 'password123',
  name: 'Verify Me',
  phone: '0600000000',
};

type AuthResponse = { user: { id: string; emailVerifiedAt: string | null }; token: string };
type ErrorResponse = { error: string };

describe('email verification — registration side effects', () => {
  beforeEach(truncateAuthTables);

  it('registers a customer as unverified and issues exactly one verification token', async () => {
    const res = await request(app).post('/api/auth/register').send(USER);
    const body = res.body as AuthResponse;
    expect(res.status).toBe(201);
    expect(body.user.emailVerifiedAt).toBeNull();

    const tokens = await testPrisma.emailVerificationToken.findMany({ where: { userId: body.user.id } });
    expect(tokens).toHaveLength(1);
    expect(tokens[0]?.usedAt).toBeNull();
  });
});

describe('POST /api/auth/verify-email', () => {
  beforeEach(truncateAuthTables);

  it('consumes a valid token and stamps emailVerifiedAt', async () => {
    const user = await testPrisma.user.create({
      data: { email: `v-${randomUUID()}@example.com`, name: 'V', phone: '', passwordHash: 'x' },
    });
    const raw = await issueVerificationToken(user.id);

    const res = await request(app).post('/api/auth/verify-email').send({ token: raw });
    expect(res.status).toBe(200);

    const after = await testPrisma.user.findUnique({ where: { id: user.id } });
    expect(after?.emailVerifiedAt).not.toBeNull();
  });

  it('rejects an unknown token with 400', async () => {
    const res = await request(app).post('/api/auth/verify-email').send({ token: 'not-a-real-token' });
    expect(res.status).toBe(400);
    expect((res.body as ErrorResponse).error).toBe('invalid_or_expired_token');
  });

  it('is single-use — a second consume of the same token fails', async () => {
    const user = await testPrisma.user.create({
      data: { email: `v-${randomUUID()}@example.com`, name: 'V', phone: '', passwordHash: 'x' },
    });
    const raw = await issueVerificationToken(user.id);

    expect(await consumeVerificationToken(raw)).toBe(user.id);
    expect(await consumeVerificationToken(raw)).toBeNull();
  });

  it('rejects an expired token', async () => {
    const user = await testPrisma.user.create({
      data: { email: `v-${randomUUID()}@example.com`, name: 'V', phone: '', passwordHash: 'x' },
    });
    const raw = await issueVerificationToken(user.id);
    // force the row to be already expired
    await testPrisma.emailVerificationToken.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const res = await request(app).post('/api/auth/verify-email').send({ token: raw });
    expect(res.status).toBe(400);
    const after = await testPrisma.user.findUnique({ where: { id: user.id } });
    expect(after?.emailVerifiedAt).toBeNull();
  });

  it('returns 422 for a missing token', async () => {
    const res = await request(app).post('/api/auth/verify-email').send({});
    expect(res.status).toBe(422);
  });
});

describe('POST /api/auth/resend-verification', () => {
  beforeEach(truncateAuthTables);

  it('issues a fresh token for a real, unverified account (always 200)', async () => {
    const user = await testPrisma.user.create({
      data: { email: `re-${randomUUID()}@example.com`, name: 'R', phone: '', passwordHash: 'x' },
    });

    const res = await request(app).post('/api/auth/resend-verification').send({ email: user.email });
    expect(res.status).toBe(200);
    const tokens = await testPrisma.emailVerificationToken.findMany({ where: { userId: user.id } });
    expect(tokens.length).toBeGreaterThanOrEqual(1);
  });

  it('is enumeration-safe: 200 for an unknown address, no token created', async () => {
    const before = await testPrisma.emailVerificationToken.count();
    const res = await request(app).post('/api/auth/resend-verification').send({ email: `ghost-${randomUUID()}@example.com` });
    expect(res.status).toBe(200);
    expect(await testPrisma.emailVerificationToken.count()).toBe(before);
  });

  it('does not re-issue for an already-verified account', async () => {
    const user = await testPrisma.user.create({
      data: { email: `done-${randomUUID()}@example.com`, name: 'D', phone: '', passwordHash: 'x', emailVerifiedAt: new Date() },
    });

    const res = await request(app).post('/api/auth/resend-verification').send({ email: user.email });
    expect(res.status).toBe(200);
    expect(await testPrisma.emailVerificationToken.count({ where: { userId: user.id } })).toBe(0);
  });
});

describe('order gate — email must be verified before first order', () => {
  beforeEach(truncateAuthTables);

  async function registerCustomer() {
    const res = await request(app).post('/api/auth/register').send({
      email: `gate-${randomUUID()}@example.com`, password: 'password123', name: 'Gate', phone: '',
    });
    return res.body as AuthResponse;
  }

  const commerceBody = {
    items: [{ productId: randomUUID(), quantity: 1, durationUnit: 'daily', durationValue: 1 }],
    dropoff: { address: '1 rue de Paris', lat: 48.8566, lng: 2.3522 },
  };

  it('blocks an unverified customer with 403 email_not_verified', async () => {
    const { token } = await registerCustomer();
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send(commerceBody);
    expect(res.status).toBe(403);
    expect((res.body as ErrorResponse).error).toBe('email_not_verified');
  });

  it('lets a verified customer past the email gate', async () => {
    const { user, token } = await registerCustomer();
    await testPrisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send(commerceBody);
    // past the gate: the request now fails later in the pipeline (no such product), never 403 here
    expect(res.status).not.toBe(403);
    expect((res.body as ErrorResponse).error).not.toBe('email_not_verified');
  });
});
