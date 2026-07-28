// Generateur du jeu de donnees analytique de demo — appele par prisma/seed-demo.ts.
//
// POURQUOI CE FICHIER EXISTE
// Le dashboard /admin/analytics lit exclusivement des commandes PAYEES et des OrderEvent horodates :
//   - revenue        = SUM(Order.total) WHERE paymentStatus='paid', bucketise sur Order.createdAt
//                      (analytics.ts expose revenueAnchor:'order.createdAt' — il n'existe pas de paidAt)
//   - top-products   = OrderItem groupe par name, sur les commandes payees
//   - delivery-time  = MIN(OrderEvent picked_up) -> MIN(OrderEvent delivered), fenetre sur l'evenement
//                      « delivered » ; renvoie null (pas 0) si l'echantillon est vide
//   - active-riders  = Order.deliveredAt (topRiders) + OrderEvent.createdAt (activeInPeriod)
//                      + User.riderOnline (onlineNow)
//   - orders-per-day = COUNT(*) par jour Paris sur Order.createdAt
// Avant ce generateur, seed-demo.ts ne creait que 3 commandes pending_assignment sans paiement ni
// items : sur une base fraiche, les cinq cartes affichaient 0 € / vide / 0 min.
//
// IDEMPOTENCE
// Chaque commande generee porte une reference prefixee EZDEMO-. Le generateur commence par supprimer
// exactement ces lignes (OrderItem et OrderEvent cascadent, cf. schema.prisma). Aucune ligne qui
// n'a pas ete creee ici n'est touchee : ni les commandes reelles, ni le catalogue, ni les entrepots.
//
// DETERMINISME
// Un PRNG mulberry32 a graine fixe remplace Math.random : deux executions consecutives produisent le
// meme jeu (memes montants, memes dates relatives), donc le second run laisse les memes compteurs.
import { Prisma, type PrismaClient } from '@prisma/client';
import { computeLineTotal, computeOrderTotals } from '../src/lib/pricing.js';

const PARIS = 'Europe/Paris';
const DAY_MS = 86_400_000;
const SPAN_DAYS = 60; // profondeur de l'historique genere
const DENSE_FROM_DAY = 30; // les 30 derniers jours sont la fenetre par defaut des endpoints analytics
const RECENT_WINDOW_DAYS = 7; // au-dela, une commande « en cours » ou impayee ne serait pas credible
const RNG_SEED = 20260728; // graine fixe : deux runs consecutifs produisent le meme jeu

// ─── PRNG deterministe ───────────────────────────────────────────────────────
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Fuseau Paris ────────────────────────────────────────────────────────────
// Meme raisonnement que src/routes/analytics.ts : les colonnes DateTime sont des
// `timestamp without time zone` en heure murale UTC, et l'agregation analytique reprojette sur
// Paris. Pour qu'une commande « passee a 14 h a Paris » tombe bien dans le bon bucket, on convertit
// l'heure murale Paris en instant UTC au lieu de coder +2 h en dur (l'historique de 60 jours peut
// traverser un changement d'heure).
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
  const hour = get('hour') % 24;
  const asIfUtc = Date.UTC(get('year'), get('month') - 1, get('day'), hour, get('minute'), get('second'));
  return Math.round((asIfUtc - at.getTime()) / 60_000);
}

function parisWallToUtc(y: number, m: number, d: number, hour: number, minute: number): Date {
  const naive = Date.UTC(y, m - 1, d, hour, minute);
  let ts = naive - parisOffsetMinutes(new Date(naive)) * 60_000;
  ts = naive - parisOffsetMinutes(new Date(ts)) * 60_000;
  return new Date(ts);
}

// Jour calendaire Paris (YYYY-MM-DD) de l'instant `at`, decale de `deltaDays`.
function parisDayParts(at: Date, deltaDays: number): { y: number; m: number; d: number; weekday: number } {
  const label = new Date(at.getTime() + deltaDays * DAY_MS).toLocaleDateString('en-CA', { timeZone: PARIS });
  const [y, m, d] = label.split('-').map(Number) as [number, number, number];
  return { y, m, d, weekday: new Date(Date.UTC(y, m - 1, d)).getUTCDay() };
}

