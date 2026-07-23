import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import request from 'supertest';

// Mock the Google verifier so tests never hit Google. mockVerify stands in for
// OAuth2Client.verifyIdToken and is reconfigured per test.
const { mockVerify } = vi.hoisted(() => ({ mockVerify: vi.fn() }));
vi.mock('google-auth-library', () => ({
  OAuth2Client: class {
    verifyIdToken = mockVerify;
  },
}));

// buildApp is imported AFTER the mock is registered so the route picks up the mocked client.
const { buildApp } = await import('../src/app.js');
const { truncateAuthTables, testPrisma } = await import('./helpers/db.js');

const app = buildApp();

type AuthResponse = { user: { id: string; email: string; role: string }; token: string; refreshToken: string };
type ErrorResponse = { error: string };

function payload(over: Record<string, unknown> = {}) {
  return { getPayload: () => ({ email: 'googleuser@example.com', email_verified: true, name: 'Google User', ...over }) };
}

describe('POST /api/auth/google', () => {
  beforeAll(() => { process.env['GOOGLE_CLIENT_ID'] = 'test-client-id.apps.googleusercontent.com'; });
  beforeEach(async () => {
    await truncateAuthTables();
    mockVerify.mockReset();
  });

  it('creates a new user from a verified Google token and issues a session', async () => {
    mockVerify.mockResolvedValue(payload());

    const res = await request(app).post('/api/auth/google').send({ credential: 'valid.jwt.token' });
    expect(res.status).toBe(200);
    const body = res.body as AuthResponse;
    expect(body).toHaveProperty('token');
    expect(body).toHaveProperty('refreshToken');
    expect(body.user.email).toBe('googleuser@example.com');
    expect(body.user).not.toHaveProperty('passwordHash');

    // the verifier was called with our configured client id as the audience
    expect(mockVerify).toHaveBeenCalledWith(
      expect.objectContaining({ audience: 'test-client-id.apps.googleusercontent.com' }),
    );
  });

  it('logs into the SAME account on a second sign-in (upsert by email, not duplicate)', async () => {
    mockVerify.mockResolvedValue(payload());

    const first = await request(app).post('/api/auth/google').send({ credential: 'valid.jwt.token' });
    const second = await request(app).post('/api/auth/google').send({ credential: 'valid.jwt.token' });
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect((second.body as AuthResponse).user.id).toBe((first.body as AuthResponse).user.id);

    const count = await testPrisma.user.count({ where: { email: 'googleuser@example.com' } });
    expect(count).toBe(1);
  });

  it('links to a pre-existing local account with the same email', async () => {
    await request(app).post('/api/auth/register').send({
      email: 'googleuser@example.com', password: 'password123', name: 'Local User', phone: '',
    });
    mockVerify.mockResolvedValue(payload());

    const res = await request(app).post('/api/auth/google').send({ credential: 'valid.jwt.token' });
    expect(res.status).toBe(200);
    const count = await testPrisma.user.count({ where: { email: 'googleuser@example.com' } });
    expect(count).toBe(1);
  });

  it('rejects a token whose email is not verified by Google', async () => {
    mockVerify.mockResolvedValue(payload({ email_verified: false }));

    const res = await request(app).post('/api/auth/google').send({ credential: 'valid.jwt.token' });
    expect(res.status).toBe(401);
    expect((res.body as ErrorResponse).error).toBe('google_email_unverified');
  });

  it('rejects an invalid/expired token (verifier throws)', async () => {
    mockVerify.mockRejectedValue(new Error('Invalid token signature'));

    const res = await request(app).post('/api/auth/google').send({ credential: 'tampered.token' });
    expect(res.status).toBe(401);
    expect((res.body as ErrorResponse).error).toBe('invalid_google_token');
  });

  it('returns 422 when credential is missing', async () => {
    const res = await request(app).post('/api/auth/google').send({});
    expect(res.status).toBe(422);
  });
});
