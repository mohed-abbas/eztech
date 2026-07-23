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
import { issueResetToken, consumeResetToken } from '../lib/reset-token.js';
import { issueVerificationToken, consumeVerificationToken } from '../lib/verification-token.js';
import { setAuthCookies, clearAuthCookies, getCookie, REFRESH_COOKIE } from '../lib/cookies.js';
import { sendEmail } from '../lib/resend.js';
import { passwordResetEmail, verifyEmailEmail } from '../lib/email/templates.js';
import {
  RegisterSchema, LoginSchema, RefreshSchema, LogoutSchema,
  ForgotPasswordSchema, ResetPasswordSchema, ChangePasswordSchema, GoogleAuthSchema,
  VerifyEmailSchema, ResendVerificationSchema,
} from '../schemas/auth.js';
import { OAuth2Client } from 'google-auth-library';
import { randomBytes } from 'node:crypto';

export const authRouter = Router();

// base frontend origin for the reset link — mirrors orders.ts/rider.ts/webhooks.ts's CORS_ORIGIN
// parsing (first entry is the primary frontend origin); no dedicated FRONTEND_URL env exists.
const FRONTEND_ORIGIN = (process.env['CORS_ORIGIN'] ?? 'http://localhost:3000').split(',')[0]!.trim();

// Reused verifier for Google Identity Services ID tokens (POST /api/auth/google). The same
// GOOGLE_CLIENT_ID works for every environment — the OAuth client registers both the localhost
// and production JavaScript origins, so no per-environment key is needed.
const googleClient = new OAuth2Client();

// strips passwordHash before sending to client
function buildUserResponse(user: User) {
  const { passwordHash: _h, ...rest } = user;
  return rest;
}

// Issue a fresh verification token and email its link. Essential mail (ignores emailOptOut). Never
// throws into the request path — a failed send must not fail registration; the user can re-request.
async function sendVerificationEmail(userId: string, email: string): Promise<void> {
  try {
    const raw = await issueVerificationToken(userId);
    const verifyUrl = `${FRONTEND_ORIGIN}/verify-email?token=${raw}`;
    const { subject, html, text } = verifyEmailEmail({ verifyUrl });
    await sendEmail({ to: email, subject, html, text });
  } catch {
    // best-effort — the resend endpoint is the recovery path
  }
}

