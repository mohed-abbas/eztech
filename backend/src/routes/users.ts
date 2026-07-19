import { Router } from 'express';
import type { User } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import { PatchUserSchema, ReviewRiderApplicationSchema, NotificationPrefsSchema } from '../schemas/user.js';

export const usersRouter = Router();

function buildUserResponse(user: User) {
  const { passwordHash: _h, ...rest } = user;
  return rest;
}

// PATCH /api/users/me/notifications — owner-scoped email opt-out toggle (NOTIF-07, T-06-10).
// Registered ABOVE /:id so 'me' is never captured as an :id param; keyed on req.user!.sub, never
// req.params.id, so a caller can only ever toggle their own preference.
usersRouter.patch('/me/notifications', requireAuth, async (req, res, next) => {
  const result = NotificationPrefsSchema.safeParse(req.body);
  if (!result.success) return next(new HttpError(422, 'validation_failed', { issues: result.error.issues }));

  try {
    const user = await prisma.user.update({
      where: { id: req.user!.sub },
      data: { emailOptOut: result.data.emailOptOut },
    });
    res.json({ user: buildUserResponse(user) });
  } catch (err) {
    next(err);
  }
});

// GET /api/users — admin only; optional ?role= and ?applicationStatus= filters (rider onboarding queue)
usersRouter.get('/', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const role = req.query['role'];
    const applicationStatus = req.query['applicationStatus'];
    const where: { role?: 'customer' | 'rider' | 'warehouse_manager' | 'admin'; riderApplicationStatus?: 'pending' | 'approved' | 'rejected' } = {};
    if (role === 'customer' || role === 'rider' || role === 'warehouse_manager' || role === 'admin') where.role = role;
    if (applicationStatus === 'pending' || applicationStatus === 'approved' || applicationStatus === 'rejected') where.riderApplicationStatus = applicationStatus;
    const users = await prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200 });
    res.json({ users: users.map(buildUserResponse) });
  } catch (err) {
    next(err);
  }
});

// GET /api/users/:id — admin only
usersRouter.get('/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
  const id = String(req.params['id']);
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return next(new HttpError(404, 'user_not_found'));
  res.json({ user: buildUserResponse(user) });
});

// PATCH /api/users/:id/rider-application — admin approves/rejects a rider onboarding application
usersRouter.patch('/:id/rider-application', requireAuth, requireRole('admin'), async (req, res, next) => {
  const result = ReviewRiderApplicationSchema.safeParse(req.body);
  if (!result.success) return next(new HttpError(422, 'validation_failed', { issues: result.error.issues }));

  const id = String(req.params['id']);
  try {
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return next(new HttpError(404, 'user_not_found'));
    if (target.role !== 'rider') return next(new HttpError(409, 'not_a_rider'));

    const user = await prisma.user.update({
      where: { id },
      // a rejected/pending rider is forced offline
      data: { riderApplicationStatus: result.data.status, ...(result.data.status !== 'approved' ? { riderOnline: false } : {}) },
    });
    res.json({ user: buildUserResponse(user) });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/users/:id — admin only (role changes, name, phone)
usersRouter.patch('/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
  const result = PatchUserSchema.safeParse(req.body);
  if (!result.success) return next(new HttpError(422, 'validation_failed', { issues: result.error.issues }));

  const id = String(req.params['id']);
  // filter undefined values to satisfy exactOptionalPropertyTypes
  const data = Object.fromEntries(
    Object.entries(result.data).filter(([, v]) => v !== undefined),
  ) as { name?: string; phone?: string; role?: 'customer' | 'rider' | 'warehouse_manager' | 'admin' };

  const user = await prisma.user.update({
    where: { id },
    data,
  }).catch((e: unknown) => {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') return null;
    throw e; // propagate unexpected errors to errorHandler (→ 500)
  });

  if (!user) return next(new HttpError(404, 'user_not_found'));
  res.json({ user: buildUserResponse(user) });
});
