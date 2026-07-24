import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { buildApp } from '../src/app.js';
import { truncateAuthTables, testPrisma } from './helpers/db.js';

const app = buildApp();

type AuthResponse = { token: string, user: { id: string } };

async function registerCustomer(email: string, password = 'password123') {
  const res = await request(app).post('/api/auth/register').send({ email, password, name: 'Cust', phone: '' });
  return res.body as AuthResponse;
}

beforeEach(truncateAuthTables);

describe('PATCH /api/users/me — profil self-service', () => {
  it('met a jour le nom et le telephone de l\'utilisateur connecte', async () => {
    const me = await registerCustomer('me-1@example.com');

    const res = await request(app).patch('/api/users/me')
      .set('Authorization', `Bearer ${me.token}`)
      .send({ name: 'Nouveau Nom', phone: '+33 6 00 00 00 00' });

    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe('Nouveau Nom');

    // persiste reellement en base (c'est tout l'objet du correctif)
    const inDb = await testPrisma.user.findUnique({ where: { id: me.user.id } });
    expect(inDb?.name).toBe('Nouveau Nom');
    expect(inDb?.phone).toBe('+33 6 00 00 00 00');
  });

  it('ne permet pas de changer son role', async () => {
    const me = await registerCustomer('me-2@example.com');
    await request(app).patch('/api/users/me')
      .set('Authorization', `Bearer ${me.token}`)
      .send({ name: 'X', role: 'admin' });

    const inDb = await testPrisma.user.findUnique({ where: { id: me.user.id } });
    expect(inDb?.role).toBe('customer');
  });

  it('refuse un appel non authentifie (401)', async () => {
    const res = await request(app).patch('/api/users/me').send({ name: 'X' });
    expect(res.status).toBe(401);
  });
});

describe('adresses self-service', () => {
  it('cree, liste, modifie et supprime une adresse', async () => {
    const me = await registerCustomer('addr-1@example.com');
    const auth = { Authorization: `Bearer ${me.token}` };

    const created = await request(app).post('/api/users/me/addresses').set(auth)
      .send({ label: 'Domicile', street: '1 Rue A', city: 'Paris', zipCode: '75001' });
    expect(created.status).toBe(201);
    const addressId = created.body.address.id as string;

    const list = await request(app).get('/api/users/me/addresses').set(auth);
    expect(list.status).toBe(200);
    expect(list.body.addresses).toHaveLength(1);

    const patched = await request(app).patch(`/api/users/me/addresses/${addressId}`).set(auth)
      .send({ street: '2 Rue B' });
    expect(patched.status).toBe(200);
    expect(patched.body.address.street).toBe('2 Rue B');

    const removed = await request(app).delete(`/api/users/me/addresses/${addressId}`).set(auth);
    expect(removed.status).toBe(204);
    expect(await testPrisma.address.count({ where: { userId: me.user.id } })).toBe(0);
  });

  it('ne peut pas modifier ni supprimer l\'adresse d\'un autre compte (404)', async () => {
    const owner = await registerCustomer('addr-owner@example.com');
    const other = await registerCustomer('addr-other@example.com');

    const created = await request(app).post('/api/users/me/addresses')
      .set({ Authorization: `Bearer ${owner.token}` })
      .send({ label: 'Domicile', street: '1 Rue A', city: 'Paris', zipCode: '75001' });
    const addressId = created.body.address.id as string;

    const patch = await request(app).patch(`/api/users/me/addresses/${addressId}`)
      .set({ Authorization: `Bearer ${other.token}` }).send({ street: 'Pirate' });
    expect(patch.status).toBe(404);

    const del = await request(app).delete(`/api/users/me/addresses/${addressId}`)
      .set({ Authorization: `Bearer ${other.token}` });
    expect(del.status).toBe(404);

    // l'adresse est intacte
    const inDb = await testPrisma.address.findUnique({ where: { id: addressId } });
    expect(inDb?.street).toBe('1 Rue A');
  });
});

describe('POST /api/auth/change-password', () => {
  it('change le mot de passe et permet de se reconnecter avec le nouveau', async () => {
    const email = 'pwd-1@example.com';
    const me = await registerCustomer(email);

    const res = await request(app).post('/api/auth/change-password')
      .set('Authorization', `Bearer ${me.token}`)
      .send({ currentPassword: 'password123', newPassword: 'nouveaupass456' });
    expect(res.status).toBe(204);

    const oldLogin = await request(app).post('/api/auth/login').send({ email, password: 'password123' });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app).post('/api/auth/login').send({ email, password: 'nouveaupass456' });
    expect(newLogin.status).toBe(200);
  });

  it('refuse un mot de passe actuel incorrect (400)', async () => {
    const me = await registerCustomer('pwd-2@example.com');
    const res = await request(app).post('/api/auth/change-password')
      .set('Authorization', `Bearer ${me.token}`)
      .send({ currentPassword: 'mauvais', newPassword: 'nouveaupass456' });
    expect(res.status).toBe(400);
  });

  it('refuse un nouveau mot de passe trop court (422)', async () => {
    const me = await registerCustomer('pwd-3@example.com');
    const res = await request(app).post('/api/auth/change-password')
      .set('Authorization', `Bearer ${me.token}`)
      .send({ currentPassword: 'password123', newPassword: 'court' });
    expect(res.status).toBe(422);
  });
});
