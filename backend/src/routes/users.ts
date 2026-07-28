import { Router } from 'express';
import type { User } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import {
  PatchUserSchema, PatchMeSchema, ReviewRiderApplicationSchema, NotificationPrefsSchema,
  CreateAddressSchema, PatchAddressSchema,
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

// PATCH /api/users/me — owner-scoped self-service profile update (H5). Registered ABOVE /:id so
// 'me' is never captured as an :id param. Keyed on req.user!.sub, never req.params, so a caller can
// only ever edit their own record. Cannot touch email or role (see PatchMeSchema). Returns addresses
// so the profile store keeps them after a save.
usersRouter.patch('/me', requireAuth, async (req, res, next) => {
  const result = PatchMeSchema.safeParse(req.body);
  if (!result.success) return next(new HttpError(422, 'validation_failed', { issues: result.error.issues }));

  // filter undefined to satisfy exactOptionalPropertyTypes (mirrors the admin PATCH /:id handler)
  const data = Object.fromEntries(
    Object.entries(result.data).filter(([, v]) => v !== undefined),
  ) as { name?: string; phone?: string; vehicleType?: 'bicycle' | 'scooter' | 'car'; licenseNumber?: string; insuranceNumber?: string };

  try {
    const user = await prisma.user.update({ where: { id: req.user!.sub }, data, include: { addresses: true } });
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

// POST /api/users/me/addresses — ajouter une adresse.
// La toute premiere adresse d'un compte devient automatiquement l'adresse par defaut : sans cela le
// checkout n'aurait aucune adresse a preselectionner et retomberait sur un ordre arbitraire.
usersRouter.post('/me/addresses', requireAuth, async (req, res, next) => {
  const result = CreateAddressSchema.safeParse(req.body);
  if (!result.success) return next(new HttpError(422, 'validation_failed', { issues: result.error.issues }));

  const userId = req.user!.sub;
  try {
    const address = await prisma.$transaction(async (tx) => {
      const existing = await tx.address.count({ where: { userId } });
      return tx.address.create({ data: { ...result.data, userId, isDefault: existing === 0 } });
    });
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

// PATCH /api/users/me/addresses/:addressId/default — designer une adresse comme adresse par defaut.
// Corps vide : la cible est entierement portee par l'URL, il n'y a donc rien a valider.
// Tout se joue dans une seule transaction pour qu'il n'existe jamais deux adresses par defaut, meme
// transitoirement. Comme le PATCH voisin, la promotion passe par updateMany garde par userId : une
// adresse appartenant a un autre compte renvoie 404 exactement comme un id inexistant (aucune fuite
// d'existence). Repond avec la liste complete relue pour que le client remplace son tableau d'un bloc.
usersRouter.patch('/me/addresses/:addressId/default', requireAuth, async (req, res, next) => {
  const userId = req.user!.sub;
  const addressId = String(req.params['addressId']);
  try {
    const addresses = await prisma.$transaction(async (tx) => {
      const promoted = await tx.address.updateMany({ where: { id: addressId, userId }, data: { isDefault: true } });
      if (promoted.count === 0) throw new HttpError(404, 'address_not_found');
      await tx.address.updateMany({ where: { userId, id: { not: addressId } }, data: { isDefault: false } });
      return tx.address.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
    });
    res.json({ addresses });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/users/me/addresses/:addressId — supprimer une adresse dont on est proprietaire.
// Si l'adresse supprimee etait celle par defaut, la plus ancienne restante prend le relais dans la
// meme transaction : sinon le compte se retrouverait sans adresse par defaut du tout.
usersRouter.delete('/me/addresses/:addressId', requireAuth, async (req, res, next) => {
  const userId = req.user!.sub;
  const addressId = String(req.params['addressId']);
  try {
    await prisma.$transaction(async (tx) => {
      // lecture gardee par userId : une adresse etrangere renvoie null, comme un id inexistant
      const target = await tx.address.findFirst({ where: { id: addressId, userId }, select: { isDefault: true } });
      const deleted = await tx.address.deleteMany({ where: { id: addressId, userId } });
      if (deleted.count === 0) throw new HttpError(404, 'address_not_found');
      if (target?.isDefault) {
        const fallback = await tx.address.findFirst({ where: { userId }, orderBy: { createdAt: 'asc' } });
        if (fallback) await tx.address.update({ where: { id: fallback.id }, data: { isDefault: true } });
      }
    });
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

// GET /api/users/:id/rider-documents — admin only; the onboarding review panel needs to see a
// candidate's uploaded documents. It cannot reuse GET /api/rider/documents: that router is gated
// wholesale by requireRole('rider') (routes/rider.ts:29) and scoped to req.user!.sub, so an admin
// token gets 403 there. Loosening the rider router would widen every rider endpoint, hence this
// dedicated admin path. The files themselves are already admin-readable (routes/uploads.ts:12-16).
usersRouter.get('/:id/rider-documents', requireAuth, requireRole('admin'), async (req, res, next) => {
  const id = String(req.params['id']);
  try {
    const documents = await prisma.riderDocument.findMany({
      where: { riderId: id },
      orderBy: { uploadedAt: 'desc' },
    });
    res.json({ documents });
  } catch (err) {
    next(err);
  }
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
