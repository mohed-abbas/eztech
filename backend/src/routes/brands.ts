import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import { CreateBrandSchema } from '../schemas/catalog.js';

export const brandsRouter = Router();

// GET /api/brands — public; powers the brand filter on the catalog
brandsRouter.get('/', async (_req, res, next) => {
  try {
    const brands = await prisma.brand.findMany({ orderBy: { name: 'asc' } });
    res.json({ brands });
  } catch (err) {
    next(err);
  }
});

// POST /api/brands — admin only
brandsRouter.post('/', requireAuth, requireRole('admin'), async (req, res, next) => {
  const parsed = CreateBrandSchema.safeParse(req.body);
  if (!parsed.success) return next(new HttpError(422, 'validation_failed', { issues: parsed.error.issues }));
  try {
    const brand = await prisma.brand.create({ data: parsed.data });
    res.status(201).json({ brand });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return next(new HttpError(409, 'slug_taken'));
    }
    next(err);
  }
});

// DELETE /api/brands/:id — admin only; products referencing it are unlinked (brandId → null)
brandsRouter.delete('/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
  const id = String(req.params['id']);
  try {
    await prisma.brand.delete({ where: { id } });
    res.status(204).end();
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return next(new HttpError(404, 'brand_not_found'));
    }
    next(err);
  }
});
