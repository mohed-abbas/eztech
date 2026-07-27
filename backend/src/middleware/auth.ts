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

// Same token resolution as requireAuth, but NEVER rejects: no token or an invalid/expired one simply
// leaves req.user undefined and continues. Used by routes that are public but behave differently for
// an authenticated admin — GET /api/products reads req.user?.role to honour ?includeInactive=true.
// It must not 401: the public catalog and the Nuxt BFF (frontend/server/api/products.ts) call that
// route anonymously, so forwarding an auth error here would take the whole storefront down.
export const optionalAuth: RequestHandler = (req, _res, next) => {
  const header = req.header('authorization');
  const bearer = header?.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
  const token = bearer || getCookie(req, ACCESS_COOKIE);
  if (!token) return next();
  try {
    req.user = verifyAccessToken(token);
  } catch {
    // token illisible/expire : on reste anonyme plutot que de refuser la requete
  }
  next();
};

export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    // requireAuth must run first — it sets req.user
    if (!req.user) return next(new HttpError(401, 'missing_token'));
    if (!roles.includes(req.user.role)) return next(new HttpError(403, 'forbidden'));
    next();
  };
}
