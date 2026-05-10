import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { buildApp } from '../src/app.js';
import { truncateAuthTables } from './helpers/db.js';

const app = buildApp();

type AuthResponse = { user: { id: string; role: string }; token: string; refreshToken: string };
type ErrorResponse = { error: string };

const ADMIN_CREDS = {
  email: 'admin@eztech.fr',
  password: 'adminpass123',
};

const CUSTOMER = {
  email: 'customer@example.com',
  password: 'password123',
  name: 'Customer User',
  phone: '',
};

async function getAdminToken(): Promise<string> {
  const res = await request(app).post('/api/auth/login').send(ADMIN_CREDS);
  return (res.body as AuthResponse).token;
}

async function createCustomer(): Promise<{ id: string; token: string }> {
  const res = await request(app).post('/api/auth/register').send(CUSTOMER);
  const body = res.body as AuthResponse;
  return { id: body.user.id, token: body.token };
}

describe('GET /api/users/:id', () => {
  beforeEach(truncateAuthTables);

  it('returns 403 for a customer token', async () => {
    const { id, token: customerToken } = await createCustomer();

    const res = await request(app)
      .get(`/api/users/${id}`)
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
  });

  it('returns 200 with user for an admin token', async () => {
    const adminToken = await getAdminToken();
    const { id } = await createCustomer();

    const res = await request(app)
      .get(`/api/users/${id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const body = res.body as { user: Record<string, unknown> };
    expect(body.user).toHaveProperty('id', id);
    expect(body.user).not.toHaveProperty('passwordHash');
  });

  it('returns 404 for unknown id', async () => {
    const adminToken = await getAdminToken();
    const res = await request(app)
      .get('/api/users/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/users/:id', () => {
  beforeEach(truncateAuthTables);

  it('returns 403 for a customer token', async () => {
    const { id, token } = await createCustomer();
    const res = await request(app)
      .patch(`/api/users/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'New Name' });
    expect(res.status).toBe(403);
  });

  it('allows admin to change a user role', async () => {
    const adminToken = await getAdminToken();
    const { id } = await createCustomer();

    const res = await request(app)
      .patch(`/api/users/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'rider' });
    expect(res.status).toBe(200);
    const body = res.body as { user: { role: string } };
    expect(body.user).toHaveProperty('role', 'rider');
  });

  it('returns 422 for invalid role value', async () => {
    const adminToken = await getAdminToken();
    const { id } = await createCustomer();

    const res = await request(app)
      .patch(`/api/users/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'superadmin' });
    expect(res.status).toBe(422);
    expect((res.body as ErrorResponse).error).toBe('validation_failed');
  });
});
