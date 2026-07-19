import { randomBytes } from 'node:crypto';
import type { Request, Response } from 'express';

// Cookie-based session transport (Phase 7). The JWT access + refresh tokens are issued as
// httpOnly cookies so SSR, the Nuxt BFF, and the Socket.io handshake all authenticate without
// JS ever touching the tokens. A separate readable ez_csrf cookie backs double-submit CSRF.
// Express's res.cookie() is built in; we only hand-parse the request Cookie header (no cookie-parser dep).

export const ACCESS_COOKIE = 'ez_access';
export const REFRESH_COOKIE = 'ez_refresh';
export const CSRF_COOKIE = 'ez_csrf';

const isProd = process.env['NODE_ENV'] === 'production';
const ACCESS_MAX_AGE = 15 * 60 * 1000; // mirrors JWT_ACCESS_TTL default (15m)
const REFRESH_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7d

// base flags shared by every auth cookie. secure only in prod so dev over plain http still works.
const base = { sameSite: 'lax' as const, secure: isProd, path: '/' };

export function parseCookieHeader(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    if (key) out[key] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

export function getCookie(req: Request, name: string): string | undefined {
  return parseCookieHeader(req.headers.cookie)[name];
}

// Issue the session cookies. Returns the CSRF token so the caller can also surface it in the JSON body.
export function setAuthCookies(res: Response, tokens: { token: string; refreshToken: string }): string {
  const csrf = randomBytes(24).toString('hex');
  res.cookie(ACCESS_COOKIE, tokens.token, { ...base, httpOnly: true, maxAge: ACCESS_MAX_AGE });
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, { ...base, httpOnly: true, maxAge: REFRESH_MAX_AGE });
  // readable by JS on purpose — the SPA echoes it back in the x-csrf-token header (double-submit).
  res.cookie(CSRF_COOKIE, csrf, { ...base, httpOnly: false, maxAge: REFRESH_MAX_AGE });
  return csrf;
}

// Refresh only rotates the access + csrf cookies (refresh token is rotated separately by the caller).
export function setAccessCookie(res: Response, token: string): void {
  res.cookie(ACCESS_COOKIE, token, { ...base, httpOnly: true, maxAge: ACCESS_MAX_AGE });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE, base);
  res.clearCookie(REFRESH_COOKIE, base);
  res.clearCookie(CSRF_COOKIE, base);
}
