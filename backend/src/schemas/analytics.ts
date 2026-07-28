import { z } from 'zod';

// Les dates d'analytics sont des DATES CALENDAIRES PARIS ("YYYY-MM-DD"), pas des instants ISO.
// Le serveur les convertit en bornes UTC (voir resolveRange dans routes/analytics.ts) : les colonnes
// Prisma sont des `timestamp without time zone` qui stockent de l'UTC, donc un bucket « jour » ne
// peut pas etre calcule sans passer explicitement par le fuseau Europe/Paris.
// La forme seule ne suffit pas : "2026-02-31" passe la regex puis est silencieusement reporte au
// 3 mars par Date.UTC, et une annee extreme ("9999-12-31") deborde en +010000 lors du calcul de la
// borne haute — un format d'annee etendue que Postgres refuse, d'ou un 500 sur une saisie utilisateur.
// On exige donc une date calendaire reelle, dans une plage d'annees ou toutes les bornes restent
// representables.
const isoDay = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'format YYYY-MM-DD attendu')
  .refine((s) => {
    const [y, m, d] = s.split('-').map(Number) as [number, number, number];
    if (y < 2000 || y > 2999) return false;
    const dt = new Date(Date.UTC(y, m - 1, d));
    // rejette tout report de calendrier : la date reconstruite doit etre identique a la saisie
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  }, 'date calendaire invalide');

export const DateRangeQuerySchema = z.object({
  from: isoDay.optional(),
  to: isoDay.optional(),
});

export const RevenueQuerySchema = DateRangeQuerySchema.extend({
  // ignore des que `from` ET `to` sont fournis — la plage explicite gagne
  period: z.enum(['week', 'month', 'year']).default('month'),
});

export const TopProductsQuerySchema = DateRangeQuerySchema.extend({
  // z.coerce : Express livre toujours des chaines dans req.query
  limit: z.coerce.number().int().min(1).max(20).default(5),
});

export type DateRangeQuery = z.infer<typeof DateRangeQuerySchema>;
export type RevenueQuery = z.infer<typeof RevenueQuerySchema>;
export type TopProductsQuery = z.infer<typeof TopProductsQuerySchema>;
