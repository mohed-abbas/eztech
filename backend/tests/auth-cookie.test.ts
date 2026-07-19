import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { buildApp } from '../src/app.js';
import { truncateAuthTables } from './helpers/db.js';

// Phase 7 shipped httpOnly cookie auth + double-submit CSRF and verified it live, but STATE.md
// flagged it as never covered by automated tests. This suite backfills that gap (DEPLOY-10).

const app = buildApp();

type ErrorResponse = { error: string };
type UserResponse = { user: Record<string, unknown> };
type TokenResponse = { token: string; refreshToken: string };

const VALID_USER = {
  email: 'cookieuser@example.com',
  password: 'password123',
  name: 'Cookie User',
  phone: '0600000001',
};

// supertest exposes raw Set-Cookie header strings; parse into { name: { value, raw } } so tests
// can assert both the cookie value and its attributes (HttpOnly, SameSite) in one place.
function parseSetCookies(setCookie: string[] | undefined): Record<string, { value: string; raw: string }> {
  const out: Record<string, { value: string; raw: string }> = {};
  for (const line of setCookie ?? []) {
    const [pair] = line.split(';');
    const idx = pair!.indexOf('=');
    const name = pair!.slice(0, idx).trim();
    const value = pair!.slice(idx + 1).trim();
    out[name] = { value, raw: line };
  }
  return out;
}

// request.agent() keeps a cookie jar across calls, so the returned agent authenticates purely via
// the ez_access/ez_refresh cookies from here on — no Authorization header ever set.
async function registerAndLoginAgent(data = VALID_USER) {
  await request(app).post('/api/auth/register').send(data);
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ email: data.email, password: data.password });
  const cookies = parseSetCookies(res.headers['set-cookie'] as string[] | undefined);
  return { agent, cookies, body: res.body as UserResponse };
}

describe('Cookie/CSRF auth (Phase 7 backfill)', () => {
  beforeEach(truncateAuthTables);

  it('login sets httpOnly ez_access/ez_refresh + readable ez_csrf, all SameSite=Lax', async () => {
    const { cookies } = await registerAndLoginAgent();

    expect(cookies['ez_access']).toBeDefined();
    expect(cookies['ez_refresh']).toBeDefined();
    expect(cookies['ez_csrf']).toBeDefined();

    expect(cookies['ez_access']!.raw).toMatch(/HttpOnly/i);
    expect(cookies['ez_refresh']!.raw).toMatch(/HttpOnly/i);
    expect(cookies['ez_csrf']!.raw).not.toMatch(/HttpOnly/i);

    expect(cookies['ez_access']!.raw).toMatch(/SameSite=Lax/i);
    expect(cookies['ez_refresh']!.raw).toMatch(/SameSite=Lax/i);
    expect(cookies['ez_csrf']!.raw).toMatch(/SameSite=Lax/i);
  });

  it('cookie-only auth succeeds against a protected route (GET /api/auth/me)', async () => {
    const { agent } = await registerAndLoginAgent();
    const res = await agent.get('/api/auth/me');
    expect(res.status).toBe(200);
    expect((res.body as UserResponse).user).toHaveProperty('email', VALID_USER.email);
  });

  it('rejects an authed cookie state-changing request without x-csrf-token (403 csrf_failed)', async () => {
    const { agent } = await registerAndLoginAgent();
    const res = await agent.patch('/api/users/me/notifications').send({ emailOptOut: true });
    expect(res.status).toBe(403);
    expect((res.body as ErrorResponse).error).toBe('csrf_failed');
  });

  it('passes the same cookie request when x-csrf-token matches the ez_csrf cookie', async () => {
    const { agent, cookies } = await registerAndLoginAgent();
    const res = await agent
      .patch('/api/users/me/notifications')
      .set('x-csrf-token', cookies['ez_csrf']!.value)
      .send({ emailOptOut: true });
    expect(res.status).toBe(200);
    expect((res.body as UserResponse).user).toHaveProperty('emailOptOut', true);
  });

  it('a Bearer-header request bypasses CSRF with no token and no cookie', async () => {
    await request(app).post('/api/auth/register').send(VALID_USER);
    const loginRes = await request(app).post('/api/auth/login').send({
      email: VALID_USER.email, password: VALID_USER.password,
    });
    const { token } = loginRes.body as TokenResponse;

    const res = await request(app)
      .patch('/api/users/me/notifications')
      .set('Authorization', `Bearer ${token}`)
      .send({ emailOptOut: true });
    expect(res.status).toBe(200);
    expect((res.body as UserResponse).user).toHaveProperty('emailOptOut', true);
  });

  it('an empty "Bearer " header does NOT shadow the session cookie', async () => {
    const { agent } = await registerAndLoginAgent();
    // safe method (GET) — exercises requireAuth's bearer-fallback-to-cookie logic, not CSRF
    const res = await agent.get('/api/auth/me').set('Authorization', 'Bearer ');
    expect(res.status).toBe(200);
    expect((res.body as UserResponse).user).toHaveProperty('email', VALID_USER.email);
  });

  it('refreshes via the ez_refresh cookie and issues a fresh ez_access Set-Cookie', async () => {
    const { agent, cookies: loginCookies } = await registerAndLoginAgent();
    // /auth/refresh is NOT CSRF-exempt and the agent still carries ez_access from login, so the
    // double-submit token is required here too — matches the frontend's csrfHeader() usage
    // (app/stores/auth.ts refresh()).
    const res = await agent
      .post('/api/auth/refresh')
      .set('x-csrf-token', loginCookies['ez_csrf']!.value)
      .send({});
    expect(res.status).toBe(200);

    // A JWT signed in the same second as login is byte-identical (no jti/nonce), so assert cookie
    // freshness by attributes + body/cookie consistency rather than a value-inequality check.
    const refreshCookies = parseSetCookies(res.headers['set-cookie'] as string[] | undefined);
    expect(refreshCookies['ez_access']).toBeDefined();
    expect(refreshCookies['ez_access']!.raw).toMatch(/HttpOnly/i);
    expect((res.body as TokenResponse).token).toBe(refreshCookies['ez_access']!.value);
  });
});
