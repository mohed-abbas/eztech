import { Router } from 'express';
import type { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import {
  DateRangeQuerySchema,
  RevenueQuerySchema,
  TopProductsQuerySchema,
} from '../schemas/analytics.js';

export const analyticsRouter = Router();

// Un seul garde, pose sur le routeur : aucun handler ajoute plus tard ne peut etre publie par
// inadvertance. /api/analytics n'est PAS dans l'allowlist nginx qui detourne certains /api vers le
// BFF Nuxt (products, orders, zones, config, geocode) — verifie en prod : GET
// /api/analytics/orders-per-day repond 404 {"error":"not_found"}, la reponse du notFoundHandler
// Express, alors que /api/orders repond l'enveloppe H3 de Nitro.
analyticsRouter.use(requireAuth, requireRole('admin'));

const PARIS = 'Europe/Paris';
const DAY_MS = 86_400_000;
const MAX_RANGE_DAYS = 366;

// ─────────────────────────────────────────────────────────────────────────────
// Fuseau horaire
//
// Toutes les colonnes DateTime de Prisma sont des `timestamp without time zone` qui contiennent de
// l'heure murale UTC, et la session Postgres est en UTC. Un `date_trunc('day', "createdAt")` classe
// donc par jour UTC et se trompe de bucket pour toute commande passee entre 00:00 et 02:00 a Paris.
// La SEULE expression correcte est :
//     ("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Paris')::date
// Le premier AT TIME ZONE dit « cette valeur naive est de l'UTC », le second la projette sur Paris.
// Ecrire seulement `"createdAt" AT TIME ZONE 'Europe/Paris'` decale dans le MAUVAIS sens.
// On ne fait jamais `SET TIME ZONE` : Prisma mutualise les connexions et le reglage fuirait.
// L'expression est reecrite telle quelle dans chaque requete taggee ci-dessous ; elle n'est pas
// factorisee dans une constante pour qu'aucune concatenation de chaine n'entre dans le SQL.
// ─────────────────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// Decalage (en minutes) de Paris par rapport a UTC A CET INSTANT. Derive d'Intl, jamais code en dur :
// +120 en heure d'ete, +60 en heure d'hiver, et la bascule suit la base tzdata.
function parisOffsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: PARIS,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);
  const get = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((p) => p.type === type)?.value ?? '0');
  const hour = get('hour') % 24; // en-US hour12:false peut rendre "24" a minuit
  const asIfUtc = Date.UTC(get('year'), get('month') - 1, get('day'), hour, get('minute'), get('second'));
  return Math.round((asIfUtc - at.getTime()) / 60_000);
}

function parseLabel(label: string): [number, number, number] {
  const parts = label.split('-');
  return [Number(parts[0]), Number(parts[1]), Number(parts[2])];
}

// Instant UTC correspondant a 00:00:00.000 Paris du jour calendaire `label`.
// Deux passes : la premiere estimation utilise le decalage a minuit UTC, la seconde le corrige avec
// le decalage reellement en vigueur a l'instant trouve (necessaire les nuits de changement d'heure).
function parisMidnightUtc(label: string): Date {
  const [y, m, d] = parseLabel(label);
  const naive = Date.UTC(y, m - 1, d);
  let ts = naive - parisOffsetMinutes(new Date(naive)) * 60_000;
  ts = naive - parisOffsetMinutes(new Date(ts)) * 60_000;
  return new Date(ts);
}

function parisToday(): string {
  // en-CA formate en YYYY-MM-DD
  return new Date().toLocaleDateString('en-CA', { timeZone: PARIS });
}

function addDays(label: string, n: number): string {
  const [y, m, d] = parseLabel(label);
  return new Date(Date.UTC(y, m - 1, d) + n * DAY_MS).toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = parseLabel(a);
  const [by, bm, bd] = parseLabel(b);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / DAY_MS);
}

