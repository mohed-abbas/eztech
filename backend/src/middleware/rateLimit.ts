import rateLimit from 'express-rate-limit';

// Les routes de /api/auth qui verifient un secret devinable et doivent donc porter le backstop.
// Volontairement une liste explicite plutot que `app.use('/api/auth', ...)` : le limiteur est de
// 50 requetes / 15 min / IP et le front appelle GET /api/auth/me a chaque navigation, donc monter
// le limiteur sur tout le routeur deconnectait l'utilisateur au bout d'une cinquantaine de pages —
// et tous les utilisateurs derriere un meme NAT partageaient ce budget.
//
// `/me` et `/logout` en sont exclus a dessein : ils n'exposent aucun secret devinable (`/me` exige
// deja un token valide). Toute NOUVELLE route de auth.ts qui verifie un mot de passe, un token de
// reinitialisation ou une identite externe doit etre ajoutee ici — le test
// backend/tests/auth-rate-limit.test.ts echoue sinon.
export const RATE_LIMITED_AUTH_PATHS = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/verify-email',
  '/api/auth/resend-verification',
  '/api/auth/change-password',
  '/api/auth/google',
] as const;

// Les seules routes de /api/auth legitimement non limitees.
export const UNLIMITED_AUTH_PATHS = ['/me', '/logout'] as const;

// Thin app-layer backstop for /api/auth. nginx's `eztech_auth` limit_req zone (rate=5r/m, plan
// 08-07) is the PRIMARY limiter (D-04) — it fronts every request before it reaches this process.
// This limiter only matters if traffic somehow bypasses nginx, so it is deliberately looser than
// the nginx zone. It must never be mounted on /socket.io/ (that path is attached directly to the
// http.Server in index.ts, not to this Express app, so app-level middleware never sees it anyway).
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // generous ceiling — nginx enforces the real per-minute rate
  standardHeaders: true,
  legacyHeaders: false,
  // The vitest suite reuses a single buildApp() instance across dozens of /api/auth/* calls per
  // test file (e.g. tests/auth.test.ts's registerAndLogin helper), which would trip this window
  // long before nginx ever would in production. Disabled only under NODE_ENV=test; every other
  // environment (dev, staging, prod) keeps the backstop active.
  skip: () => process.env['NODE_ENV'] === 'test',
  handler: (_req, res) => {
    res.status(429).json({ error: 'too_many_requests' });
  },
});
