import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import { assertWarehouseAccess } from '../lib/warehouseAccess.js';
import { CreateWarehouseSchema, PatchWarehouseSchema } from '../schemas/warehouse.js';

export const warehousesRouter = Router();

const managerSelect = { id: true, name: true, email: true };

// GET /api/warehouses — liste (authentifie)
warehousesRouter.get('/', requireAuth, async (_req, res, next) => {
  try {
    const warehouses = await prisma.warehouse.findMany({
      orderBy: { name: 'asc' },
      include: { manager: { select: managerSelect } },
    });
    res.json({ warehouses });
  } catch (err) {
    next(err);
  }
});

// GET /api/warehouses/:id — detail (authentifie)
warehousesRouter.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const warehouse = await prisma.warehouse.findUnique({
      where: { id: String(req.params['id']) },
      include: { manager: { select: managerSelect } },
    });
    if (!warehouse) return next(new HttpError(404, 'warehouse_not_found'));
    res.json({ warehouse });
  } catch (err) {
    next(err);
  }
});

// GET /api/warehouses/:id/stock — stock de l'entrepot (admin ou manager de CET entrepot)
warehousesRouter.get('/:id/stock', requireAuth, requireRole('admin', 'warehouse_manager'), async (req, res, next) => {
  try {
    const warehouseId = String(req.params['id']);
    await assertWarehouseAccess(req.user!, warehouseId);
    const stock = await prisma.warehouseStock.findMany({
      where: { warehouseId },
      include: { product: { select: { id: true, name: true, slug: true, imageUrl: true, categoryId: true } } },
      orderBy: { product: { name: 'asc' } },
    });
    res.json({ stock });
  } catch (err) {
    next(err);
  }
});

// POST /api/warehouses — creer (admin)
warehousesRouter.post('/', requireAuth, requireRole('admin'), async (req, res, next) => {
  const parsed = CreateWarehouseSchema.safeParse(req.body);
  if (!parsed.success) return next(new HttpError(422, 'validation_failed', { issues: parsed.error.issues }));
  try {
    // exactOptionalPropertyTypes : retirer les clés `undefined` avant Prisma
    const data = Object.fromEntries(
      Object.entries(parsed.data).filter(([, v]) => v !== undefined),
    ) as unknown as Prisma.WarehouseUncheckedCreateInput;
    const warehouse = await prisma.warehouse.create({ data });
    res.status(201).json({ warehouse });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/warehouses/:id — modifier, dont assignation d'un managerId (admin)
warehousesRouter.patch('/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
  const parsed = PatchWarehouseSchema.safeParse(req.body);
  if (!parsed.success) return next(new HttpError(422, 'validation_failed', { issues: parsed.error.issues }));
  const id = String(req.params['id']);
  try {
    // exactOptionalPropertyTypes : retirer les clés `undefined` avant Prisma
    const data = Object.fromEntries(
      Object.entries(parsed.data).filter(([, v]) => v !== undefined),
    ) as unknown as Prisma.WarehouseUncheckedUpdateInput;
    const warehouse = await prisma.warehouse.update({ where: { id }, data });
    res.json({ warehouse });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return next(new HttpError(404, 'warehouse_not_found'));
    }
    next(err);
  }
});
