import { Router } from 'express';
import type { User } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import { PatchUserSchema } from '../schemas/user.js';

export const usersRouter = Router();

function buildUserResponse(user: User) {
  const { passwordHash: _h, ...rest } = user;
  return rest;
}

// GET /api/users/:id — admin only
usersRouter.get('/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
  const id = String(req.params['id']);
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return next(new HttpError(404, 'user_not_found'));
  res.json({ user: buildUserResponse(user) });
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
  }).catch(() => null); // Prisma throws P2025 on not-found

  if (!user) return next(new HttpError(404, 'user_not_found'));
  res.json({ user: buildUserResponse(user) });
});
