import { Router } from 'express';
import type { User } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { signAccessToken, requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import { hashPassword, verifyPassword, DUMMY_HASH } from '../lib/password.js';
import {
  generateRefreshToken, rotateRefreshToken,
  revokeRefreshToken, verifyRefreshToken,
} from '../lib/refresh-token.js';
import {
  RegisterSchema, LoginSchema, RefreshSchema, LogoutSchema,
} from '../schemas/auth.js';

export const authRouter = Router();

// strips passwordHash before sending to client
function buildUserResponse(user: User) {
  const { passwordHash: _h, ...rest } = user;
  return rest;
}

// POST /api/auth/register
authRouter.post('/register', async (req, res, next) => {
  const result = RegisterSchema.safeParse(req.body);
  if (!result.success) return next(new HttpError(422, 'validation_failed', { issues: result.error.issues }));

  const { email, password, name, phone, vehicleType, licenseNumber, insuranceNumber } = result.data;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return next(new HttpError(409, 'email_taken'));

  // presence of vehicleType means this is a rider sign-up; licence + insurance are then required
  if (vehicleType !== undefined && (!licenseNumber || !insuranceNumber)) {
    return next(new HttpError(422, 'validation_failed', { issues: [{ message: 'licenseNumber and insuranceNumber are required for riders' }] }));
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data:
      vehicleType !== undefined && licenseNumber && insuranceNumber
        ? {
            email,
            passwordHash,
            name,
            phone: phone ?? '',
            role: 'rider',
            vehicleType,
            licenseNumber,
            insuranceNumber,
            riderApplicationStatus: 'pending',
          }
        : { email, passwordHash, name, phone: phone ?? '', role: 'customer' },
  });

  const token = signAccessToken({ sub: user.id, role: user.role });
  const refreshToken = await generateRefreshToken(user.id);
  res.status(201).json({ user: buildUserResponse(user), token, refreshToken });
});

// POST /api/auth/login
authRouter.post('/login', async (req, res, next) => {
  const result = LoginSchema.safeParse(req.body);
  if (!result.success) return next(new HttpError(422, 'validation_failed', { issues: result.error.issues }));

  const { email, password } = result.data;
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    // constant-time: equalize timing against a real bcrypt compare (D9)
    await verifyPassword(password, DUMMY_HASH);
    return next(new HttpError(401, 'invalid_credentials'));
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return next(new HttpError(401, 'invalid_credentials'));

  const token = signAccessToken({ sub: user.id, role: user.role });
  const refreshToken = await generateRefreshToken(user.id);
  res.json({ user: buildUserResponse(user), token, refreshToken });
});

// POST /api/auth/refresh
authRouter.post('/refresh', async (req, res, next) => {
  const result = RefreshSchema.safeParse(req.body);
  if (!result.success) return next(new HttpError(422, 'validation_failed', { issues: result.error.issues }));

  const { refreshToken: raw } = result.data;
  const payload = await verifyRefreshToken(raw);
  if (!payload) return next(new HttpError(401, 'invalid_refresh_token'));

  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user) return next(new HttpError(401, 'invalid_refresh_token'));

  const newRefreshToken = await rotateRefreshToken(raw, user.id);
  if (!newRefreshToken) return next(new HttpError(401, 'invalid_refresh_token'));

  const token = signAccessToken({ sub: user.id, role: user.role });
  res.json({ token, refreshToken: newRefreshToken });
});

// POST /api/auth/logout
authRouter.post('/logout', async (req, res, next) => {
  const result = LogoutSchema.safeParse(req.body);
  if (!result.success) return next(new HttpError(422, 'validation_failed', { issues: result.error.issues }));

  await revokeRefreshToken(result.data.refreshToken);
  res.status(204).send();
});

// GET /api/auth/me
authRouter.get('/me', requireAuth, async (req, res, next) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
  if (!user) return next(new HttpError(401, 'user_not_found'));
  res.json({ user: buildUserResponse(user) });
});

// POST /api/auth/forgot-password — stub for Phase 6; prevents frontend exception
authRouter.post('/forgot-password', (_req, res) => {
  res.status(200).json({ message: 'if that email exists, a reset link has been sent' });
});