// POST /api/auth/register
authRouter.post('/register', async (req, res, next) => {
  const result = RegisterSchema.safeParse(req.body);
  if (!result.success) return next(new HttpError(422, 'validation_failed', { issues: result.error.issues }));

  const { email, password, name, phone, vehicleType, licenseNumber, insuranceNumber, address } = result.data;

  // validate rider field combinations BEFORE the existence check so we don't leak a timing
  // oracle for email enumeration via a rider-payload + existing-email branch.
  if (vehicleType !== undefined && (!licenseNumber || !insuranceNumber)) {
    return next(new HttpError(422, 'validation_failed', { issues: [{ message: 'licenseNumber and insuranceNumber are required for riders' }] }));
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return next(new HttpError(409, 'email_taken'));

  const passwordHash = await hashPassword(password);
  const isRider = vehicleType !== undefined && !!licenseNumber && !!insuranceNumber;
  const user = await prisma.user.create({
    data: isRider
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
      : {
          email,
          passwordHash,
          name,
          phone: phone ?? '',
          role: 'customer',
          // a customer's address payload is persisted on registration; riders don't have one
          ...(address ? { addresses: { create: address } } : {}),
        },
    include: { addresses: true },
  });

  const token = signAccessToken({ sub: user.id, role: user.role });
  const refreshToken = await generateRefreshToken(user.id);
  const csrfToken = setAuthCookies(res, { token, refreshToken });

  // customers must confirm their email before their first order (Module 1) — send the link now.
  // Riders/managers/admins are provisioned/approved out of band and are not order-placers.
  if (user.role === 'customer') void sendVerificationEmail(user.id, user.email);

  res.status(201).json({ user: buildUserResponse(user), token, refreshToken, csrfToken });
});

// POST /api/auth/login
authRouter.post('/login', async (req, res, next) => {
  const result = LoginSchema.safeParse(req.body);
  if (!result.success) return next(new HttpError(422, 'validation_failed', { issues: result.error.issues }));

  const { email, password } = result.data;
  const user = await prisma.user.findUnique({ where: { email }, include: { addresses: true } });

  if (!user) {
    // constant-time: equalize timing against a real bcrypt compare (D9)
    await verifyPassword(password, DUMMY_HASH);
    return next(new HttpError(401, 'invalid_credentials'));
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return next(new HttpError(401, 'invalid_credentials'));

  const token = signAccessToken({ sub: user.id, role: user.role });
  const refreshToken = await generateRefreshToken(user.id);
  const csrfToken = setAuthCookies(res, { token, refreshToken });
  res.json({ user: buildUserResponse(user), token, refreshToken, csrfToken });
});

// POST /api/auth/refresh
authRouter.post('/refresh', async (req, res, next) => {
  // the refresh token comes from the httpOnly ez_refresh cookie (browser) or the request body
  // (native clients / tests). Cookie wins so a browser can refresh with an empty body.
  const bodyResult = RefreshSchema.safeParse(req.body);
  const raw = getCookie(req, REFRESH_COOKIE) ?? (bodyResult.success ? bodyResult.data.refreshToken : undefined);
  if (!raw) return next(new HttpError(401, 'invalid_refresh_token'));

  const payload = await verifyRefreshToken(raw);
  if (!payload) return next(new HttpError(401, 'invalid_refresh_token'));

  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user) return next(new HttpError(401, 'invalid_refresh_token'));

  const newRefreshToken = await rotateRefreshToken(raw, user.id);
  if (!newRefreshToken) return next(new HttpError(401, 'invalid_refresh_token'));

  const token = signAccessToken({ sub: user.id, role: user.role });
  const csrfToken = setAuthCookies(res, { token, refreshToken: newRefreshToken });
  res.json({ token, refreshToken: newRefreshToken, csrfToken });
});

// POST /api/auth/logout
authRouter.post('/logout', async (req, res, _next) => {
  // revoke whichever refresh token we can find (cookie or body) and always clear the cookies.
  const bodyResult = LogoutSchema.safeParse(req.body);
  const raw = getCookie(req, REFRESH_COOKIE) ?? (bodyResult.success ? bodyResult.data.refreshToken : undefined);
  if (raw) await revokeRefreshToken(raw);
  clearAuthCookies(res);
  res.status(204).send();
});

// GET /api/auth/me
authRouter.get('/me', requireAuth, async (req, res, next) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.sub }, include: { addresses: true } });
  if (!user) return next(new HttpError(401, 'user_revoked'));
  res.json({ user: buildUserResponse(user) });
});

// POST /api/auth/forgot-password
authRouter.post('/forgot-password', async (req, res, next) => {
  const result = ForgotPasswordSchema.safeParse(req.body);
  if (!result.success) return next(new HttpError(422, 'validation_failed', { issues: result.error.issues }));

  const { email } = result.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    const raw = await issueResetToken(user.id);
    const resetUrl = `${FRONTEND_ORIGIN}/reset-password?token=${raw}`;
    const { subject, html, text } = passwordResetEmail({ resetUrl });
    // essential — password reset ignores emailOptOut and is email-only (no in-app bell row, N-08)
    await sendEmail({ to: user.email, subject, html, text });
  }

  // always the same response regardless of whether the email exists (T-06-18 — no enumeration)
  res.status(200).json({ message: 'if that email exists, a reset link has been sent' });
});

// POST /api/auth/reset-password
authRouter.post('/reset-password', async (req, res, next) => {
  const result = ResetPasswordSchema.safeParse(req.body);
  if (!result.success) return next(new HttpError(422, 'validation_failed', { issues: result.error.issues }));

  const { token, password } = result.data;
  const userId = await consumeResetToken(token);
  if (!userId) return next(new HttpError(400, 'invalid_or_expired_token'));

  const passwordHash = await hashPassword(password);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  res.status(200).json({ message: 'password reset successfully' });
});

