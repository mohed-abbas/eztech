import { z } from 'zod';

// a GeoJSON Polygon: coordinates is an array of linear rings, each a list of [lng, lat] positions.
// stored verbatim in Zone.geometry (Json) and fed straight to Turf (Pitfall 5).
const PolygonGeometry = z
  .object({
    type: z.literal('Polygon'),
    coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))),
  })
  .superRefine((g, ctx) => {
    if (g.coordinates.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['coordinates'], message: 'polygon requires at least one ring' });
      return;
    }
    for (const ring of g.coordinates) {
      // a valid linear ring needs >= 4 positions and must be closed (first === last)
      if (ring.length < 4) {
        ctx.addIssue({ code: 'custom', path: ['coordinates'], message: 'ring requires at least 4 positions' });
        continue;
      }
      const first = ring[0]!;
      const last = ring[ring.length - 1]!;
      if (first[0] !== last[0] || first[1] !== last[1]) {
        ctx.addIssue({ code: 'custom', path: ['coordinates'], message: 'ring must be closed (first equals last)' });
      }
    }
  });

export const CreateZoneSchema = z.object({
  name: z.string().min(1),
  geometry: PolygonGeometry,
  isActive: z.boolean().optional(),
});

export const PatchZoneSchema = z.object({
  name: z.string().min(1).optional(),
  geometry: PolygonGeometry.optional(),
  isActive: z.boolean().optional(),
});
