import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import { CreateReturnSchema, ProcessReturnSchema } from '../schemas/return.js';
import { generateReturnReference } from '../lib/orders.js';
import { notifyOnlineRiders, notify } from '../lib/notifications.js';

export const returnsRouter = Router();

// POST /api/returns — a customer (or admin) schedules a return pickup
returnsRouter.post('/', requireAuth, requireRole('customer', 'admin'), async (req, res, next) => {
  const result = CreateReturnSchema.safeParse(req.body);
  if (!result.success) return next(new HttpError(422, 'validation_failed', { issues: result.error.issues }));

  try {
    const { customerId, riderFee, scheduledFor, orderId, ...rest } = result.data;
    const data = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined)) as {
      pickupAddress: string;
      pickupLat?: number;
      pickupLng?: number;
    };

    // resolve and validate the customer — same rules as POST /api/orders
    let effectiveCustomerId: string | null = null;
    if (req.user!.role === 'admin') {
      if (customerId !== undefined) {
        const target = await prisma.user.findUnique({ where: { id: customerId }, select: { id: true, role: true } });
        if (!target || target.role !== 'customer') return next(new HttpError(422, 'invalid_customer'));
        effectiveCustomerId = target.id;
      }
    }
    else {
      effectiveCustomerId = req.user!.sub;
    }

    // if an orderId is supplied, it must exist and belong to the same customer (when known)
    if (orderId !== undefined) {
      const order = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true, customerId: true } });
      if (!order) return next(new HttpError(422, 'invalid_order'));
      if (effectiveCustomerId !== null && order.customerId !== null && order.customerId !== effectiveCustomerId) {
        return next(new HttpError(403, 'order_belongs_to_other_customer'));
      }
    }

    const ret = await prisma.return.create({
      data: {
        ...data,
        reference: generateReturnReference(),
        customerId: effectiveCustomerId,
        ...(orderId !== undefined ? { orderId } : {}),
        ...(scheduledFor !== undefined ? { scheduledFor } : {}),
        ...(riderFee !== undefined ? { riderFee: new Prisma.Decimal(riderFee) } : { riderFee: new Prisma.Decimal(4) }),
      },
    });
    await notifyOnlineRiders('return_scheduled', 'Nouveau retour à récupérer', `Retour ${ret.reference} planifié`).catch(() => {});
    res.status(201).json({ return: { ...ret, riderFee: Number(ret.riderFee) } });
  } catch (err) {
    next(err);
  }
});

// GET /api/returns — file d'inspection entrepot : retours collectes (a inspecter) + traites recents
returnsRouter.get('/', requireAuth, requireRole('warehouse_manager', 'admin'), async (_req, res, next) => {
  try {
    const [toInspect, processed] = await Promise.all([
      prisma.return.findMany({ where: { status: 'completed', inspectionResult: null }, orderBy: { completedAt: 'asc' } }),
      prisma.return.findMany({ where: { inspectionResult: { not: null } }, orderBy: { inspectedAt: 'desc' }, take: 20 }),
    ]);
    const serialize = (r: { riderFee: unknown }) => ({ ...r, riderFee: Number(r.riderFee) });
    res.json({ toInspect: toInspect.map(serialize), processed: processed.map(serialize) });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/returns/:id/process — inspection entrepot d'un retour collecte (available/damaged).
// available → remet les articles de la commande liee en stock dans l'entrepot du manager (+ journal).
returnsRouter.patch('/:id/process', requireAuth, requireRole('warehouse_manager', 'admin'), async (req, res, next) => {
  const parsed = ProcessReturnSchema.safeParse(req.body);
  if (!parsed.success) return next(new HttpError(422, 'validation_failed', { issues: parsed.error.issues }));
  const id = String(req.params['id']);
  const { sub, role } = req.user!;
  try {
    const ret = await prisma.return.findUnique({ where: { id } });
    if (!ret) return next(new HttpError(404, 'return_not_found'));
    if (ret.status !== 'completed') return next(new HttpError(422, 'return_not_collected'));
    if (ret.inspectionResult !== null) return next(new HttpError(409, 'return_already_processed'));

    // entrepot cible pour la remise en stock : celui du manager, sinon celui fourni par l'admin
    let warehouseId: string | null = null;
    if (parsed.data.result === 'available') {
      if (role === 'warehouse_manager') {
        const wh = await prisma.warehouse.findFirst({ where: { managerId: sub }, select: { id: true } });
        if (!wh) return next(new HttpError(403, 'no_managed_warehouse'));
        warehouseId = wh.id;
      } else if (parsed.data.warehouseId) {
        const wh = await prisma.warehouse.findUnique({ where: { id: parsed.data.warehouseId }, select: { id: true } });
        if (!wh) return next(new HttpError(422, 'invalid_warehouse'));
        warehouseId = wh.id;
      } else {
        return next(new HttpError(422, 'warehouse_required'));
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const r = await tx.return.update({
        where: { id },
        data: {
          inspectionResult: parsed.data.result,
          inspectedAt: new Date(),
          ...(parsed.data.note ? { inspectionNote: parsed.data.note } : {}),
        },
      });

      // remise en stock des articles de la commande liee (si presente)
      if (parsed.data.result === 'available' && warehouseId && r.orderId) {
        const items = await tx.orderItem.findMany({ where: { orderId: r.orderId }, select: { productId: true, quantity: true } });
        for (const item of items) {
          await tx.warehouseStock.upsert({
            where: { warehouseId_productId: { warehouseId, productId: item.productId } },
            create: { warehouseId, productId: item.productId, quantity: item.quantity },
            update: { quantity: { increment: item.quantity } },
          });
          await tx.stockAdjustment.create({
            data: { warehouseId, productId: item.productId, actorId: sub, delta: item.quantity, reason: `retour ${r.reference}` },
          });
        }
      }
      return r;
    });

    // notification client (best-effort, hors transaction)
    if (updated.customerId) {
      const msg = parsed.data.result === 'available'
        ? 'Votre article retourne a ete verifie et remis en stock.'
        : 'Votre article retourne a ete verifie : il est endommage.';
      await notify(updated.customerId, 'return_processed', `Retour ${updated.reference} traite`, msg).catch(() => {});
    }

    res.json({ return: { ...updated, riderFee: Number(updated.riderFee) } });
  } catch (err) {
    next(err);
  }
});

// GET /api/returns/:id — visible to the owning customer, the assigned rider, or an admin
returnsRouter.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const ret = await prisma.return.findUnique({ where: { id: String(req.params['id']) } });
    if (!ret) return next(new HttpError(404, 'return_not_found'));
    const { sub, role } = req.user!;
    if (!(role === 'admin' || ret.customerId === sub || ret.riderId === sub)) return next(new HttpError(403, 'forbidden'));
    res.json({ return: { ...ret, riderFee: Number(ret.riderFee) } });
  } catch (err) {
    next(err);
  }
});
