import { describe, it, expect } from 'vitest';
import { authRouter } from '../src/routes/auth.js';
import { RATE_LIMITED_AUTH_PATHS, UNLIMITED_AUTH_PATHS } from '../src/middleware/rateLimit.js';

// Le backstop express-rate-limit etait monte sur TOUT /api/auth. Comme le front appelle
// GET /api/auth/me a chaque navigation, une cinquantaine de pages suffisait a epuiser la fenetre
// (50 req / 15 min / IP) : le /me suivant repondait 429, auth.init() le traitait comme « non
// connecte » et renvoyait l'utilisateur vers /login en pleine session. Le limiteur ne couvre donc
// plus que les routes qui verifient un secret devinable.
//
// Le limiteur lui-meme est desactive sous NODE_ENV=test (rateLimit.ts), donc son comportement ne
// peut pas etre teste ici. Ce qui est verifiable — et ce qui casserait reellement plus tard — c'est
// la DERIVE : une nouvelle route d'authentification ajoutee sans etre couverte. C'est ce que ce
// test garde.

function declaredAuthPaths(): string[] {
  // Express expose les routes montees sur un Router via son stack interne.
  const stack = (authRouter as unknown as { stack: { route?: { path: string } }[] }).stack;
  const paths = stack.filter((l) => l.route?.path).map((l) => l.route!.path);
  return [...new Set(paths)];
}

describe('backstop de rate limiting sur /api/auth', () => {
  it('couvre toutes les routes qui verifient un secret, sans exception non declaree', () => {
    const limited = new Set(RATE_LIMITED_AUTH_PATHS.map((p) => p.replace('/api/auth', '')));
    const allowedUnlimited = new Set<string>(UNLIMITED_AUTH_PATHS);

    const uncovered = declaredAuthPaths().filter((p) => !limited.has(p) && !allowedUnlimited.has(p));

    // Si ce test echoue : une route a ete ajoutee a routes/auth.ts sans decision explicite.
    // Ajoutez-la a RATE_LIMITED_AUTH_PATHS, ou a UNLIMITED_AUTH_PATHS si elle n'expose aucun
    // secret devinable — mais ne supprimez pas l'assertion.
    expect(uncovered).toEqual([]);
  });

  it('ne limite ni /me ni /logout — la raison d etre du montage par route', () => {
    const limited = RATE_LIMITED_AUTH_PATHS.map((p) => p.replace('/api/auth', ''));
    expect(limited).not.toContain('/me');
    expect(limited).not.toContain('/logout');
  });

  it('ne limite aucune route inexistante (liste et routeur restent alignes)', () => {
    const declared = new Set(declaredAuthPaths());
    const orphans = RATE_LIMITED_AUTH_PATHS
      .map((p) => p.replace('/api/auth', ''))
      .filter((p) => !declared.has(p));
    expect(orphans).toEqual([]);
  });
});