// ─── Adresses de livraison ───────────────────────────────────────────────────
// Points reels dans Paris intra-muros, tous couverts par les zones seedees par seed-zones.ts, pour
// que la carte admin et le badge de zone du checkout restent coherents avec ces commandes.
const DROPOFFS = [
  { address: '28 Boulevard Beaumarchais, 75011 Paris', lat: 48.8553, lng: 2.3679 },
  { address: '12 Rue de Rivoli, 75004 Paris', lat: 48.8556, lng: 2.3522 },
  { address: '45 Avenue des Champs-Élysées, 75008 Paris', lat: 48.8698, lng: 2.3079 },
  { address: '14 Rue Oberkampf, 75011 Paris', lat: 48.8645, lng: 2.3712 },
  { address: '9 Rue Montorgueil, 75002 Paris', lat: 48.8646, lng: 2.3475 },
  { address: '33 Rue du Faubourg Saint-Denis, 75010 Paris', lat: 48.8712, lng: 2.3544 },
  { address: '7 Rue Mouffetard, 75005 Paris', lat: 48.8433, lng: 2.3496 },
  { address: '21 Rue de Charonne, 75011 Paris', lat: 48.8534, lng: 2.3757 },
  { address: '5 Rue des Abbesses, 75018 Paris', lat: 48.8843, lng: 2.3384 },
  { address: '60 Rue de Vaugirard, 75006 Paris', lat: 48.8462, lng: 2.3286 },
  { address: '18 Avenue Daumesnil, 75012 Paris', lat: 48.8471, lng: 2.3719 },
  { address: '3 Rue de Belleville, 75019 Paris', lat: 48.8721, lng: 2.3766 },
] as const;

type DemoProduct = {
  id: string;
  name: string;
  imageUrl: string;
  pricingType: 'flat' | 'tiered';
  flatPrice: Prisma.Decimal | null;
  hourlyPrice: Prisma.Decimal | null;
  dailyPrice: Prisma.Decimal | null;
  weeklyPrice: Prisma.Decimal | null;
};

type OrderShape = 'delivered' | 'cancelled' | 'awaiting_payment' | 'in_transit' | 'rider_assigned';

export type DemoOrdersSummary = {
  created: number;
  paid: number;
  delivered: number;
  cancelled: number;
  awaitingPayment: number;
  live: number;
  items: number;
  events: number;
  revenue: string;
  from: string;
  to: string;
  deleted: number;
  /** livreurs approuves SANS course active a la fin du seed — doit rester >= 1 */
  ridersAvailable: number;
};

export type SeedDemoOrdersInput = {
  customerIds: string[];
  /** livreurs APPROUVES uniquement — un livreur en attente ne doit porter aucune livraison */
  riderIds: string[];
};

