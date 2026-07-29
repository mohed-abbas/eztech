// Delivery zones seeded from prisma/data — run with: npm run seed:zones
// The zone table is the authoritative gate for order dropoffs (pointInAnyZone). Seeding it
// from the same service-zones.json the frontend renders keeps client UX hints and the server
// gate in lockstep, so a point shown "in zone" can never be rejected by an empty/mismatched table.
// Idempotent: upserts by the feature's stable id, so re-running never duplicates.
//
// Enjeu operationnel : lib/zones.ts fait `zones.some(...)` sur les zones actives. Table vide =>
// `.some()` renvoie false => TOUTE adresse de livraison est refusee hors zone et plus aucune
// commande ne peut etre creee. Ce seed doit donc etre rejouable en production, ce qu'il n'etait
// pas : il lisait `../../frontend/app/data/mock`, un chemin qui n'existe que grace au bind mount de
// docker-compose.yml en dev et absent de l'image de prod (contexte de build = ./backend), donc
// ENOENT et sortie en code 1. Le JSON vit maintenant dans prisma/data/, copie dans l'image par le
// `COPY prisma ./prisma` du Dockerfile.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const here = dirname(fileURLToPath(import.meta.url));

// Le seed tourne depuis deux emplacements : prisma/ sous tsx en dev, et dist/seed/prisma/ une fois
// compile (tsconfig.seed.json enracine au package). On teste donc les candidats dans l'ordre plutot
// que de coder en dur un chemin qui n'est juste que dans un des deux cas.
function resolveDataDir(): string {
  const candidates = [
    resolve(here, 'data'), // tsx : backend/prisma/data
    resolve(here, '../../../prisma/data'), // compile : /app/dist/seed/prisma -> /app/prisma/data
    resolve(process.cwd(), 'prisma/data'), // filet de securite (cwd = racine du package)
  ];
  const found = candidates.find((dir) => existsSync(dir));
  if (!found) throw new Error(`seed data directory not found, looked in:\n  ${candidates.join('\n  ')}`);
  return found;
}

const dataDir = resolveDataDir();
const load = <T>(file: string): T => JSON.parse(readFileSync(resolve(dataDir, file), 'utf8')) as T;

type ZoneFeature = {
  type: 'Feature';
  properties: { id: string; name: string; isActive: boolean };
  geometry: { type: 'Polygon'; coordinates: number[][][] };
};
type ZoneCollection = { type: 'FeatureCollection'; features: ZoneFeature[] };

async function main() {
  const { features } = load<ZoneCollection>('service-zones.json');

  for (const f of features) {
    await prisma.zone.upsert({
      where: { id: f.properties.id },
      update: { name: f.properties.name, geometry: f.geometry, isActive: f.properties.isActive },
      create: {
        id: f.properties.id,
        name: f.properties.name,
        geometry: f.geometry,
        isActive: f.properties.isActive,
      },
    });
  }

  const active = features.filter((f) => f.properties.isActive).length;
  console.log(`seeded: ${features.length} zones (${active} active)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
