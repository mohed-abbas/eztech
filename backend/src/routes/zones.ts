import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import { CreateZoneSchema, PatchZoneSchema } from '../schemas/zone.js';

export const zonesRouter = Router();

// GET /api/zones — public: active service zones (the frontend renders these as a UX hint)
zonesRouter.get('/', async (_req, res, next) => {
  try {
    const zones = await prisma.zone.findMany({ where: { isActive: true } });
    res.json({ zones });
  } catch (err) {
    next(err);
  }
});

// GET /api/zones/:id — public single zone
zonesRouter.get('/:id', async (req, res, next) => {
  try {
    const zone = await prisma.zone.findUnique({ where: { id: String(req.params['id']) } });
    if (!zone) return next(new HttpError(404, 'zone_not_found'));
    res.json({ zone });
  } catch (err) {
    next(err);
  }
});

// POST /api/zones — admin only
zonesRouter.post('/', requireAuth, requireRole('admin'), async (req, res, next) => {
  const parsed = CreateZoneSchema.safeParse(req.body);
  if (!parsed.success) return next(new HttpError(422, 'validation_failed', { issues: parsed.error.issues }));
  try {
    const zone = await prisma.zone.create({
      data: { name: parsed.data.name, geometry: parsed.data.geometry, ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}) },
    });
    res.status(201).json({ zone });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/zones/:id — admin only
zonesRouter.patch('/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
  const parsed = PatchZoneSchema.safeParse(req.body);
  if (!parsed.success) return next(new HttpError(422, 'validation_failed', { issues: parsed.error.issues }));
  const id = String(req.params['id']);
  try {
    const data: Prisma.ZoneUncheckedUpdateInput = {};
    if (parsed.data.name !== undefined) data.name = parsed.data.name;
    if (parsed.data.geometry !== undefined) data.geometry = parsed.data.geometry;
    if (parsed.data.isActive !== undefined) data.isActive = parsed.data.isActive;
    const zone = await prisma.zone.update({ where: { id }, data });
    res.json({ zone });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return next(new HttpError(404, 'zone_not_found'));
    }
    next(err);
  }
});

// DELETE /api/zones/:id — admin only; soft-delete so historical orders keep their zone reference
zonesRouter.delete('/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
  const id = String(req.params['id']);
  try {
    await prisma.zone.update({ where: { id }, data: { isActive: false } });
    res.status(204).end();
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return next(new HttpError(404, 'zone_not_found'));
    }
    next(err);
  }
});