// Les bornes sont comparees a des colonnes `timestamp without time zone` : on les envoie donc en
// heure murale UTC ("YYYY-MM-DD HH:MM:SS") et on les caste explicitement en ::timestamp cote SQL,
// pour ne dependre d'aucune inference de type du driver.
function naiveUtc(d: Date): string {
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

type ResolvedRange = {
  gte: string; // borne basse incluse, heure murale UTC
  lt: string; // borne haute EXCLUE (minuit Paris du lendemain de `toLabel`)
  gteDate: Date; // memes bornes pour les filtres Prisma classiques
  ltDate: Date;
  fromLabel: string;
  toLabel: string;
  days: number;
};

function resolveRange(
  query: { from?: string | undefined; to?: string | undefined },
  defaults?: { from: string; to: string },
): ResolvedRange {
  const fallbackTo = defaults?.to ?? parisToday();
  const fallbackFrom = defaults?.from ?? addDays(fallbackTo, -29);
  const fromLabel = query.from ?? fallbackFrom;
  const toLabel = query.to ?? fallbackTo;

  if (daysBetween(fromLabel, toLabel) < 0) throw new HttpError(422, 'invalid_range');
  const days = daysBetween(fromLabel, toLabel) + 1;
  if (days > MAX_RANGE_DAYS) throw new HttpError(422, 'range_too_large');

  const gteDate = parisMidnightUtc(fromLabel);
  const ltDate = parisMidnightUtc(addDays(toLabel, 1));
  return { gte: naiveUtc(gteDate), lt: naiveUtc(ltDate), gteDate, ltDate, fromLabel, toLabel, days };
}

function rangeBlock(r: ResolvedRange) {
  return { from: r.fromLabel, to: r.toLabel, timezone: PARIS };
}

function dayKeys(fromLabel: string, days: number): string[] {
  return Array.from({ length: days }, (_, i) => addDays(fromLabel, i));
}

function monthKeys(fromLabel: string, toLabel: string): string[] {
  const [fy, fm] = parseLabel(fromLabel);
  const [ty, tm] = parseLabel(toLabel);
  const keys: string[] = [];
  let y = fy;
  let m = fm;
  while (y < ty || (y === ty && m <= tm)) {
    keys.push(`${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-01`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return keys;
}

// Projette un resultat SQL creux (seuls les jours non vides remontent) sur la liste contigue des
// cles attendues, de sorte que le graphe cote client n'ait aucun trou a combler.
function zeroFill<Row extends { bucket: string }, Out>(
  keys: string[],
  rows: Row[],
  empty: (key: string) => Out,
  map: (key: string, row: Row) => Out,
): Out[] {
  const byKey = new Map(rows.map((r) => [r.bucket, r]));
  return keys.map((key) => {
    const row = byKey.get(key);
    return row ? map(key, row) : empty(key);
  });
}

// Meme contrat d'erreur que le reste de l'API : 422 validation_failed + details.issues
// (cf. routes/warehouses.ts, routes/zones.ts).
function parseQuery<Out>(schema: z.ZodType<Out>, raw: unknown): Out {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new HttpError(422, 'validation_failed', { issues: parsed.error.issues });
  return parsed.data;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1) GET /api/analytics/orders-per-day
// ─────────────────────────────────────────────────────────────────────────────
type OrdersPerDayRow = {
  bucket: string;
  orders: number;
  paid_orders: number;
  delivered: number;
  cancelled: number;
};

analyticsRouter.get('/orders-per-day', async (req, res, next) => {
  try {
    const q = parseQuery(DateRangeQuerySchema, req.query);
    const range = resolveRange(q);

    // COUNT(*) renvoie un BigInt que res.json() refuse de serialiser — on caste ::int dans le SQL.
    const rows = await prisma.$queryRaw<OrdersPerDayRow[]>`
      SELECT to_char(("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Paris')::date, 'YYYY-MM-DD') AS bucket,
             COUNT(*)::int AS orders,
             COUNT(*) FILTER (WHERE "paymentStatus" = 'paid')::int AS paid_orders,
             COUNT(*) FILTER (WHERE status = 'delivered')::int AS delivered,
             COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled
      FROM "Order"
      WHERE "createdAt" >= ${range.gte}::timestamp AND "createdAt" < ${range.lt}::timestamp
      GROUP BY 1
    `;

    const points = zeroFill(
      dayKeys(range.fromLabel, range.days),
      rows,
      (date) => ({ date, orders: 0, paidOrders: 0, delivered: 0, cancelled: 0 }),
      (date, r) => ({
        date,
        orders: r.orders,
        paidOrders: r.paid_orders,
        delivered: r.delivered,
        cancelled: r.cancelled,
      }),
    );

    const totals = points.reduce(
      (acc, p) => ({
        orders: acc.orders + p.orders,
        paidOrders: acc.paidOrders + p.paidOrders,
        delivered: acc.delivered + p.delivered,
        cancelled: acc.cancelled + p.cancelled,
      }),
      { orders: 0, paidOrders: 0, delivered: 0, cancelled: 0 },
    );

    res.json({ range: rangeBlock(range), points, totals });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2) GET /api/analytics/revenue
// ─────────────────────────────────────────────────────────────────────────────
type RevenueBucketRow = { bucket: string; revenue: number; orders: number };
type RevenueTotalsRow = { total: number; paid_orders: number; orders_missing_total: number };

function periodDefaults(period: 'week' | 'month' | 'year'): { from: string; to: string } {
  const to = parisToday();
  if (period === 'week') return { from: addDays(to, -6), to };
  if (period === 'year') return { from: `${to.slice(0, 4)}-01-01`, to };
  return { from: `${to.slice(0, 7)}-01`, to };
}

analyticsRouter.get('/revenue', async (req, res, next) => {
  try {
    const q = parseQuery(RevenueQuerySchema, req.query);
    const range = resolveRange(q, periodDefaults(q.period));
    const granularity: 'day' | 'month' = range.days <= 62 ? 'day' : 'month';

    // Seul paymentStatus='paid' compte : refunded / awaiting_payment / failed / NULL sont exclus.
    // Order.total est nullable (lignes rider historiques) — COALESCE a 0 et on expose le nombre de
    // lignes concernees plutot que de les faire disparaitre silencieusement.
    const [totalsRow] = await prisma.$queryRaw<RevenueTotalsRow[]>`
      SELECT COALESCE(SUM(COALESCE(total, 0)), 0)::float8 AS total,
             COUNT(*)::int AS paid_orders,
             COUNT(*) FILTER (WHERE total IS NULL)::int AS orders_missing_total
      FROM "Order"
      WHERE "paymentStatus" = 'paid'
        AND "createdAt" >= ${range.gte}::timestamp AND "createdAt" < ${range.lt}::timestamp
    `;

    const rows =
      granularity === 'day'
        ? await prisma.$queryRaw<RevenueBucketRow[]>`
            SELECT to_char(("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Paris')::date, 'YYYY-MM-DD') AS bucket,
                   COALESCE(SUM(COALESCE(total, 0)), 0)::float8 AS revenue,
                   COUNT(*)::int AS orders
            FROM "Order"
            WHERE "paymentStatus" = 'paid'
              AND "createdAt" >= ${range.gte}::timestamp AND "createdAt" < ${range.lt}::timestamp
            GROUP BY 1
          `
        : await prisma.$queryRaw<RevenueBucketRow[]>`
            SELECT to_char(date_trunc('month', ("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Paris')), 'YYYY-MM-DD') AS bucket,
                   COALESCE(SUM(COALESCE(total, 0)), 0)::float8 AS revenue,
                   COUNT(*)::int AS orders
            FROM "Order"
            WHERE "paymentStatus" = 'paid'
              AND "createdAt" >= ${range.gte}::timestamp AND "createdAt" < ${range.lt}::timestamp
            GROUP BY 1
          `;

    const keys =
      granularity === 'day'
        ? dayKeys(range.fromLabel, range.days)
        : monthKeys(range.fromLabel, range.toLabel);

    const buckets = zeroFill(
      keys,
      rows,
      (date) => ({ date, revenue: 0, orders: 0 }),
      (date, r) => ({ date, revenue: round2(r.revenue), orders: r.orders }),
    );

    const total = round2(totalsRow?.total ?? 0);
    const paidOrders = totalsRow?.paid_orders ?? 0;

    res.json({
      range: rangeBlock(range),
      period: q.period,
      granularity,
      currency: 'EUR',
      // Il n'existe aucune colonne paidAt/paymentConfirmedAt sur Order : une commande est classee
      // au jour de sa creation (checkout), pas au jour ou Stripe a confirme le paiement.
      revenueAnchor: 'order.createdAt',
      total,
      paidOrders,
      averageOrderValue: paidOrders > 0 ? round2(total / paidOrders) : 0,
      ordersMissingTotal: totalsRow?.orders_missing_total ?? 0,
      buckets,
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3) GET /api/analytics/top-products
// ─────────────────────────────────────────────────────────────────────────────
type TopProductRow = {
  name: string;
  quantity: number;
  orders: number;
  revenue: number;
  product_id: string | null;
  image_url: string | null;
};

analyticsRouter.get('/top-products', async (req, res, next) => {
  try {
    const q = parseQuery(TopProductsQuerySchema, req.query);
    const range = resolveRange(q);

    // Regroupement par OrderItem.name (le snapshot d'achat) et NON par productId : productId est un
    // FK nullable avec onDelete: SetNull, un produit supprime ferait donc s'effondrer toutes ses
    // lignes dans un unique bucket NULL. On recupere un productId survivant s'il en reste un.
    // ORDER BY par position (2,4,1) pour eviter toute ambiguite entre alias de sortie et colonne.
    const rows = await prisma.$queryRaw<TopProductRow[]>`
      SELECT oi.name AS name,
             SUM(oi.quantity)::int AS quantity,
             COUNT(DISTINCT oi."orderId")::int AS orders,
             COALESCE(SUM(oi."lineTotal"), 0)::float8 AS revenue,
             (array_remove(array_agg(oi."productId" ORDER BY oi."productId"), NULL))[1] AS product_id,
             (array_agg(oi."imageUrl" ORDER BY oi."imageUrl" DESC))[1] AS image_url
      FROM "OrderItem" oi
      JOIN "Order" o ON o.id = oi."orderId"
      WHERE o."paymentStatus" = 'paid'
        AND o."createdAt" >= ${range.gte}::timestamp AND o."createdAt" < ${range.lt}::timestamp
      GROUP BY oi.name
      ORDER BY 2 DESC, 4 DESC, 1 ASC
      LIMIT ${q.limit}
    `;

    res.json({
      range: rangeBlock(range),
      limit: q.limit,
      products: rows.map((r) => ({
        productId: r.product_id,
        name: r.name,
        imageUrl: r.image_url ?? '',
        quantity: r.quantity,
        orders: r.orders,
        revenue: round2(r.revenue),
      })),
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4) GET /api/analytics/delivery-time
// ─────────────────────────────────────────────────────────────────────────────
type DeliveryTimeRow = {
  delivered_in_period: number;
  sample_size: number;
  avg_minutes: number | null;
  median_minutes: number | null;
  p90_minutes: number | null;
  fastest_minutes: number | null;
  slowest_minutes: number | null;
};

analyticsRouter.get('/delivery-time', async (req, res, next) => {
  try {
    const q = parseQuery(DateRangeQuerySchema, req.query);
    const range = resolveRange(q);

    // Il n'existe AUCUNE colonne pickedUpAt sur Order : l'instant de retrait ne peut venir que des
    // OrderEvent. On ne mesure donc PAS deliveredAt - createdAt (l'age de la commande), mais bien
    // MIN(event picked_up) → MIN(event delivered). La fenetre porte sur l'evenement de livraison :
    // le chiffre signifie « livraisons terminees pendant cette periode ».
    const [row] = await prisma.$queryRaw<DeliveryTimeRow[]>`
      WITH m AS (
        SELECT e."orderId" AS order_id,
               MIN(e."createdAt") FILTER (WHERE e.status = 'picked_up') AS picked_up_at,
               MIN(e."createdAt") FILTER (WHERE e.status = 'delivered') AS delivered_at
        FROM "OrderEvent" e
        GROUP BY e."orderId"
      ),
      w AS (
        SELECT picked_up_at, delivered_at,
               EXTRACT(EPOCH FROM (delivered_at - picked_up_at))::float8 / 60.0 AS minutes
        FROM m
        WHERE delivered_at >= ${range.gte}::timestamp AND delivered_at < ${range.lt}::timestamp
      ),
      s AS (
        SELECT minutes FROM w WHERE picked_up_at IS NOT NULL AND delivered_at > picked_up_at
      )
      SELECT (SELECT COUNT(*)::int FROM w) AS delivered_in_period,
             (SELECT COUNT(*)::int FROM s) AS sample_size,
             (SELECT AVG(minutes)::float8 FROM s) AS avg_minutes,
             (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY minutes)::float8 FROM s) AS median_minutes,
             (SELECT percentile_cont(0.9) WITHIN GROUP (ORDER BY minutes)::float8 FROM s) AS p90_minutes,
             (SELECT MIN(minutes)::float8 FROM s) AS fastest_minutes,
             (SELECT MAX(minutes)::float8 FROM s) AS slowest_minutes
    `;

    const deliveredInPeriod = row?.delivered_in_period ?? 0;
    const sampleSize = row?.sample_size ?? 0;
    // null et non 0 quand l'echantillon est vide : « 0 min » serait un mensonge lisible comme une
    // performance parfaite.
    const stat = (v: number | null | undefined, round: (n: number) => number): number | null =>
      sampleSize > 0 && v !== null && v !== undefined ? round(v) : null;

    res.json({
      range: rangeBlock(range),
      unit: 'minutes',
      source: 'OrderEvent(picked_up → delivered)',
      averageMinutes: stat(row?.avg_minutes, round1),
      medianMinutes: stat(row?.median_minutes, Math.round),
      p90Minutes: stat(row?.p90_minutes, Math.round),
      fastestMinutes: stat(row?.fastest_minutes, Math.round),
      slowestMinutes: stat(row?.slowest_minutes, Math.round),
      sampleSize,
      deliveredInPeriod,
      excludedMissingPickupEvent: deliveredInPeriod - sampleSize,
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 5) GET /api/analytics/active-riders
// ─────────────────────────────────────────────────────────────────────────────
analyticsRouter.get('/active-riders', async (req, res, next) => {
  try {
    const q = parseQuery(DateRangeQuerySchema, req.query);
    const range = resolveRange(q);

    // User.riderOnline est un booleen SANS horodatage (schema.prisma) et Mongo riderPositions a un
    // TTL de 24 h : « combien de livreurs etaient en ligne pendant une periode passee » n'est PAS
    // calculable. onlineNow est donc un instantane, volontairement NON filtre par from/to, et
    // onlineNowIsPointInTime force l'UI a l'etiqueter honnetement.
    const [onlineNow, approvedRiders, activeRows] = await Promise.all([
      prisma.user.count({
        where: { role: 'rider', riderApplicationStatus: 'approved', riderOnline: true },
      }),
      prisma.user.count({ where: { role: 'rider', riderApplicationStatus: 'approved' } }),
      prisma.$queryRaw<{ active: number }[]>`
        SELECT COUNT(DISTINCT o."riderId")::int AS active
        FROM "Order" o
        JOIN "OrderEvent" e ON e."orderId" = o.id
        WHERE o."riderId" IS NOT NULL
          AND e."createdAt" >= ${range.gte}::timestamp AND e."createdAt" < ${range.lt}::timestamp
      `,
    ]);

    // On prend large (25) puis on coupe a 5 apres avoir joint les noms : un livreur supprime est
    // ecarte sans laisser un trou dans le classement.
    const grouped = await prisma.order.groupBy({
      by: ['riderId'],
      where: {
        riderId: { not: null },
        deliveredAt: { gte: range.gteDate, lt: range.ltDate },
      },
      _count: { _all: true },
      orderBy: { _count: { riderId: 'desc' } },
      take: 25,
    });

    const riderIds = grouped.map((g) => g.riderId).filter((id): id is string => id !== null);
    const riders = riderIds.length
      ? await prisma.user.findMany({ where: { id: { in: riderIds } }, select: { id: true, name: true } })
      : [];
    const nameById = new Map(riders.map((r) => [r.id, r.name]));

    const topRiders = grouped
      .flatMap((g) => {
        const name = g.riderId ? nameById.get(g.riderId) : undefined;
        if (!g.riderId || name === undefined) return [];
        return [{ riderId: g.riderId, name, deliveries: g._count._all }];
      })
      .sort((a, b) => b.deliveries - a.deliveries || a.name.localeCompare(b.name))
      .slice(0, 5);

    res.json({
      range: rangeBlock(range),
      onlineNow,
      onlineNowIsPointInTime: true,
      activeInPeriod: activeRows[0]?.active ?? 0,
      approvedRiders,
      topRiders,
    });
  } catch (err) {
    next(err);
  }
});
