import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { getMongo } from '../lib/mongo.js';

export const healthRouter = Router();

// Sonde de vivacite reelle. Ce endpoint est le HEALTHCHECK du conteneur
// (docker-compose.prod.yml) ET la porte que scripts/deploy.sh franchit avant de basculer
// l'upstream nginx : tant qu'il repondait 200 sans toucher a la base, un backend avec un
// DATABASE_URL casse demarrait « sain », prenait le trafic, puis renvoyait 500 sur chaque
// requete. Il prouve donc maintenant que le process peut vraiment servir : une requete
// Postgres triviale, bornee dans le temps.
//
// Postgres est bloquant, Mongo ne l'est PAS. C'est delibere et cela reprend la decision
// prise dans src/index.ts (initMongo est appele en non-fatal, D-14/AP3) : sans Mongo la
// couche GPS est desactivee mais l'API HTTP reste utile. Rendre Mongo bloquant ici
// inverserait ce choix : une panne Mongo marquerait les DEUX slots unhealthy, bloquerait
// tout deploiement et ferait echouer la bascule alors que le site fonctionne encore.
// L'etat Mongo est donc expose dans `checks` comme signal d'observabilite, sans influencer
// le code HTTP.
const DB_TIMEOUT_MS = 2000;
const MONGO_TIMEOUT_MS = 1000;
// Le HEALTHCHECK Docker tourne toutes les 10s par conteneur ; ce cache ne l'affecte donc
// jamais. Il ne sert qu'a amortir les appels externes, /api/health etant public.
const CACHE_TTL_MS = 1000;

type CheckState = 'ok' | 'down';
type HealthSnapshot = {
  healthy: boolean;
  checks: { database: CheckState; mongo: CheckState };
};

let cached: { at: number; snapshot: HealthSnapshot } | null = null;

// Borne une sonde dans le temps : un timeout doit FAIRE ECHOUER le check, pas laisser la
// requete pendre. Une sonde qui pend depasse le `timeout: 5s` de Docker et se comporte
// differemment d'un echec franc (le retry suivant repart de zero au lieu de decompter).
// La promesse d'origine reste rattrapee pour ne pas produire d'unhandled rejection.
async function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const guarded = work.catch((e: unknown) => {
    throw e instanceof Error ? e : new Error(String(e));
  });
  try {
    return await Promise.race([
      guarded,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`health probe timed out after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// SELECT 1 : le moins cher des allers-retours qui prouve reellement que le pool Prisma est
// connecte et que Postgres repond.
async function checkDatabase(): Promise<CheckState> {
  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, DB_TIMEOUT_MS);
    return 'ok';
  } catch {
    return 'down';
  }
}

// getMongo() leve tant qu'initMongo n'a pas abouti : c'est deja le signal « GPS indisponible ».
// Le ping couvre en plus le cas d'un client initialise puis deconnecte.
async function checkMongo(): Promise<CheckState> {
  try {
    const client = getMongo();
    await withTimeout(client.db().admin().command({ ping: 1 }), MONGO_TIMEOUT_MS);
    return 'ok';
  } catch {
    return 'down';
  }
}

async function snapshot(): Promise<HealthSnapshot> {
  const now = Date.now();
  if (cached && now - cached.at < CACHE_TTL_MS) return cached.snapshot;

  const [database, mongo] = await Promise.all([checkDatabase(), checkMongo()]);
  const fresh: HealthSnapshot = { healthy: database === 'ok', checks: { database, mongo } };
  cached = { at: now, snapshot: fresh };
  return fresh;
}

healthRouter.get('/', async (_req, res, next) => {
  try {
    const { healthy, checks } = await snapshot();
    // Forme retro-compatible : `status` / `uptime` / `timestamp` restent en place (le
    // HEALTHCHECK Docker et le `curl -sf` de la CI ne lisent que le code HTTP, mais le
    // README et les appels manuels lisent ces champs). `checks` est purement additif.
    res.status(healthy ? 200 : 503).json({
      status: healthy ? 'ok' : 'error',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      checks,
    });
  } catch (err) {
    next(err);
  }
});
