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

// statuts d'une commande encore a preparer (avant que le livreur ne l'emporte)
const TO_PREPARE_STATUSES = ['pending_assignment', 'rider_assigned', 'at_warehouse'] as const;

// GET /api/warehouses/:id/orders — commandes entrantes a preparer pour cet entrepot (admin ou son manager)
warehousesRouter.get('/:id/orders', requireAuth, requireRole('admin', 'warehouse_manager'), async (req, res, next) => {
  try {
    const warehouseId = String(req.params['id']);
    await assertWarehouseAccess(req.user!, warehouseId);
    const orders = await prisma.order.findMany({
      where: { warehouseId, status: { in: [...TO_PREPARE_STATUSES] } },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        reference: true,
        status: true,
        preparedAt: true,
        createdAt: true,
        dropoffAddress: true,
        items: { select: { name: true, quantity: true } },
      },
    });
    res.json({ orders });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/warehouses/:id/orders/:orderId/prepare — marquer la commande prete pour le ramassage
warehousesRouter.patch('/:id/orders/:orderId/prepare', requireAuth, requireRole('admin', 'warehouse_manager'), async (req, res, next) => {
  try {
    const warehouseId = String(req.params['id']);
    const orderId = String(req.params['orderId']);
    await assertWarehouseAccess(req.user!, warehouseId);
    const order = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true, warehouseId: true } });
    if (!order || order.warehouseId !== warehouseId) return next(new HttpError(404, 'order_not_found'));
    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { preparedAt: new Date() },
      select: { id: true, reference: true, preparedAt: true },
    });
    res.json({ order: updated });
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