// POST /api/auth/verify-email — consume a verification token and stamp emailVerifiedAt (Module 1).
// The token itself is the credential, so this route is public (the link lands before login).
authRouter.post('/verify-email', async (req, res, next) => {
  const result = VerifyEmailSchema.safeParse(req.body);
  if (!result.success) return next(new HttpError(422, 'validation_failed', { issues: result.error.issues }));

  const userId = await consumeVerificationToken(result.data.token);
  if (!userId) return next(new HttpError(400, 'invalid_or_expired_token'));
  res.status(200).json({ message: 'email verified' });
});

// POST /api/auth/resend-verification — re-issue the confirmation link for an email. Always 200 and
// never reveals whether the address exists or is already verified (same anti-enumeration posture as
// forgot-password, T-06-18). The frontend passes the logged-in user's own email.
authRouter.post('/resend-verification', async (req, res, next) => {
  const result = ResendVerificationSchema.safeParse(req.body);
  if (!result.success) return next(new HttpError(422, 'validation_failed', { issues: result.error.issues }));

  const user = await prisma.user.findUnique({ where: { email: result.data.email } });
  // only (re)send for a real, still-unverified account; stay silent either way
  if (user && user.emailVerifiedAt === null) {
    await sendVerificationEmail(user.id, user.email);
  }
  res.status(200).json({ message: 'if that account exists and is unverified, a link has been sent' });
});

// POST /api/auth/change-password — authenticated rotation. Verifies the current password before
// setting the new one (H5). requireAuth ensures we rotate only the caller's own credential.
authRouter.post('/change-password', requireAuth, async (req, res, next) => {
  const result = ChangePasswordSchema.safeParse(req.body);
  if (!result.success) return next(new HttpError(422, 'validation_failed', { issues: result.error.issues }));

  const { currentPassword, newPassword } = result.data;
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
    if (!user) return next(new HttpError(404, 'user_not_found'));

    const ok = await verifyPassword(currentPassword, user.passwordHash);
    if (!ok) return next(new HttpError(400, 'invalid_current_password'));

    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    res.status(200).json({ message: 'password changed successfully' });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/google — Google Identity Services sign-in. The browser posts the GIS ID token as
// `credential`; we verify it against GOOGLE_CLIENT_ID, then upsert the user by verified email and
// issue our own JWT + httpOnly cookies (same session shape as register/login, Phase 7).
authRouter.post('/google', async (req, res, next) => {
  const result = GoogleAuthSchema.safeParse(req.body);
  if (!result.success) return next(new HttpError(422, 'validation_failed', { issues: result.error.issues }));

  const clientId = process.env['GOOGLE_CLIENT_ID'];
  if (!clientId) return next(new HttpError(503, 'google_auth_not_configured'));

  try {
    // verifyIdToken checks the signature, expiry, issuer AND that the token's audience is our
    // client id — a token minted for any other app is rejected here.
    const ticket = await googleClient.verifyIdToken({ idToken: result.data.credential, audience: clientId });
    const payload = ticket.getPayload();

    // require a Google-verified email before we trust it to match/create an account — otherwise a
    // Google account with an unverified address could hijack a local account sharing that email.
    if (!payload?.email || !payload.email_verified) {
      return next(new HttpError(401, 'google_email_unverified'));
    }

    const email = payload.email.toLowerCase();
    const name = payload.name || email.split('@')[0]!;

    // upsert by email: an existing account (local or previously Google) just logs in; a new one is
    // created with a random unusable password so the password-login path stays closed until reset.
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      const passwordHash = await hashPassword(randomBytes(32).toString('hex'));
      // Google already asserted email_verified above, so a Google-created account is verified on
      // creation — no confirmation link needed before its first order (Module 1).
      user = await prisma.user.create({ data: { email, name, phone: '', passwordHash, emailVerifiedAt: new Date() } });
    } else if (user.emailVerifiedAt === null) {
      // a pre-existing local account signing in via Google gets its address confirmed too
      user = await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
    }

    const token = signAccessToken({ sub: user.id, role: user.role });
    const refreshToken = await generateRefreshToken(user.id);
    const csrfToken = setAuthCookies(res, { token, refreshToken });
    res.status(200).json({ user: buildUserResponse(user), token, refreshToken, csrfToken });
  } catch (err) {
    // verifyIdToken throws on any invalid/expired/wrong-audience token — treat all as 401.
    if (err instanceof HttpError) return next(err);
    return next(new HttpError(401, 'invalid_google_token'));
  }
});
