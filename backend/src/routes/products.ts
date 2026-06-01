import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import { CreateProductSchema, PatchProductSchema, ProductQuerySchema } from '../schemas/catalog.js';
import { clean, sortPriceFor } from '../lib/catalog.js';

export const productsRouter = Router();

const withRelations = { category: true, brand: true } as const;

const toNum = (d: Prisma.Decimal | null): number | null => (d == null ? null : Number(d));

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

  // sortPrice is the coalesced price kept in sync on write, so it orders flat and tiered products together
  const dir = sort === 'price_desc' ? 'desc' : 'asc';
  const orderBy: Prisma.ProductOrderByWithRelationInput[] =
    sort === 'newest' ? [{ createdAt: 'desc' }] : [{ sortPrice: dir }];

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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/products/:idOrSlug — public product detail (frontend links by id; slug also accepted)
productsRouter.get('/:idOrSlug', async (req, res, next) => {
  const key = String(req.params['idOrSlug']);
  // only match on id when the param is a uuid — querying the uuid column with a slug throws
  const where: Prisma.ProductWhereInput = UUID_RE.test(key)
    ? { isActive: true, OR: [{ id: key }, { slug: key }] }
    : { isActive: true, slug: key };
  try {
    const product = await prisma.product.findFirst({ where, include: withRelations });
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
      data: { ...clean(parsed.data), sortPrice: sortPriceFor(parsed.data) } as Prisma.ProductUncheckedCreateInput,
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
    // load current pricing so sortPrice stays correct after a partial price update
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) return next(new HttpError(404, 'product_not_found'));

    const pick = (key: 'flatPrice' | 'hourlyPrice' | 'dailyPrice' | 'weeklyPrice') =>
      parsed.data[key] !== undefined ? parsed.data[key] : toNum(existing[key]);
    const sortPrice = sortPriceFor({
      flatPrice: pick('flatPrice'),
      hourlyPrice: pick('hourlyPrice'),
      dailyPrice: pick('dailyPrice'),
      weeklyPrice: pick('weeklyPrice'),
    });

    const product = await prisma.product.update({
      where: { id },
      data: { ...clean(parsed.data), sortPrice } as Prisma.ProductUncheckedUpdateInput,
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
