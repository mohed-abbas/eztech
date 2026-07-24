import { Router } from 'express';
import type { User } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import {
  PatchUserSchema, ReviewRiderApplicationSchema, NotificationPrefsSchema,
  UpdateMeSchema, CreateAddressSchema, PatchAddressSchema,
} from '../schemas/user.js';

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

// PATCH /api/users/me — l'utilisateur met a jour SON profil (nom, telephone). Comme ci-dessus,
// declare avant /:id et keye sur req.user!.sub : on ne peut jamais modifier quelqu'un d'autre,
// ni son propre role (absent du schema).
usersRouter.patch('/me', requireAuth, async (req, res, next) => {
  const result = UpdateMeSchema.safeParse(req.body);
  if (!result.success) return next(new HttpError(422, 'validation_failed', { issues: result.error.issues }));

  try {
    // exactOptionalPropertyTypes : retirer les cles `undefined` avant Prisma
    const data = Object.fromEntries(
      Object.entries(result.data).filter(([, v]) => v !== undefined),
    ) as unknown as Prisma.UserUncheckedUpdateInput;
    const user = await prisma.user.update({
      where: { id: req.user!.sub },
      data,
      include: { addresses: true },
    });
    res.json({ user: buildUserResponse(user) });
  } catch (err) {
    next(err);
  }
});

// GET /api/users/me/addresses — adresses de l'utilisateur connecte
usersRouter.get('/me/addresses', requireAuth, async (req, res, next) => {
  try {
    const addresses = await prisma.address.findMany({ where: { userId: req.user!.sub }, orderBy: { createdAt: 'asc' } });
    res.json({ addresses });
  } catch (err) {
    next(err);
  }
});

// POST /api/users/me/addresses — ajouter une adresse
usersRouter.post('/me/addresses', requireAuth, async (req, res, next) => {
  const result = CreateAddressSchema.safeParse(req.body);
  if (!result.success) return next(new HttpError(422, 'validation_failed', { issues: result.error.issues }));

  try {
    const address = await prisma.address.create({ data: { ...result.data, userId: req.user!.sub } });
    res.status(201).json({ address });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/users/me/addresses/:addressId — modifier une adresse dont on est proprietaire
usersRouter.patch('/me/addresses/:addressId', requireAuth, async (req, res, next) => {
  const result = PatchAddressSchema.safeParse(req.body);
  if (!result.success) return next(new HttpError(422, 'validation_failed', { issues: result.error.issues }));

  try {
    // exactOptionalPropertyTypes : retirer les cles `undefined` avant Prisma
    const data = Object.fromEntries(
      Object.entries(result.data).filter(([, v]) => v !== undefined),
    ) as unknown as Prisma.AddressUncheckedUpdateManyInput;
    // updateMany garde par userId : une adresse d'un autre compte renvoie 404 (aucune fuite d'existence)
    const updated = await prisma.address.updateMany({
      where: { id: String(req.params['addressId']), userId: req.user!.sub },
      data,
    });
    if (updated.count === 0) return next(new HttpError(404, 'address_not_found'));
    const address = await prisma.address.findUnique({ where: { id: String(req.params['addressId']) } });
    res.json({ address });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/users/me/addresses/:addressId — supprimer une adresse dont on est proprietaire
usersRouter.delete('/me/addresses/:addressId', requireAuth, async (req, res, next) => {
  try {
    const deleted = await prisma.address.deleteMany({
      where: { id: String(req.params['addressId']), userId: req.user!.sub },
    });
    if (deleted.count === 0) return next(new HttpError(404, 'address_not_found'));
    res.status(204).end();
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
