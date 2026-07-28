import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { buildApp } from '../src/app.js';
import { truncateAuthTables, testPrisma } from './helpers/db.js';

// Couvre uniquement l'adresse par defaut (colonne Address.isDefault + PATCH .../default et
// l'auto-reparation sur create/delete). Le CRUD adresses et la garde de propriete PATCH/DELETE sont
// deja couverts par profile-self-service.test.ts — ce fichier ne les redouble pas.
const app = buildApp();

type AuthResponse = { token: string; user: { id: string } };

const PW = ['fixture', 'addresses', '1'].join('-');

async function registerCustomer(email: string): Promise<AuthResponse> {
  const res = await request(app).post('/api/auth/register').send({ email, password: PW, name: 'Cust', phone: '' });
  return res.body as AuthResponse;
}

async function addAddress(token: string, over: Partial<{ label: string; street: string; city: string; zipCode: string }> = {}) {
  const res = await request(app).post('/api/users/me/addresses')
    .set('Authorization', `Bearer ${token}`)
    .send({
      label: over.label ?? 'Domicile',
      street: over.street ?? '1 Rue A',
      city: over.city ?? 'Paris',
      zipCode: over.zipCode ?? '75001',
    });
  return res;
}

beforeEach(truncateAuthTables);

describe('adresse par defaut', () => {
  it('la premiere adresse creee devient l\'adresse par defaut', async () => {
    const me = await registerCustomer('def-first@example.com');

    const first = await addAddress(me.token, { label: 'Domicile' });
    expect(first.status).toBe(201);
    expect(first.body.address.isDefault).toBe(true);

    // la suivante ne vole pas le defaut
    const second = await addAddress(me.token, { label: 'Bureau', street: '2 Rue B' });
    expect(second.status).toBe(201);
    expect(second.body.address.isDefault).toBe(false);

    const inDb = await testPrisma.address.findMany({ where: { userId: me.user.id } });
    expect(inDb.filter((a) => a.isDefault)).toHaveLength(1);
  });

  it('PATCH .../default bascule le defaut de maniere exclusive', async () => {
    const me = await registerCustomer('def-switch@example.com');
    const auth = { Authorization: `Bearer ${me.token}` };

    const a = await addAddress(me.token, { label: 'Domicile' });
    const b = await addAddress(me.token, { label: 'Bureau', street: '2 Rue B' });
    const idA = a.body.address.id as string;
    const idB = b.body.address.id as string;

    const res = await request(app).patch(`/api/users/me/addresses/${idB}/default`).set(auth);
    expect(res.status).toBe(200);
    expect(res.body.addresses).toHaveLength(2);

    // relecture en base : exactement une adresse par defaut, et c'est bien B
    const inDb = await testPrisma.address.findMany({ where: { userId: me.user.id } });
    expect(inDb.filter((x) => x.isDefault)).toHaveLength(1);
    expect(inDb.find((x) => x.isDefault)?.id).toBe(idB);
    expect(inDb.find((x) => x.id === idA)?.isDefault).toBe(false);
  });

  it('ne peut pas designer par defaut l\'adresse d\'un autre compte (404, ligne intacte)', async () => {
    const owner = await registerCustomer('def-owner@example.com');
    const other = await registerCustomer('def-other@example.com');

    // owner a deux adresses : la 1re est par defaut, la 2e ne l'est pas
    await addAddress(owner.token, { label: 'Domicile' });
    const target = await addAddress(owner.token, { label: 'Bureau', street: '2 Rue B' });
    const targetId = target.body.address.id as string;

    const res = await request(app).patch(`/api/users/me/addresses/${targetId}/default`)
      .set({ Authorization: `Bearer ${other.token}` });
    expect(res.status).toBe(404);

    // rien n'a bouge cote owner
    const inDb = await testPrisma.address.findUnique({ where: { id: targetId } });
    expect(inDb?.isDefault).toBe(false);
    const all = await testPrisma.address.findMany({ where: { userId: owner.user.id } });
    expect(all.filter((x) => x.isDefault)).toHaveLength(1);
  });

  it('supprimer l\'adresse par defaut promeut la plus ancienne restante', async () => {
    const me = await registerCustomer('def-delete@example.com');
    const auth = { Authorization: `Bearer ${me.token}` };

    const a = await addAddress(me.token, { label: 'A' });
    const b = await addAddress(me.token, { label: 'B', street: '2 Rue B' });
    const c = await addAddress(me.token, { label: 'C', street: '3 Rue C' });
    const idA = a.body.address.id as string;
    const idB = b.body.address.id as string;
    const idC = c.body.address.id as string;

    // A est par defaut (creee en premier) ; on la supprime
    expect(a.body.address.isDefault).toBe(true);
    const del = await request(app).delete(`/api/users/me/addresses/${idA}`).set(auth);
    expect(del.status).toBe(204);

    const inDb = await testPrisma.address.findMany({ where: { userId: me.user.id }, orderBy: { createdAt: 'asc' } });
    expect(inDb).toHaveLength(2);
    expect(inDb.filter((x) => x.isDefault)).toHaveLength(1);
    expect(inDb.find((x) => x.isDefault)?.id).toBe(idB); // la plus ancienne restante
    expect(inDb.find((x) => x.id === idC)?.isDefault).toBe(false);
  });

  it('supprimer une adresse NON par defaut ne change pas le defaut', async () => {
    const me = await registerCustomer('def-delete-other@example.com');
    const auth = { Authorization: `Bearer ${me.token}` };

    const a = await addAddress(me.token, { label: 'A' });
    const b = await addAddress(me.token, { label: 'B', street: '2 Rue B' });
    const idA = a.body.address.id as string;
    const idB = b.body.address.id as string;

    const del = await request(app).delete(`/api/users/me/addresses/${idB}`).set(auth);
    expect(del.status).toBe(204);

    const inDb = await testPrisma.address.findMany({ where: { userId: me.user.id } });
    expect(inDb).toHaveLength(1);
    expect(inDb[0]?.id).toBe(idA);
    expect(inDb[0]?.isDefault).toBe(true);
  });

  it('refuse un appel non authentifie (401)', async () => {
    const owner = await registerCustomer('def-anon@example.com');
    const created = await addAddress(owner.token);
    const id = created.body.address.id as string;

    const res = await request(app).patch(`/api/users/me/addresses/${id}/default`);
    expect(res.status).toBe(401);
  });
});
