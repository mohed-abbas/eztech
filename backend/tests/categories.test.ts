import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { buildApp } from '../src/app.js';
import { truncateAuthTables, truncateCatalogTables, testPrisma } from './helpers/db.js';

// CRUD /api/categories — le seul consommateur est app/pages/admin/categories.vue, qui traduit
// chaque code d'erreur en copie francaise (slug_taken, category_in_use, category_not_found).
// catalog.test.ts ne couvre que le GET de listing : POST/PATCH/DELETE n'avaient aucun test.
const app = buildApp();

type AuthResponse = { token: string };
type ErrorBody = { error: string; details?: { issues?: Array<{ path: (string | number)[] }> } };

async function adminToken(): Promise<string> {
  const res = await request(app).post('/api/auth/login').send({ email: 'admin@eztech.fr', password: 'adminpass123' });
  return (res.body as AuthResponse).token;
}

async function customerToken(email = 'cat-cust@example.com'): Promise<string> {
  const res = await request(app).post('/api/auth/register').send({ email, password: 'password123', name: 'Cust', phone: '' });
  return (res.body as AuthResponse).token;
}

async function seedCategory(slug = 'cat-chargers') {
  return testPrisma.category.create({ data: { name: 'Chargeurs', slug, description: '', icon: '' } });
}

beforeEach(async () => {
  await truncateCatalogTables();
  await truncateAuthTables();
});

describe('categories CRUD — autorisation', () => {
  it('refuse un POST anonyme (401 missing_token)', async () => {
    const res = await request(app).post('/api/categories').send({ name: 'Cables', slug: 'cables' });
    expect(res.status).toBe(401);
    expect((res.body as ErrorBody).error).toBe('missing_token');
  });

  it('refuse un POST client (403 forbidden)', async () => {
    const token = await customerToken();
    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Cables', slug: 'cables' });
    expect(res.status).toBe(403);
    expect((res.body as ErrorBody).error).toBe('forbidden');
  });

  it('refuse un PATCH client (403 forbidden)', async () => {
    const cat = await seedCategory();
    const token = await customerToken('cat-cust-patch@example.com');
    const res = await request(app)
      .patch(`/api/categories/${cat.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Pirate' });
    expect(res.status).toBe(403);
    expect((res.body as ErrorBody).error).toBe('forbidden');

    // la ligne ne doit pas avoir bouge
    const row = await testPrisma.category.findUnique({ where: { id: cat.id } });
    expect(row?.name).toBe('Chargeurs');
  });

  it('refuse un DELETE client (403 forbidden) et laisse la ligne en place', async () => {
    const cat = await seedCategory();
    const token = await customerToken('cat-cust-del@example.com');
    const res = await request(app).delete(`/api/categories/${cat.id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect((res.body as ErrorBody).error).toBe('forbidden');
    expect(await testPrisma.category.findUnique({ where: { id: cat.id } })).not.toBeNull();
  });

  it('refuse un DELETE anonyme (401 missing_token)', async () => {
    const cat = await seedCategory();
    const res = await request(app).delete(`/api/categories/${cat.id}`);
    expect(res.status).toBe(401);
    expect((res.body as ErrorBody).error).toBe('missing_token');
  });
});

describe('categories CRUD — parcours admin', () => {
  it('cree une categorie (201) et la persiste', async () => {
    const token = await adminToken();
    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Cables', slug: 'cables', description: 'Cables USB-C', icon: 'cable' });
    expect(res.status).toBe(201);
    const body = res.body as { category: { id: string; slug: string; name: string } };
    expect(body.category.slug).toBe('cables');

    const row = await testPrisma.category.findUnique({ where: { id: body.category.id } });
    expect(row?.name).toBe('Cables'); // relu depuis la base, pas depuis la reponse
  });

  it('renomme une categorie (200) et renvoie le nouveau nom', async () => {
    const cat = await seedCategory();
    const token = await adminToken();
    const res = await request(app)
      .patch(`/api/categories/${cat.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Chargeurs rapides' });
    expect(res.status).toBe(200);
    expect((res.body as { category: { name: string } }).category.name).toBe('Chargeurs rapides');

    const row = await testPrisma.category.findUnique({ where: { id: cat.id } });
    expect(row?.name).toBe('Chargeurs rapides');
  });

  it('supprime une categorie vide (204) et la retire du listing', async () => {
    const cat = await seedCategory('cat-to-delete');
    const token = await adminToken();

    const del = await request(app).delete(`/api/categories/${cat.id}`).set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(204);

    const list = await request(app).get('/api/categories');
    expect(list.status).toBe(200);
    const slugs = (list.body as { categories: Array<{ slug: string }> }).categories.map((c) => c.slug);
    expect(slugs).not.toContain('cat-to-delete');
  });
});

describe('categories CRUD — conflits et validation', () => {
  it('renvoie 409 slug_taken sur un slug deja pris', async () => {
    await seedCategory('cat-dup');
    const token = await adminToken();
    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Doublon', slug: 'cat-dup' });
    expect(res.status).toBe(409);
    expect((res.body as ErrorBody).error).toBe('slug_taken');
  });

  it('renvoie 404 category_not_found sur un PATCH d\'id inconnu', async () => {
    const token = await adminToken();
    const res = await request(app)
      .patch('/api/categories/11111111-1111-4111-8111-111111111111')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Fantome' });
    expect(res.status).toBe(404);
    expect((res.body as ErrorBody).error).toBe('category_not_found');
  });

  it('renvoie 409 category_in_use si un produit reference encore la categorie', async () => {
    const cat = await seedCategory('cat-in-use');
    // un vrai Product : le 409 vient de la contrainte FK (P2003), pas d'un simple compteur
    await testPrisma.product.create({
      data: {
        name: 'Charger 96W',
        slug: 'cat-in-use-charger',
        categoryId: cat.id,
        pricingType: 'flat',
        flatPrice: 3.5,
        sortPrice: 3.5,
        stock: 1,
      },
    });
    const token = await adminToken();

    const res = await request(app).delete(`/api/categories/${cat.id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(409);
    expect((res.body as ErrorBody).error).toBe('category_in_use');
    expect(await testPrisma.category.findUnique({ where: { id: cat.id } })).not.toBeNull();
  });

  it('renvoie 404 category_not_found sur un DELETE d\'id inconnu', async () => {
    const token = await adminToken();
    const res = await request(app)
      .delete('/api/categories/22222222-2222-4222-8222-222222222222')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect((res.body as ErrorBody).error).toBe('category_not_found');
  });

  it('renvoie 422 validation_failed avec une issue sur `slug` pour un slug invalide', async () => {
    const token = await adminToken();
    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Mauvais', slug: 'Bad Slug!' });
    expect(res.status).toBe(422);
    const body = res.body as ErrorBody;
    expect(body.error).toBe('validation_failed');
    expect(body.details?.issues?.some((i) => i.path.includes('slug'))).toBe(true);
  });

  it('renvoie 422 validation_failed pour un nom vide', async () => {
    const token = await adminToken();
    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '', slug: 'nom-vide' });
    expect(res.status).toBe(422);
    expect((res.body as ErrorBody).error).toBe('validation_failed');
  });
});
