import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { buildApp } from '../src/app.js';
import { truncateAuthTables, testPrisma } from './helpers/db.js';
import { issueResetToken, consumeResetToken } from '../src/lib/reset-token.js';

const app = buildApp();

type AuthResponse = { user: Record<string, unknown>; token: string; refreshToken: string };
type ErrorResponse = { error: string };

const VALID_USER = {
  email: 'testuser@example.com',
  password: 'password123',
  name: 'Test User',
  phone: '0600000000',
};

async function registerAndLogin(data = VALID_USER): Promise<AuthResponse> {
  await request(app).post('/api/auth/register').send(data);
  const res = await request(app).post('/api/auth/login').send({
    email: data.email,
    password: data.password,
  });
  return res.body as AuthResponse;
}

describe('POST /api/auth/register', () => {
  beforeEach(truncateAuthTables);

  it('creates a user and returns { user, token, refreshToken }', async () => {
    const res = await request(app).post('/api/auth/register').send(VALID_USER);
    const body = res.body as AuthResponse;
    expect(res.status).toBe(201);
    expect(body).toHaveProperty('token');
    expect(body).toHaveProperty('refreshToken');
    expect(body.user).toHaveProperty('email', VALID_USER.email);
    expect(body.user).toHaveProperty('role', 'customer');
    expect(body.user).not.toHaveProperty('passwordHash');
  });

  it('returns 409 for duplicate email', async () => {
    await request(app).post('/api/auth/register').send(VALID_USER);
    const res = await request(app).post('/api/auth/register').send(VALID_USER);
    expect(res.status).toBe(409);
    expect((res.body as ErrorResponse).error).toBe('email_taken');
  });

  it('returns 422 for missing required fields', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'bad' });
    expect(res.status).toBe(422);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(truncateAuthTables);

  it('returns { user, token, refreshToken } with correct credentials', async () => {
    await request(app).post('/api/auth/register').send(VALID_USER);
    const res = await request(app).post('/api/auth/login').send({
      email: VALID_USER.email,
      password: VALID_USER.password,
    });
    const body = res.body as AuthResponse;
    expect(res.status).toBe(200);
    expect(body).toHaveProperty('token');
    expect(body).toHaveProperty('refreshToken');
    expect(body.user).not.toHaveProperty('passwordHash');
  });

  it('returns 401 for wrong password', async () => {
    await request(app).post('/api/auth/register').send(VALID_USER);
    const res = await request(app).post('/api/auth/login').send({
      email: VALID_USER.email,
      password: 'wrongpassword',
    });
    expect(res.status).toBe(401);
    expect((res.body as ErrorResponse).error).toBe('invalid_credentials');
  });

  it('returns 401 for non-existent email', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'nobody@nowhere.com',
      password: 'somepassword',
    });
    expect(res.status).toBe(401);
    expect((res.body as ErrorResponse).error).toBe('invalid_credentials');
  });

  it('never leaks "user not found" in response body', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'nobody@test.com', password: 'x' });
    expect(res.status).toBe(401);
    expect((res.body as ErrorResponse).error).toBe('invalid_credentials');
  });
});

describe('POST /api/auth/refresh', () => {
  beforeEach(truncateAuthTables);

  it('rotates the token and returns a new pair', async () => {
    await request(app).post('/api/auth/register').send(VALID_USER);
    const loginRes = await request(app).post('/api/auth/login').send({
      email: VALID_USER.email, password: VALID_USER.password,
    });
    const { refreshToken } = loginRes.body as AuthResponse;

    const res = await request(app).post('/api/auth/refresh').send({ refreshToken });
    const body = res.body as { token: string; refreshToken: string };
    expect(res.status).toBe(200);
    expect(body).toHaveProperty('token');
    expect(body).toHaveProperty('refreshToken');
    expect(body.refreshToken).not.toBe(refreshToken);
  });

  it('returns 401 with a revoked refresh token', async () => {
    await request(app).post('/api/auth/register').send(VALID_USER);
    const loginRes = await request(app).post('/api/auth/login').send({
      email: VALID_USER.email, password: VALID_USER.password,
    });
    const { refreshToken } = loginRes.body as AuthResponse;

    // rotate once — old token is now revoked
    await request(app).post('/api/auth/refresh').send({ refreshToken });

    // try the old (revoked) token
    const res = await request(app).post('/api/auth/refresh').send({ refreshToken });
    expect(res.status).toBe(401);
  });

  it('returns 401 with an expired refresh token', async () => {
    await request(app).post('/api/auth/register').send(VALID_USER);
    const loginRes = await request(app).post('/api/auth/login').send({
      email: VALID_USER.email, password: VALID_USER.password,
    });
    const { refreshToken } = loginRes.body as AuthResponse;

    // manually expire the token in the DB
    await testPrisma.$executeRaw`UPDATE "RefreshToken" SET "expiresAt" = NOW() - INTERVAL '1 second'`;

    const res = await request(app).post('/api/auth/refresh').send({ refreshToken });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  beforeEach(truncateAuthTables);

  it('returns 204 and makes the refresh token unusable', async () => {
    await request(app).post('/api/auth/register').send(VALID_USER);
    const loginRes = await request(app).post('/api/auth/login').send({
      email: VALID_USER.email, password: VALID_USER.password,
    });
    const { refreshToken } = loginRes.body as AuthResponse;

    const logoutRes = await request(app).post('/api/auth/logout').send({ refreshToken });
    expect(logoutRes.status).toBe(204);

    // subsequent refresh must fail
    const refreshRes = await request(app).post('/api/auth/refresh').send({ refreshToken });
    expect(refreshRes.status).toBe(401);
  });
});

describe('GET /api/auth/me', () => {
  beforeEach(truncateAuthTables);

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 200 with user when token is valid', async () => {
    const { token } = await registerAndLogin();
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const body = res.body as { user: Record<string, unknown> };
    expect(body.user).toHaveProperty('email', VALID_USER.email);
  });

  it('never includes passwordHash in response', async () => {
    const { token } = await registerAndLogin();
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const body = res.body as { user: Record<string, unknown> };
    expect(body.user).not.toHaveProperty('passwordHash');
  });
});

