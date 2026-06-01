import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import { CreateProductSchema, PatchProductSchema, ProductQuerySchema } from '../schemas/catalog.js';

export const productsRouter = Router();

const withRelations = { category: true, brand: true } as const;

// strips undefined so Prisma uses column defaults (exactOptionalPropertyTypes)
function clean<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

// GET /api/products — public catalog listing with filters, sort, pagination
productsRouter.get('/', async (req, res, next) => {
  const parsed = ProductQuerySchema.safeParse(req.query);
  if (!parsed.success) return next(new HttpError(422, 'validation_failed', { issues: parsed.error.issues }));
  const { category, brand, search, featured, sort, page, pageSize } = parsed.data;

  const where: Prisma.ProductWhereInput = { isActive: true };
  if (category) where.category = { slug: category };
  if (brand) where.brand = { slug: brand };
  if (featured) where.featured = featured === 'true';
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  // price sort is approximate across pricing types (flat → flatPrice, tiered → dailyPrice)
  const dir = sort === 'price_desc' ? 'desc' : 'asc';
  const orderBy: Prisma.ProductOrderByWithRelationInput[] =
    sort === 'newest'
      ? [{ createdAt: 'desc' }]
      : [{ flatPrice: { sort: dir, nulls: 'last' } }, { dailyPrice: { sort: dir, nulls: 'last' } }];

  try {
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: withRelations,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.product.count({ where }),
    ]);
    res.json({ products, page, pageSize, total });
  } catch (err) {
    next(err);
  }
});

// GET /api/products/:slug — public product detail
productsRouter.get('/:slug', async (req, res, next) => {
  const slug = String(req.params['slug']);
  try {
    const product = await prisma.product.findFirst({ where: { slug, isActive: true }, include: withRelations });
    if (!product) return next(new HttpError(404, 'product_not_found'));
    res.json({ product });
  } catch (err) {
    next(err);
  }
});

// POST /api/products — admin only
productsRouter.post('/', requireAuth, requireRole('admin'), async (req, res, next) => {
  const parsed = CreateProductSchema.safeParse(req.body);
  if (!parsed.success) return next(new HttpError(422, 'validation_failed', { issues: parsed.error.issues }));
  try {
    const product = await prisma.product.create({
      data: clean(parsed.data) as Prisma.ProductUncheckedCreateInput,
      include: withRelations,
    });
    res.status(201).json({ product });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2002') return next(new HttpError(409, 'slug_taken'));
      if (err.code === 'P2003') return next(new HttpError(422, 'invalid_relation')); // bad categoryId/brandId
    }
    next(err);
  }
});

// PATCH /api/products/:id — admin only
productsRouter.patch('/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
  const parsed = PatchProductSchema.safeParse(req.body);
  if (!parsed.success) return next(new HttpError(422, 'validation_failed', { issues: parsed.error.issues }));
  const id = String(req.params['id']);
  try {
    const product = await prisma.product.update({
      where: { id },
      data: clean(parsed.data) as Prisma.ProductUncheckedUpdateInput,
      include: withRelations,
    });
    res.json({ product });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2025') return next(new HttpError(404, 'product_not_found'));
      if (err.code === 'P2002') return next(new HttpError(409, 'slug_taken'));
    }
    next(err);
  }
});

// DELETE /api/products/:id — admin only; soft delete so existing orders keep their reference
productsRouter.delete('/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
  const id = String(req.params['id']);
  try {
    await prisma.product.update({ where: { id }, data: { isActive: false } });
    res.status(204).end();
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return next(new HttpError(404, 'product_not_found'));
    }
    next(err);
  }
});
