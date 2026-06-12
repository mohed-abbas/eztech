import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';
import { prisma } from './prisma.js';

// authoritative server-side dropoff check (D-13/D-14) — the frontend useServiceZone check is a
// pre-submit UX hint only. lng/lat ordering matches the frontend exactly (point([lng, lat])).
export async function pointInAnyZone(lng: number, lat: number): Promise<boolean> {
  const zones = await prisma.zone.findMany({ where: { isActive: true } });
  const pt = point([lng, lat]);
  return zones.some((z) => booleanPointInPolygon(pt, z.geometry as never));
}
