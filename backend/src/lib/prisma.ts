import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';
import { logger } from './logger.js';

// reuse a single client across hot-reloads in dev; one per process in prod
declare global {
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.__prisma ??
  new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['warn', 'error'],
  });

if (env.NODE_ENV !== 'production') globalThis.__prisma = prisma;

// Connexion anticipee, volontairement NON fatale. Prisma se connecte paresseusement : sans cet
// appel, un backend dont le DATABASE_URL est faux demarre proprement, log « backend listening »,
// et n'echoue qu'a la premiere requete metier. On force donc le pool a s'ouvrir au boot pour que
// le probleme apparaisse dans les logs tout de suite et que la premiere sonde /api/health ne paie
// pas le cout de la connexion.
// Le processus n'est PAS tue ici : c'est /api/health qui repond 503 tant que Postgres est
// injoignable, ce qui empeche deploy.sh de basculer l'upstream nginx sur un slot mort. Tuer le
// process ferait boucler `restart: unless-stopped` et priverait des logs.
void prisma.$connect().catch((e: unknown) => {
  logger.error({ e }, 'prisma: connexion initiale echouee, /api/health repondra 503');
});
