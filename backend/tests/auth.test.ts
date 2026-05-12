import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { buildApp } from '../src/app.js';
import { truncateAuthTables, testPrisma } from './helpers/db.js';

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