export async function seedDemoOrders(
  prisma: PrismaClient,
  { customerIds, riderIds }: SeedDemoOrdersInput,
): Promise<DemoOrdersSummary | null> {
  const rng = mulberry32(RNG_SEED);
  const int = (min: number, max: number): number => min + Math.floor(rng() * (max - min + 1));
  const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)]!;

  // Purge ciblee : uniquement nos propres lignes. OrderItem/OrderEvent cascadent (schema.prisma).
  const { count: deleted } = await prisma.order.deleteMany({
    where: { reference: { startsWith: 'EZDEMO-' } },
  });

  // Aucun produit / entrepot / categorie n'est cree ici : ils appartiennent a seed-catalog.ts.
  const products = (await prisma.product.findMany({
    where: { isActive: true },
    orderBy: { slug: 'asc' },
    select: {
      id: true, name: true, imageUrl: true, pricingType: true,
      flatPrice: true, hourlyPrice: true, dailyPrice: true, weeklyPrice: true,
    },
  })) as DemoProduct[];
  const warehouses = await prisma.warehouse.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, address: true, lat: true, lng: true },
  });

  // CONTRAINTE INVISIBLE DEPUIS schema.prisma — Prisma ne sait pas declarer un index unique
  // PARTIEL, elle est donc posee en SQL brut par
  // prisma/migrations/20260516120000_rider_hardening_integrity/migration.sql :
  //   "Order_one_active_delivery_per_rider" UNIQUE btree ("riderId")
  //     WHERE status IN ('rider_assigned','at_warehouse','picked_up','in_transit')
  // Un livreur ne peut donc porter qu'UNE seule course active a la fois. Generer plusieurs commandes
  // « en cours » pour le meme livreur leve P2002 (constate : le seed plantait a la 2e).
  // On recense d'abord les livreurs deja occupes par une commande REELLE (les EZDEMO- viennent
  // d'etre supprimees), puis on ne cree au plus qu'une commande active par livreur restant.
  const ACTIVE_STATUSES = ['rider_assigned', 'at_warehouse', 'picked_up', 'in_transit'] as const;
  const busyRiders = new Set(
    (
      await prisma.order.findMany({
        where: { riderId: { in: riderIds }, status: { in: [...ACTIVE_STATUSES] } },
        select: { riderId: true },
      })
    ).flatMap((o) => (o.riderId ? [o.riderId] : [])),
  );
  const freeRiders = riderIds.filter((id) => !busyRiders.has(id));

  if (products.length === 0 || warehouses.length === 0 || customerIds.length === 0) {
    console.log(
      `analytics demo skipped — products:${products.length} warehouses:${warehouses.length} customers:${customerIds.length} (run \`npm run seed:catalog\` first)`,
    );
    return null;
  }

  // Pondération du catalogue : top-products classe par SUM(quantity). Un tirage uniforme rendrait le
  // top 5 aleatoire d'un run a l'autre et illisible en soutenance — on force une queue longue avec
  // une poignee de best-sellers stables (l'ordre depend de la graine, pas de Math.random).
  const shuffled = [...products];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  const weighted: DemoProduct[] = [];
  shuffled.forEach((p, i) => {
    const weight = i < 6 ? 14 : i < 14 ? 5 : 1;
    for (let k = 0; k < weight; k += 1) weighted.push(p);
  });

  const now = new Date();
  const nowMs = now.getTime();

  // ─── Plan journalier ───────────────────────────────────────────────────────
  // Saisonnalite semaine/week-end pour que orders-per-day dessine une courbe et non un plateau,
  // et densite doublee sur les 30 derniers jours (la fenetre par defaut de tous les endpoints).
  type Slot = { start: Date; dayIndex: number };
  const slots: Slot[] = [];
  for (let dayIndex = 0; dayIndex < SPAN_DAYS; dayIndex += 1) {
    const delta = dayIndex - (SPAN_DAYS - 1); // -59 … 0
    const { y, m, d, weekday } = parisDayParts(now, delta);
    const weekend = weekday === 0 || weekday === 6;
    const dense = dayIndex >= SPAN_DAYS - DENSE_FROM_DAY;
    const count = dense ? (weekend ? int(2, 3) : int(3, 6)) : weekend ? int(1, 2) : int(2, 4);
    for (let k = 0; k < count; k += 1) {
      slots.push({ start: parisWallToUtc(y, m, d, int(8, 20), int(0, 59)), dayIndex });
    }
  }
  slots.sort((a, b) => a.start.getTime() - b.start.getTime());

  // ─── Repartition des statuts ───────────────────────────────────────────────
  // Une commande impayee ou « en cours de livraison » vieille de deux mois serait une incoherence
  // visible dans /admin/orders : ces deux etats ne sont tires que sur la fenetre recente.
  const recentCutoff = SPAN_DAYS - RECENT_WINDOW_DAYS;
  function shapeFor(slot: Slot): OrderShape {
    const roll = rng();
    if (slot.dayIndex < recentCutoff) return roll < 0.1 ? 'cancelled' : 'delivered';
    if (roll < 0.07) return 'cancelled';
    if (roll < 0.27) return 'awaiting_payment';
    if (roll < 0.38) return 'in_transit';
    if (roll < 0.45) return 'rider_assigned';
    return 'delivered';
  }

  const summary: DemoOrdersSummary = {
    created: 0, paid: 0, delivered: 0, cancelled: 0, awaitingPayment: 0, live: 0,
    items: 0, events: 0, revenue: '0', from: '', to: '', deleted, ridersAvailable: 0,
  };
  let revenue = new Prisma.Decimal(0);

  let sequence = 0;
  // AU MOINS UN LIVREUR APPROUVE DOIT RESTER LIBRE.
  // L'index unique partiel plafonne a une course active par livreur, et POST /api/rider/orders/:id/accept
  // (src/routes/rider.ts) refuse tout livreur qui en porte deja une : 409 already_on_delivery. Si le
  // generateur consommait TOUS les livreurs approuves, alors sur une base fraiche aucun compte de demo
  // ne pourrait accepter les 3 jobs pending_assignment seedes juste au-dessus — le flux livreur, qui est
  // la demo phare, echouerait des le premier clic sur « Accepter ».
  // On reserve donc le premier livreur approuve (rider@eztech.fr, le compte documente et destinataire des
  // notifications de demo) et on ne confie les courses « en cours » qu'a la queue restante.
  const liveRiders = freeRiders.slice(1); // file des livreurs autorises a porter une course active
  let liveCount = 0;
  for (const slot of slots) {
    let shape = shapeFor(slot);
    // plus aucun livreur libre → la commande est simplement livree plutot que de violer l'index
    let liveRider: string | null = null;
    if (shape === 'in_transit' || shape === 'rider_assigned') {
      liveRider = liveRiders.shift() ?? null;
      // on alterne les deux etats plutot que de suivre le tirage : le nombre de courses actives est
      // plafonne par l'index unique, autant que /admin/orders montre bien deux etapes differentes
      if (liveRider) shape = liveCount++ % 2 === 0 ? 'in_transit' : 'rider_assigned';
      else shape = 'delivered';
    }

    // ── lignes de commande ───────────────────────────────────────────────────
    const lineCount = int(1, 3);
    const chosen: DemoProduct[] = [];
    for (let attempt = 0; attempt < 24 && chosen.length < lineCount; attempt += 1) {
      const candidate = pick(weighted);
      if (!chosen.some((p) => p.id === candidate.id)) chosen.push(candidate);
    }

    const lines = chosen.flatMap((product) => {
      // pricingType='tiered' ne renseigne que les colonnes horaire/journaliere/hebdo reellement
      // definies : on tire l'unite parmi celles qui existent, sinon lineTotal vaudrait 0 et la
      // commande gonflerait ordersMissingTotal / ecraserait le panier moyen.
      const tiers: { unit: 'hourly' | 'daily' | 'weekly'; value: number }[] = [];
      if (product.hourlyPrice) tiers.push({ unit: 'hourly', value: int(2, 8) });
      if (product.dailyPrice) tiers.push({ unit: 'daily', value: int(1, 5) });
      if (product.weeklyPrice) tiers.push({ unit: 'weekly', value: int(1, 3) });

      const line =
        product.pricingType === 'flat' || tiers.length === 0
          ? { durationUnit: 'flat' as const, durationValue: 1 }
          : (() => {
              const t = tiers[Math.floor(rng() * tiers.length)]!;
              return { durationUnit: t.unit, durationValue: t.value };
            })();

      const quantity = int(1, 2);
      const { unitPrice, lineTotal } = computeLineTotal(product, { ...line, quantity });
      if (lineTotal.lte(0)) return []; // produit sans prix exploitable — jamais de ligne a 0 €
      return [{
        productId: product.id,
        name: product.name,
        imageUrl: product.imageUrl,
        quantity,
        durationUnit: line.durationUnit,
        durationValue: line.durationValue,
        unitPrice,
        lineTotal,
      }];
    });
    if (lines.length === 0) continue;

    const { subtotal, deliveryFee, total } = computeOrderTotals(lines.map((l) => l.lineTotal));

    // ── chaine d'evenements ──────────────────────────────────────────────────
    // createdAt EXPLICITE sur chaque OrderEvent : la colonne est @default(now()), donc sans cela
    // tous les evenements tomberaient dans la meme seconde et la carte « temps de livraison moyen »
    // afficherait ~0 min. C'est precisement le bug que ce seed corrige.
    const toAssign = int(3, 10);
    const toWarehouse = int(5, 15);
    const toPickup = int(2, 8);
    const toTransit = int(1, 3);
    const pickupToDelivery = int(18, 55); // l'echantillon vise par delivery-time
    const totalMinutes = toAssign + toWarehouse + toPickup + pickupToDelivery;

    // On ne data-date jamais dans le futur : si la chaine deborde sur « maintenant », on recale le
    // depart (n'arrive que pour les commandes du jour courant).
    let startMs = slot.start.getTime();
    if (startMs + totalMinutes * 60_000 > nowMs - 60_000) {
      startMs = nowMs - 60_000 - totalMinutes * 60_000;
    }
    const at = (minutes: number): Date => new Date(startMs + minutes * 60_000);

    const createdAt = at(0);
    const assignedAt = at(toAssign);
    const warehouseAt = at(toAssign + toWarehouse);
    const pickedUpAt = at(toAssign + toWarehouse + toPickup);
    const transitAt = at(toAssign + toWarehouse + toPickup + toTransit);
    const deliveredAt = at(totalMinutes);

    const events: { status: 'awaiting_payment' | 'pending_assignment' | 'rider_assigned' | 'at_warehouse' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled'; note: string; createdAt: Date }[] = [];
    if (shape !== 'awaiting_payment') {
      // Une commande impayee n'entre PAS dans le pool livreur et ne produit aucun evenement tant
      // que le webhook Stripe n'a pas bascule paymentStatus (cf. routes/orders.ts, note D-04).
      events.push({ status: 'pending_assignment', note: 'paiement confirmé', createdAt });
    }
    if (shape === 'cancelled') {
      events.push({ status: 'cancelled', note: 'annulée par le client', createdAt: at(int(4, 40)) });
    } else if (shape !== 'awaiting_payment') {
      events.push({ status: 'rider_assigned', note: 'livreur assigné', createdAt: assignedAt });
      if (shape !== 'rider_assigned') {
        events.push({ status: 'at_warehouse', note: 'livreur à l’entrepôt', createdAt: warehouseAt });
        events.push({ status: 'picked_up', note: 'colis récupéré', createdAt: pickedUpAt });
        events.push({ status: 'in_transit', note: 'en route vers le client', createdAt: transitAt });
        if (shape === 'delivered') {
          events.push({ status: 'delivered', note: 'colis remis au client', createdAt: deliveredAt });
        }
      }
    }

    const warehouse = warehouses[sequence % warehouses.length]!;
    const dropoff = pick(DROPOFFS);
    const riderId =
      shape === 'awaiting_payment' ? null
        : liveRider ?? riderIds[sequence % Math.max(riderIds.length, 1)] ?? null;

    const paymentStatus =
      shape === 'awaiting_payment' ? 'awaiting_payment' : shape === 'cancelled' ? 'refunded' : 'paid';
    const status =
      shape === 'delivered' ? 'delivered'
        : shape === 'cancelled' ? 'cancelled'
          : shape === 'awaiting_payment' ? 'awaiting_payment'
            : shape;

    sequence += 1;
    await prisma.order.create({
      data: {
        reference: `EZDEMO-${String(sequence).padStart(4, '0')}`,
        status,
        paymentStatus,
        customerId: customerIds[sequence % customerIds.length]!,
        riderId,
        warehouseId: warehouse.id,
        pickupAddress: warehouse.address,
        pickupLat: warehouse.lat,
        pickupLng: warehouse.lng,
        dropoffAddress: dropoff.address,
        dropoffLat: dropoff.lat,
        dropoffLng: dropoff.lng,
        riderFee: new Prisma.Decimal((4.5 + int(0, 40) / 10).toFixed(2)),
        subtotal,
        deliveryFee,
        total,
        createdAt,
        // active-riders.topRiders filtre sur Order.deliveredAt tandis que delivery-time filtre sur
        // l'evenement « delivered » : les deux valeurs sont volontairement identiques, sinon une
        // carte se remplit et l'autre reste vide.
        deliveredAt: shape === 'delivered' ? deliveredAt : null,
        // stripePaymentIntentId reste NULL sur TOUTES les lignes de demo : le handler d'annulation
        // ne peut donc jamais declencher un vrai remboursement Stripe sur ce jeu de donnees.
        items: { create: lines },
        events: { create: events },
      },
      select: { id: true },
    });

    summary.created += 1;
    summary.items += lines.length;
    summary.events += events.length;
    if (paymentStatus === 'paid') {
      summary.paid += 1;
      revenue = revenue.add(total);
    }
    if (shape === 'delivered') summary.delivered += 1;
    else if (shape === 'cancelled') summary.cancelled += 1;
    else if (shape === 'awaiting_payment') summary.awaitingPayment += 1;
    else summary.live += 1;

    if (!summary.from) summary.from = createdAt.toISOString().slice(0, 10);
    summary.to = createdAt.toISOString().slice(0, 10);
  }

  summary.revenue = revenue.toFixed(2);

  // Verification post-seed de l'invariant ci-dessus, mesuree en base et non deduite du code : un
  // livreur approuve au moins doit pouvoir accepter un job. Sans cela une future modification de la
  // repartition des statuts pourrait re-bloquer silencieusement le flux livreur.
  summary.ridersAvailable = await prisma.user.count({
    where: {
      role: 'rider',
      riderApplicationStatus: 'approved',
      assignedOrders: { none: { status: { in: [...ACTIVE_STATUSES] } } },
    },
  });
  if (summary.ridersAvailable === 0) {
    console.warn(
      'ATTENTION : aucun livreur approuve n’est libre — POST /api/rider/orders/:id/accept renverra 409 already_on_delivery pour tous les comptes de demo.',
    );
  }

  return summary;
}
