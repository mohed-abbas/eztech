import rateLimit from 'express-rate-limit';

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
