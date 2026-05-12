import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import { CreateReturnSchema } from '../schemas/return.js';
import { generateReturnReference } from '../lib/orders.js';
import { notifyOnlineRiders } from '../lib/notifications.js';

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
    const ret = await prisma.return.create({
      data: {
        ...data,
        reference: generateReturnReference(),
        customerId: customerId ?? (req.user!.role === 'customer' ? req.user!.sub : null),
        ...(orderId !== undefined ? { orderId } : {}),
        ...(scheduledFor !== undefined ? { scheduledFor } : {}),
        ...(riderFee !== undefined ? { riderFee: new Prisma.Decimal(riderFee) } : { riderFee: new Prisma.Decimal(4) }),
      },
    });
    await notifyOnlineRiders('return_scheduled', 'Nouveau retour à récupérer', `Retour ${ret.reference} planifié`);
    res.status(201).json({ return: { ...ret, riderFee: Number(ret.riderFee) } });
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
