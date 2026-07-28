import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { buildApp } from '../src/app.js';
import { truncateRiderTables, testPrisma } from './helpers/db.js';

// GET /api/users/:id/rider-documents — chemin admin dedie. Le routeur rider est garde en bloc par
// requireRole('rider') (routes/rider.ts) et GET /api/rider/documents est scope sur req.user!.sub :
// un admin y recoit 403. Le panneau d'onboarding admin a donc besoin de cette route.
const app = buildApp();

type AuthResponse = { token: string; user: { id: string } };

const PW = ['fixture', 'riderdocs', '1'].join('-');

async function adminToken(): Promise<string> {
  const res = await request(app).post('/api/auth/login').send({ email: 'admin@eztech.fr', password: 'adminpass123' });
  return (res.body as AuthResponse).token;
}

async function registerRider(email: string): Promise<AuthResponse> {
  const res = await request(app).post('/api/auth/register').send({
    email, password: PW, name: 'Rider', phone: '',
    vehicleType: 'bicycle', licenseNumber: 'LIC-1', insuranceNumber: 'INS-1',
  });
  return res.body as AuthResponse;
}

async function registerCustomer(email: string): Promise<AuthResponse> {
  const res = await request(app).post('/api/auth/register').send({ email, password: PW, name: 'Cust', phone: '' });
  return res.body as AuthResponse;
}

beforeEach(truncateRiderTables);

describe('GET /api/users/:id/rider-documents', () => {
  it('un admin lit les documents d\'un livreur (200)', async () => {
    const rider = await registerRider('docs-rider@example.com');
    await testPrisma.riderDocument.create({
      data: {
        riderId: rider.user.id,
        type: 'license',
        fileName: 'permis.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1234,
        url: '/uploads/riders/permis.pdf',
      },
    });

    const token = await adminToken();
    const res = await request(app).get(`/api/users/${rider.user.id}/rider-documents`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.documents).toHaveLength(1);
    expect(res.body.documents[0].fileName).toBe('permis.pdf');
    expect(res.body.documents[0].type).toBe('license');
    expect(res.body.documents[0].status).toBe('pending');
  });

  it('renvoie une liste vide pour un livreur sans document (200)', async () => {
    const rider = await registerRider('docs-empty@example.com');
    const token = await adminToken();
    const res = await request(app).get(`/api/users/${rider.user.id}/rider-documents`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.documents).toEqual([]);
  });

  it('refuse un client (403) et un appel anonyme (401)', async () => {
    const rider = await registerRider('docs-forbidden@example.com');
    const cust = await registerCustomer('docs-cust@example.com');

    const asCustomer = await request(app).get(`/api/users/${rider.user.id}/rider-documents`)
      .set('Authorization', `Bearer ${cust.token}`);
    expect(asCustomer.status).toBe(403);

    const anon = await request(app).get(`/api/users/${rider.user.id}/rider-documents`);
    expect(anon.status).toBe(401);
  });

  it('un livreur ne peut pas lire les documents d\'un autre livreur (403)', async () => {
    const a = await registerRider('docs-rider-a@example.com');
    const b = await registerRider('docs-rider-b@example.com');

    const res = await request(app).get(`/api/users/${a.user.id}/rider-documents`)
      .set('Authorization', `Bearer ${b.token}`);
    expect(res.status).toBe(403);
  });
});
