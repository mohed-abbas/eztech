import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { buildApp } from '../src/app.js';
import { truncateAuthTables, truncateCatalogTables, testPrisma } from './helpers/db.js';

// Regressions du formulaire produit admin (defauts 1 et 2 de l'audit du 27/07) :
//  1. le formulaire envoie `description: null` / `imageUrl: null` pour un champ vide — le schema Zod
//     les refusait (`z.string().optional()`) et repondait 422 validation_failed.
//  2. GET /api/products n'avait aucun middleware d'auth, donc req.user etait toujours undefined et
//     ?includeInactive=true ne faisait rien : un produit desactive (delete = soft delete) disparaissait
//     definitivement de la liste admin.
// Fichier separe de catalog.test.ts pour ne pas entrer en conflit avec les autres agents.
const app = buildApp();

type AuthResponse = { token: string };

async function adminToken(): Promise<string> {
  const res = await request(app).post('/api/auth/login').send({ email: 'admin@eztech.fr', password: 'adminpass123' });
  return (res.body as AuthResponse).token;
}

async function customerToken(email = 'catalog-defect-cust@example.com'): Promise<string> {
  const res = await request(app).post('/api/auth/register').send({ email, password: 'password123', name: 'Cust', phone: '' });
  return (res.body as AuthResponse).token;
}

async function seedCategory(slug = 'defect-chargers') {
  return testPrisma.category.create({ data: { name: 'Chargeurs', slug, description: '', icon: '' } });
}

const basePayload = (categoryId: string) => ({
  name: 'Chargeur 96W',
  slug: 'defect-charger-96w',
  categoryId,
  pricingType: 'flat' as const,
  flatPrice: 3.5,
  stock: 5,
});

beforeEach(async () => {
  await truncateCatalogTables();
  await truncateAuthTables();
});

describe('defaut 1 — description/imageUrl nullables', () => {
  // Les colonnes Product.description/imageUrl sont NOT NULL DEFAULT '' : le null accepte en entree
  // est normalise en '' par le schema, il n'est jamais ecrit tel quel (sinon Prisma leve → 500).
  it('accepte description: null a la creation (201) et le normalise en chaine vide', async () => {
    const token = await adminToken();
    const cat = await seedCategory();

    const res = await request(app).post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...basePayload(cat.id), description: null, imageUrl: null });

    expect(res.status).toBe(201);
    const id = res.body.product.id as string;

    const inDb = await testPrisma.product.findUnique({ where: { id } });
    expect(inDb?.description).toBe('');
    expect(inDb?.imageUrl).toBe('');
  });

  it('un PATCH avec description: null efface la description', async () => {
    const token = await adminToken();
    const cat = await seedCategory();
    const created = await request(app).post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...basePayload(cat.id), description: 'Un texte' });
    expect(created.status).toBe(201);
    const id = created.body.product.id as string;

    const patched = await request(app).patch(`/api/products/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: null });
    expect(patched.status).toBe(200);

    const inDb = await testPrisma.product.findUnique({ where: { id } });
    expect(inDb?.description).toBe('');
  });

  it('categoryId reste obligatoire a la creation (422)', async () => {
    const token = await adminToken();
    const cat = await seedCategory();
    const { categoryId: _drop, ...noCategory } = basePayload(cat.id);

    const res = await request(app).post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...noCategory, description: null });
    expect(res.status).toBe(422);
  });
});

describe('defaut 2 — ?includeInactive=true honore pour un admin', () => {
  it('rend un produit soft-delete a l\'admin, mais pas a un anonyme ni a un client', async () => {
    const token = await adminToken();
    const cat = await seedCategory();

    const created = await request(app).post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send(basePayload(cat.id));
    expect(created.status).toBe(201);
    const id = created.body.product.id as string;

    // soft delete
    const removed = await request(app).delete(`/api/products/${id}`).set('Authorization', `Bearer ${token}`);
    expect(removed.status).toBe(204);
    expect((await testPrisma.product.findUnique({ where: { id } }))?.isActive).toBe(false);

    // admin + includeInactive : le produit est de nouveau visible
    const asAdmin = await request(app).get('/api/products?includeInactive=true')
      .set('Authorization', `Bearer ${token}`);
    expect(asAdmin.status).toBe(200);
    expect((asAdmin.body.products as Array<{ id: string }>).map((p) => p.id)).toContain(id);

    // anonyme : jamais, meme avec le flag
    const anon = await request(app).get('/api/products?includeInactive=true');
    expect(anon.status).toBe(200);
    expect((anon.body.products as Array<{ id: string }>).map((p) => p.id)).not.toContain(id);

    // client authentifie : le flag est ignore (le role est verifie cote serveur)
    const cust = await customerToken();
    const asCustomer = await request(app).get('/api/products?includeInactive=true')
      .set('Authorization', `Bearer ${cust}`);
    expect(asCustomer.status).toBe(200);
    expect((asCustomer.body.products as Array<{ id: string }>).map((p) => p.id)).not.toContain(id);
  });

  it('optionalAuth ne renvoie jamais 401 : un token invalide reste anonyme (200)', async () => {
    const cat = await seedCategory();
    const token = await adminToken();
    await request(app).post('/api/products').set('Authorization', `Bearer ${token}`).send(basePayload(cat.id));

    // c'est le point critique : la vitrine publique et le BFF Nuxt appellent cette route sans token,
    // et un cookie expire ne doit pas faire tomber tout le catalogue.
    const res = await request(app).get('/api/products').set('Authorization', 'Bearer not-a-real-jwt');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
  });
});
