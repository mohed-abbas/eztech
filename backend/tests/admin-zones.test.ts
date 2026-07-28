import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { buildApp } from '../src/app.js';
import { signAccessToken } from '../src/middleware/auth.js';
import { truncateRiderTables, truncateCatalogTables, truncateAuthTables, testPrisma } from './helpers/db.js';

const app = buildApp();

type AuthResponse = { token: string };

// L'admin est seede par globalSetup — on mint son token directement, comme
// warehouses.test.ts, pour ne pas dependre du mot de passe seede.
async function adminToken(): Promise<string> {
  const admin = await testPrisma.user.findUnique({ where: { email: 'admin@eztech.fr' } });
  if (!admin) throw new Error('admin non seede');
  return signAccessToken({ sub: admin.id, role: 'admin' });
}

async function customerToken(email = 'admin-zone-cust@example.com'): Promise<string> {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'password123', name: 'Cust', phone: '' });
  return (res.body as AuthResponse).token;
}

// Anneau ferme (premiere position === derniere) et >= 4 positions : ce que
// CreateZoneSchema exige et ce que l'editeur serialise depuis Leaflet.
const SQUARE = {
  type: 'Polygon',
  coordinates: [
    [
      [2.3, 48.83],
      [2.4, 48.83],
      [2.4, 48.89],
      [2.3, 48.89],
      [2.3, 48.83],
    ],
  ],
};

// L'alias /api/admin/zones existe UNIQUEMENT parce que nginx detourne /api/zones
// vers le BFF Nuxt en production, ou les ecritures degradent silencieusement en
// lecture (POST -> 200 + FeatureCollection, aucune ligne creee). Ces tests
// verrouillent le montage : s'il disparait de backend/src/routes/index.ts,
// l'editeur d'admin redevient un no-op invisible en dev.
describe('/api/admin/zones (alias non detourne par nginx)', () => {
  beforeEach(async () => {
    await truncateRiderTables();
    await truncateCatalogTables();
    await truncateAuthTables();
  });

  it('expose la meme enveloppe { zones: [...] } que /api/zones (pas une FeatureCollection)', async () => {
    await testPrisma.zone.create({ data: { name: 'Paris Centre', isActive: true, geometry: SQUARE } });

    const res = await request(app).get('/api/admin/zones');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.zones)).toBe(true);
    expect(res.body.zones).toHaveLength(1);
    expect(res.body.zones[0].name).toBe('Paris Centre');
    expect(res.body.zones[0].geometry.type).toBe('Polygon');
    // le BFF storefront repondrait { type: 'FeatureCollection', features: [...] }
    expect(res.body.type).toBeUndefined();
    expect(res.body.features).toBeUndefined();
  });

  it('CRUD complet pour un admin : POST 201 -> PATCH 200 -> DELETE 204 (soft delete)', async () => {
    const token = await adminToken();

    const created = await request(app)
      .post('/api/admin/zones')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Zone tracee', geometry: SQUARE });
    expect(created.status).toBe(201);
    expect(created.body.zone.name).toBe('Zone tracee');
    expect(created.body.zone.isActive).toBe(true);
    const id = created.body.zone.id as string;

    // la ligne existe reellement en base, pas seulement dans la reponse
    expect(await testPrisma.zone.findUnique({ where: { id } })).not.toBeNull();

    const patched = await request(app)
      .patch(`/api/admin/zones/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Zone renommee' });
    expect(patched.status).toBe(200);
    expect(patched.body.zone.name).toBe('Zone renommee');

    const removed = await request(app)
      .delete(`/api/admin/zones/${id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(removed.status).toBe(204);

    // soft delete : la ligne survit, seul isActive bascule
    const row = await testPrisma.zone.findUnique({ where: { id } });
    expect(row).not.toBeNull();
    expect(row?.isActive).toBe(false);

    // ... et elle disparait de la liste, qui ne renvoie que les zones actives
    const list = await request(app).get('/api/admin/zones');
    expect(list.body.zones.map((z: { id: string }) => z.id)).not.toContain(id);
  });

  it('refuse un client sur POST / PATCH / DELETE avec 403 et n ecrit rien', async () => {
    const token = await customerToken();
    const seeded = await testPrisma.zone.create({ data: { name: 'Existante', isActive: true, geometry: SQUARE } });

    const post = await request(app)
      .post('/api/admin/zones')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Interdite', geometry: SQUARE });
    expect(post.status).toBe(403);

    const patch = await request(app)
      .patch(`/api/admin/zones/${seeded.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Interdite' });
    expect(patch.status).toBe(403);

    const del = await request(app)
      .delete(`/api/admin/zones/${seeded.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(403);

    expect(await testPrisma.zone.count({ where: { name: 'Interdite' } })).toBe(0);
    const untouched = await testPrisma.zone.findUnique({ where: { id: seeded.id } });
    expect(untouched?.name).toBe('Existante');
    expect(untouched?.isActive).toBe(true);
  });

  it('refuse une requete sans jeton avec 401', async () => {
    const res = await request(app).post('/api/admin/zones').send({ name: 'Anon', geometry: SQUARE });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('missing_token');
    expect(await testPrisma.zone.count({ where: { name: 'Anon' } })).toBe(0);
  });

  it('refuse un anneau non ferme avec 422 validation_failed et des issues exploitables', async () => {
    const token = await adminToken();
    const res = await request(app)
      .post('/api/admin/zones')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Ouverte',
        // 4 positions mais premiere !== derniere
        geometry: { type: 'Polygon', coordinates: [[[2.3, 48.83], [2.4, 48.83], [2.4, 48.89], [2.3, 48.89]]] },
      });

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('validation_failed');
    const issues = res.body.details?.issues ?? res.body.issues;
    expect(Array.isArray(issues)).toBe(true);
    expect(issues.length).toBeGreaterThan(0);
    expect(await testPrisma.zone.count({ where: { name: 'Ouverte' } })).toBe(0);
  });

  it('refuse un anneau de moins de 4 positions avec 422', async () => {
    const token = await adminToken();
    const res = await request(app)
      .post('/api/admin/zones')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Triangle plat',
        geometry: { type: 'Polygon', coordinates: [[[2.3, 48.83], [2.4, 48.83], [2.3, 48.83]]] },
      });
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('validation_failed');
  });

  it('une zone creee via /admin/zones est lisible par la route publique /api/zones (meme table)', async () => {
    const token = await adminToken();
    const created = await request(app)
      .post('/api/admin/zones')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Zone checkout', geometry: SQUARE });
    expect(created.status).toBe(201);

    // c'est la preuve que l'editeur ecrit dans la table que le gate zone du
    // checkout (useServiceZone.ts -> /api/zones) relit ensuite.
    const pub = await request(app).get('/api/zones');
    expect(pub.status).toBe(200);
    expect(pub.body.zones.map((z: { name: string }) => z.name)).toContain('Zone checkout');
  });
});
