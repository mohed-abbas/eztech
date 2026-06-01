import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import { CreateCategorySchema, PatchCategorySchema } from '../schemas/catalog.js';

export const categoriesRouter = Router();

function clean<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

// GET /api/categories — public; includes active product counts for the catalog nav
categoriesRouter.get('/', async (_req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: { where: { isActive: true } } } } },
    });
    res.json({ categories });
  } catch (err) {
    next(err);
  }
});

// GET /api/categories/:slug — public; category with its active products
categoriesRouter.get('/:slug', async (req, res, next) => {
  const slug = String(req.params['slug']);
  try {
    const category = await prisma.category.findUnique({
      where: { slug },
      include: { products: { where: { isActive: true }, orderBy: { name: 'asc' } } },
    });
    if (!category) return next(new HttpError(404, 'category_not_found'));
    res.json({ category });
  } catch (err) {
    next(err);
  }
});

// POST /api/categories — admin only
categoriesRouter.post('/', requireAuth, requireRole('admin'), async (req, res, next) => {
  const parsed = CreateCategorySchema.safeParse(req.body);
  if (!parsed.success) return next(new HttpError(422, 'validation_failed', { issues: parsed.error.issues }));
  try {
    const category = await prisma.category.create({ data: clean(parsed.data) as Prisma.CategoryUncheckedCreateInput });
    res.status(201).json({ category });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return next(new HttpError(409, 'slug_taken'));
    }
    next(err);
  }
});

// PATCH /api/categories/:id — admin only
categoriesRouter.patch('/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
  const parsed = PatchCategorySchema.safeParse(req.body);
  if (!parsed.success) return next(new HttpError(422, 'validation_failed', { issues: parsed.error.issues }));
  const id = String(req.params['id']);
  try {
    const category = await prisma.category.update({
      where: { id },
      data: clean(parsed.data) as Prisma.CategoryUncheckedUpdateInput,
    });
    res.json({ category });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2025') return next(new HttpError(404, 'category_not_found'));
      if (err.code === 'P2002') return next(new HttpError(409, 'slug_taken'));
    }
    next(err);
  }
});

// DELETE /api/categories/:id — admin only; blocked while products still reference it
categoriesRouter.delete('/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
  const id = String(req.params['id']);
  try {
    await prisma.category.delete({ where: { id } });
    res.status(204).end();
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2025') return next(new HttpError(404, 'category_not_found'));
      if (err.code === 'P2003') return next(new HttpError(409, 'category_in_use'));
    }
    next(err);
  }
});
