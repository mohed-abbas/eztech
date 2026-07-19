import type { RequestHandler } from 'express';
import { HttpError } from './error.js';
import { ACCESS_COOKIE, CSRF_COOKIE, getCookie } from '../lib/cookies.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Unauthenticated auth-bootstrap endpoints: no session/CSRF token can exist yet (login, register)
// or the flow is token-gated by other means (password reset). Mounted under /api, so req.path here
// is the post-mount path (e.g. /auth/login).
const CSRF_EXEMPT_PATHS = new Set([
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
]);

// Double-submit CSRF (Phase 7). Enforced ONLY when the request is authenticated via the ambient
// session cookie — the only case an attacker can ride. Exempt:
//   - safe methods (no state change)
//   - Authorization: Bearer requests (not cookie-driven — native clients, tests)
//   - requests with no ez_access cookie (login, refresh-by-body, Stripe webhook, etc.)
// The SPA reads the readable ez_csrf cookie and echoes it back in the x-csrf-token header.
export const csrfProtection: RequestHandler = (req, _res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();
  if (CSRF_EXEMPT_PATHS.has(req.path)) return next();
  if (req.header('authorization')?.startsWith('Bearer ')) return next();
  if (!getCookie(req, ACCESS_COOKIE)) return next();

  const cookieToken = getCookie(req, CSRF_COOKIE);
  const headerToken = req.header('x-csrf-token');
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return next(new HttpError(403, 'csrf_failed'));
  }
  next();
};
