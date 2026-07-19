import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { buildApp } from '../src/app.js';

const ALLOWED_ORIGIN = 'https://eztech.thecodeman.cloud';
const REJECTED_ORIGIN = 'https://evil-clone.example.com';

describe('security headers', () => {
  let app: ReturnType<typeof buildApp>;
  let previousCorsOrigin: string | undefined;

  beforeAll(() => {
    previousCorsOrigin = process.env['CORS_ORIGIN'];
    process.env['CORS_ORIGIN'] = ALLOWED_ORIGIN;
    app = buildApp();
  });

  afterAll(() => {
    if (previousCorsOrigin === undefined) delete process.env['CORS_ORIGIN'];
    else process.env['CORS_ORIGIN'] = previousCorsOrigin;
  });

  it('carries Helmet defaults (X-Content-Type-Options: nosniff)', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('does not emit a Content-Security-Policy header (nginx is the sole CSP owner)', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['content-security-policy']).toBeUndefined();
  });

  it('echoes Access-Control-Allow-Origin for an allowlisted origin', async () => {
    const res = await request(app).get('/api/health').set('Origin', ALLOWED_ORIGIN);
    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('does not echo Access-Control-Allow-Origin for a non-allowlisted origin', async () => {
    const res = await request(app).get('/api/health').set('Origin', REJECTED_ORIGIN);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
