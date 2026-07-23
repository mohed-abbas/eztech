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

  it('returns 404 for unknown id', async () => {
    const adminToken = await getAdminToken();
    const res = await request(app)
      .patch('/api/users/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Ghost' });
    expect(res.status).toBe(404);
    expect((res.body as ErrorResponse).error).toBe('user_not_found');
  });
});

describe('PATCH /api/users/me/notifications', () => {
  beforeEach(truncateAuthTables);

  it('toggles emailOptOut for the caller and returns the sanitized user', async () => {
    const { token } = await createCustomer();

    const res = await request(app)
      .patch('/api/users/me/notifications')
      .set('Authorization', `Bearer ${token}`)
      .send({ emailOptOut: true });

    expect(res.status).toBe(200);
    const body = res.body as { user: { emailOptOut: boolean } & Record<string, unknown> };
    expect(body.user.emailOptOut).toBe(true);
    expect(body.user).not.toHaveProperty('passwordHash');
  });

  it('only mutates the caller\'s own row (owner-scoped)', async () => {
    const { id: otherId, token: otherToken } = await createCustomer();
    const other = await request(app)
      .patch('/api/users/me/notifications')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ emailOptOut: true });
    expect(other.status).toBe(200);

    const adminToken = await getAdminToken();
    const check = await request(app)
      .get(`/api/users/${otherId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect((check.body as { user: { emailOptOut: boolean } }).user.emailOptOut).toBe(true);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).patch('/api/users/me/notifications').send({ emailOptOut: true });
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/users/me', () => {
  beforeEach(truncateAuthTables);

  it('updates the caller\'s own name/phone and returns the sanitized user', async () => {
    const { token } = await createCustomer();

    const res = await request(app)
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Renamed User', phone: '0611223344' });

    expect(res.status).toBe(200);
    const body = res.body as { user: { name: string; phone: string } & Record<string, unknown> };
    expect(body.user.name).toBe('Renamed User');
    expect(body.user.phone).toBe('0611223344');
    expect(body.user).not.toHaveProperty('passwordHash');
  });

  it('updates rider vehicle fields', async () => {
    const { token } = await createCustomer();

    const res = await request(app)
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ vehicleType: 'scooter', licenseNumber: 'AB-123', insuranceNumber: 'INS-9' });

    expect(res.status).toBe(200);
    const body = res.body as { user: { vehicleType: string; licenseNumber: string } };
    expect(body.user.vehicleType).toBe('scooter');
    expect(body.user.licenseNumber).toBe('AB-123');
  });

  it('cannot escalate role or change email (fields rejected by the schema, ignored)', async () => {
    const { id, token } = await createCustomer();

    const res = await request(app)
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'admin', email: 'hacker@evil.com', name: 'Legit Name' });
    expect(res.status).toBe(200);

    // role/email untouched — verify via the admin read
    const adminToken = await getAdminToken();
    const check = await request(app).get(`/api/users/${id}`).set('Authorization', `Bearer ${adminToken}`);
    const checked = (check.body as { user: { role: string; email: string; name: string } }).user;
    expect(checked.role).toBe('customer');
    expect(checked.email).toBe(CUSTOMER.email);
    expect(checked.name).toBe('Legit Name');
  });

  it('returns 422 for an empty name', async () => {
    const { token } = await createCustomer();
    const res = await request(app)
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '' });
    expect(res.status).toBe(422);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).patch('/api/users/me').send({ name: 'x' });
    expect(res.status).toBe(401);
  });
});
