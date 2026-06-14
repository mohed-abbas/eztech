// Delivery zones seeded from the frontend mock — run with: npm run seed:zones
// The zone table is the authoritative gate for order dropoffs (pointInAnyZone). Seeding it
// from the same service-zones.json the frontend renders keeps client UX hints and the server
// gate in lockstep, so a point shown "in zone" can never be rejected by an empty/mismatched table.
// Idempotent: upserts by the feature's stable id, so re-running never duplicates.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const here = dirname(fileURLToPath(import.meta.url));
const mockDir = resolve(here, '../../frontend/app/data/mock');
const load = <T>(file: string): T => JSON.parse(readFileSync(resolve(mockDir, file), 'utf8')) as T;

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