describe('reset-token lib (single-use, expiring)', () => {
  beforeEach(truncateAuthTables);

  it('resets: consumeResetToken resolves a fresh token to the userId once, then null on reuse (single-use)', async () => {
    const { user } = await registerAndLogin();
    const raw = await issueResetToken(user.id as string);

    const first = await consumeResetToken(raw);
    expect(first).toBe(user.id);

    const second = await consumeResetToken(raw);
    expect(second).toBeNull();
  });

  it('resets: consumeResetToken returns null for an expired token', async () => {
    const { user } = await registerAndLogin();
    const raw = await issueResetToken(user.id as string);
    await testPrisma.$executeRaw`UPDATE "PasswordResetToken" SET "expiresAt" = NOW() - INTERVAL '1 second'`;

    const result = await consumeResetToken(raw);
    expect(result).toBeNull();
  });

  it('resets: consumeResetToken returns null for an unknown token', async () => {
    const result = await consumeResetToken('a'.repeat(64));
    expect(result).toBeNull();
  });
});

describe('POST /api/auth/forgot-password', () => {
  beforeEach(truncateAuthTables);

  it('returns the identical response for an existing and a non-existing email (no enumeration)', async () => {
    await request(app).post('/api/auth/register').send(VALID_USER);

    const known = await request(app).post('/api/auth/forgot-password').send({ email: VALID_USER.email });
    const unknown = await request(app).post('/api/auth/forgot-password').send({ email: 'nobody@nowhere.com' });

    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(known.body).toEqual(unknown.body);
  });

  it('issues a consumable reset token for a known email', async () => {
    const { user } = await registerAndLogin();
    await request(app).post('/api/auth/forgot-password').send({ email: VALID_USER.email });

    const row = await testPrisma.passwordResetToken.findFirst({ where: { userId: user.id as string } });
    expect(row).toBeTruthy();
  });

  it('returns 422 for a malformed email', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'not-an-email' });
    expect(res.status).toBe(422);
  });
});

describe('POST /api/auth/reset-password', () => {
  beforeEach(truncateAuthTables);

  it('resets the password with a valid token and allows login with the new password', async () => {
    const { user } = await registerAndLogin();
    const raw = await issueResetToken(user.id as string);

    const res = await request(app).post('/api/auth/reset-password').send({ token: raw, password: 'newpassword456' });
    expect(res.status).toBe(200);

    const loginRes = await request(app).post('/api/auth/login').send({
      email: VALID_USER.email, password: 'newpassword456',
    });
    expect(loginRes.status).toBe(200);

    const oldLoginRes = await request(app).post('/api/auth/login').send({
      email: VALID_USER.email, password: VALID_USER.password,
    });
    expect(oldLoginRes.status).toBe(401);
  });

  it('returns 400 for a reused token', async () => {
    const { user } = await registerAndLogin();
    const raw = await issueResetToken(user.id as string);

    await request(app).post('/api/auth/reset-password').send({ token: raw, password: 'newpassword456' });
    const res = await request(app).post('/api/auth/reset-password').send({ token: raw, password: 'anotherpassword789' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for an expired token', async () => {
    const { user } = await registerAndLogin();
    const raw = await issueResetToken(user.id as string);
    await testPrisma.$executeRaw`UPDATE "PasswordResetToken" SET "expiresAt" = NOW() - INTERVAL '1 second'`;

    const res = await request(app).post('/api/auth/reset-password').send({ token: raw, password: 'newpassword456' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for an unknown token', async () => {
    const res = await request(app).post('/api/auth/reset-password').send({ token: 'a'.repeat(64), password: 'newpassword456' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/change-password', () => {
  beforeEach(truncateAuthTables);

  it('rotates the password when the current one is correct, then allows login with the new one', async () => {
    const { token } = await registerAndLogin();

    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: VALID_USER.password, newPassword: 'brandnewpass789' });
    expect(res.status).toBe(200);

    const newLogin = await request(app).post('/api/auth/login').send({
      email: VALID_USER.email, password: 'brandnewpass789',
    });
    expect(newLogin.status).toBe(200);

    const oldLogin = await request(app).post('/api/auth/login').send({
      email: VALID_USER.email, password: VALID_USER.password,
    });
    expect(oldLogin.status).toBe(401);
  });

  it('returns 400 and does not rotate when the current password is wrong', async () => {
    const { token } = await registerAndLogin();

    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'notmypassword', newPassword: 'brandnewpass789' });
    expect(res.status).toBe(400);
    expect((res.body as ErrorResponse).error).toBe('invalid_current_password');

    // original password still works
    const stillLogin = await request(app).post('/api/auth/login').send({
      email: VALID_USER.email, password: VALID_USER.password,
    });
    expect(stillLogin.status).toBe(200);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .send({ currentPassword: VALID_USER.password, newPassword: 'brandnewpass789' });
    expect(res.status).toBe(401);
  });

  it('returns 422 when the new password is too short', async () => {
    const { token } = await registerAndLogin();
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: VALID_USER.password, newPassword: 'short' });
    expect(res.status).toBe(422);
  });
});
