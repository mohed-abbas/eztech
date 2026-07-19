import type { RequestHandler } from 'express';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env.js';
import { HttpError } from './error.js';
import { ACCESS_COOKIE, getCookie } from '../lib/cookies.js';

const JwtPayloadSchema = z.object({
  sub: z.string().min(1),
  role: z.enum(['customer', 'rider', 'warehouse_manager', 'admin']),
});

export type JwtPayload = z.infer<typeof JwtPayloadSchema>;
export type Role = JwtPayload['role'];

export function signAccessToken(payload: JwtPayload, opts?: SignOptions): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL,
    ...opts,
  } as SignOptions);
}

export function verifyAccessToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  // parse throws ZodError on invalid shape; requireAuth catches and converts to 401
  return JwtPayloadSchema.parse(decoded);
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  // Prefer a non-empty Authorization header (native/mobile clients, tests); otherwise fall back to
  // the httpOnly ez_access cookie so SSR, the Nuxt BFF, and same-origin browser calls authenticate
  // too (Phase 7). An empty "Bearer " must NOT shadow the cookie.
  const header = req.header('authorization');
  const bearer = header?.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
  const token = bearer || getCookie(req, ACCESS_COOKIE);
  if (!token) return next(new HttpError(401, 'missing_token'));
  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    next(new HttpError(401, 'invalid_token'));
  }
};

export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    // requireAuth must run first — it sets req.user
    if (!req.user) return next(new HttpError(401, 'missing_token'));
    if (!roles.includes(req.user.role)) return next(new HttpError(403, 'forbidden'));
    next();
  };
}
