import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { buildApp } from '../src/app.js';
import { truncateAuthTables, truncateCatalogTables, testPrisma } from './helpers/db.js';

const app = buildApp();

type AuthResponse = { token: string };

async function adminToken(): Promise<string> {
  const res = await request(app).post('/api/auth/login').send({ email: 'admin@eztech.fr', password: 'adminpass123' });
  return (res.body as AuthResponse).token;
}

async function customerToken(email = 'cust@example.com'): Promise<string> {
  const res = await request(app).post('/api/auth/register').send({ email, password: 'password123', name: 'Cust', phone: '' });
  return (res.body as AuthResponse).token;
}

async function seedCategory(slug = 'chargers') {
  return testPrisma.category.create({ data: { name: 'Chargeurs', slug, description: '', icon: '' } });
}

async function seedProduct(categoryId: string, over: Partial<{ slug: string; name: string; flatPrice: number; featured: boolean; isActive: boolean }> = {}) {
  return testPrisma.product.create({
    data: {
      name: over.name ?? 'Charger 96W',
      slug: over.slug ?? 'charger-96w',
      categoryId,
      pricingType: 'flat',
      flatPrice: over.flatPrice ?? 3.5,
      featured: over.featured ?? false,
      isActive: over.isActive ?? true,
      stock: 10,
    },
  });
}

describe('catalog public reads', () => {
  beforeEach(async () => {
    await truncateCatalogTables();
    await truncateAuthTables();
  });

  it('lists active products with their category', async () => {
    const cat = await seedCategory();
    await seedProduct(cat.id);

    const res = await request(app).get('/api/products');
    expect(res.status).toBe(200);
    const body = res.body as { products: Array<{ slug: string; category: { slug: string } }>; total: number };
    expect(body.total).toBe(1);
    expect(body.products[0]?.slug).toBe('charger-96w');
    expect(body.products[0]?.category.slug).toBe('chargers');
  });

  it('excludes inactive products', async () => {
    const cat = await seedCategory();
    await seedProduct(cat.id, { slug: 'active-1' });
    await seedProduct(cat.id, { slug: 'hidden-1', isActive: false });

    const res = await request(app).get('/api/products');
    const body = res.body as { total: number };
    expect(body.total).toBe(1);
  });

  it('filters by category slug', async () => {
    const chargers = await seedCategory('chargers');
    const cables = await testPrisma.category.create({ data: { name: 'Câbles', slug: 'cables', description: '', icon: '' } });
    await seedProduct(chargers.id, { slug: 'c-1' });
    await seedProduct(cables.id, { slug: 'c-2' });

    const res = await request(app).get('/api/products?category=cables');
    const body = res.body as { products: Array<{ slug: string }>; total: number };
    expect(body.total).toBe(1);
    expect(body.products[0]?.slug).toBe('c-2');
  });

  it('paginates', async () => {
    const cat = await seedCategory();
    await seedProduct(cat.id, { slug: 'p-1' });
    await seedProduct(cat.id, { slug: 'p-2' });

    const res = await request(app).get('/api/products?page=1&pageSize=1');
    const body = res.body as { products: unknown[]; total: number; pageSize: number };
    expect(body.total).toBe(2);
    expect(body.products).toHaveLength(1);
    expect(body.pageSize).toBe(1);
  });

  it('returns a product by slug, 404 for unknown', async () => {
    const cat = await seedCategory();
    await seedProduct(cat.id, { slug: 'macbook-air' });

    const ok = await request(app).get('/api/products/macbook-air');
    expect(ok.status).toBe(200);

    const missing = await request(app).get('/api/products/nope');
    expect(missing.status).toBe(404);
    expect((missing.body as { error: string }).error).toBe('product_not_found');
  });

  it('lists categories with active product counts', async () => {
    const cat = await seedCategory();
    await seedProduct(cat.id, { slug: 'x-1' });
    await seedProduct(cat.id, { slug: 'x-2', isActive: false });

    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(200);
    const body = res.body as { categories: Array<{ slug: string; _count: { products: number } }> };
    expect(body.categories[0]?._count.products).toBe(1); // inactive excluded
  });
});

describe('catalog admin mutations', () => {
  beforeEach(async () => {
    await truncateCatalogTables();
    await truncateAuthTables();
  });

  it('rejects unauthenticated create with 401', async () => {
    const cat = await seedCategory();
    const res = await request(app).post('/api/products').send({ name: 'P', slug: 'p', categoryId: cat.id, pricingType: 'flat', flatPrice: 1 });
    expect(res.status).toBe(401);
  });

  it('rejects a customer with 403', async () => {
    const cat = await seedCategory();
    const token = await customerToken();
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'P', slug: 'p', categoryId: cat.id, pricingType: 'flat', flatPrice: 1 });
    expect(res.status).toBe(403);
  });

  it('lets an admin create a product (201)', async () => {
    const cat = await seedCategory();
    const token = await adminToken();
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Charger', slug: 'charger-new', categoryId: cat.id, pricingType: 'flat', flatPrice: 4, compatibilityTags: ['USB-C'] });
    expect(res.status).toBe(201);
    expect((res.body as { product: { slug: string } }).product.slug).toBe('charger-new');
  });

  it('returns 409 on duplicate slug', async () => {
    const cat = await seedCategory();
    await seedProduct(cat.id, { slug: 'dup' });
    const token = await adminToken();
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Dup', slug: 'dup', categoryId: cat.id, pricingType: 'flat', flatPrice: 1 });
    expect(res.status).toBe(409);
    expect((res.body as { error: string }).error).toBe('slug_taken');
  });

  it('soft-deletes a product (hidden from public reads)', async () => {
    const cat = await seedCategory();
    const product = await seedProduct(cat.id, { slug: 'to-delete' });
    const token = await adminToken();

    const del = await request(app).delete(`/api/products/${product.id}`).set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(204);

    const get = await request(app).get('/api/products/to-delete');
    expect(get.status).toBe(404);

    const row = await testPrisma.product.findUnique({ where: { id: product.id } });
    expect(row?.isActive).toBe(false); // soft delete — row preserved
  });

  it('validates the body (422)', async () => {
    const token = await adminToken();
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '', slug: 'Bad Slug', pricingType: 'flat' });
    expect(res.status).toBe(422);
  });
});
