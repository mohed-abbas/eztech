import type { RequestHandler } from 'express';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';
import { HttpError } from './error.js';

export type Role = 'customer' | 'rider' | 'warehouse_manager' | 'admin';

export interface JwtPayload {
  sub: string;
  role: Role;
}

export function signAccessToken(payload: JwtPayload, opts?: SignOptions): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL,
    ...opts,
  } as SignOptions);
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.header('authorization');
  if (!header?.startsWith('Bearer ')) return next(new HttpError(401, 'missing_token'));
  try {
    req.user = verifyAccessToken(header.slice('Bearer '.length));
    next();
  } catch {
    next(new HttpError(401, 'invalid_token'));
  }
};
