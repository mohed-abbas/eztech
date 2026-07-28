// Demo data for the showcase flow — run with: npm run seed:demo
// Creates a small roster of customers and riders (mix of approved / pending so the
// admin approval flow is demoable), a handful of pending delivery jobs, a scheduled
// return pickup, a couple of notifications, and a 60-day paid/delivered order history
// so /admin/analytics renders real curves instead of empty cards (see prisma/demo-orders.ts).
//
// Entierement idempotent : chaque section upsert, cible ses propres lignes (EZDEMO-*, RET-DEMO01,
// notifications event 'demo:*') ou est gardee. Un second run ne duplique rien.
import { PrismaClient, Prisma, VehicleType, RiderApplicationStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { seedDemoOrders } from './demo-orders.js';

const prisma = new PrismaClient();

const RIDER_PASSWORD = 'riderpass123';

// Demo customers — password123. The first two match the frontend's documented test accounts.
const CUSTOMERS = [
  { email: 'marie@example.com', name: 'Marie Dubois', phone: '+33 6 11 22 33 44' },
  { email: 'thomas@example.com', name: 'Thomas Bernard', phone: '+33 6 55 66 77 88' },
  { email: 'sophie@example.com', name: 'Sophie Lefèvre', phone: '+33 6 24 68 13 57' },
];
const CUSTOMER_PASSWORD = 'password123';

// Demo riders — riderpass123. Two approved (can take jobs), one pending (shows the
// admin approval flow), one per vehicle type.
const RIDERS = [
  {
    email: 'rider@eztech.fr', name: 'Lucas Martin', phone: '+33 6 12 34 56 78',
    vehicleType: VehicleType.scooter, licenseNumber: 'PARIS-2026-0042', insuranceNumber: 'AXA-77-998877',
    status: RiderApplicationStatus.approved,
  },
  {
    email: 'rider2@eztech.fr', name: 'Emma Petit', phone: '+33 6 98 76 54 32',
    vehicleType: VehicleType.bicycle, licenseNumber: 'PARIS-2026-0088', insuranceNumber: 'MAIF-75-112233',
    status: RiderApplicationStatus.approved,
  },
  {
    email: 'rider3@eztech.fr', name: 'Hugo Moreau', phone: '+33 6 45 67 89 01',
    vehicleType: VehicleType.car, licenseNumber: 'PARIS-2026-0129', insuranceNumber: 'GMF-92-445566',
    status: RiderApplicationStatus.pending,
  },
];

// Demo warehouse manager — warehousepass123. Assigné à un entrepôt pour démontrer la gestion de stock.
const WAREHOUSE_MANAGER = { email: 'warehouse@eztech.fr', name: 'Claire Dubois', phone: '+33 6 33 44 55 66' };
const WAREHOUSE_MANAGER_PASSWORD = 'warehousepass123';

// Reference stable du retour de demo — permet un upsert plutot qu'un create a chaque run.
const DEMO_RETURN_REFERENCE = 'RET-DEMO01';

const SAMPLE_JOBS = [
  {
    pickup: 'Entrepôt EzTech, 12 Rue du Faubourg Saint-Antoine, 75011 Paris',
    pickupLat: 48.8516, pickupLng: 2.3727,
    dropoff: '28 Boulevard Beaumarchais, 75011 Paris', dropoffLat: 48.8553, dropoffLng: 2.3679,
    fee: 6.5,
  },
  {
    pickup: 'Entrepôt EzTech, 12 Rue du Faubourg Saint-Antoine, 75011 Paris',
    pickupLat: 48.8516, pickupLng: 2.3727,
    dropoff: '12 Rue de Rivoli, 75004 Paris', dropoffLat: 48.8556, dropoffLng: 2.3522,
    fee: 5.9,
  },
  {
    pickup: 'Entrepôt EzTech Nord, 3 Rue de la Chapelle, 75018 Paris',
    pickupLat: 48.8861, pickupLng: 2.3615,
    dropoff: '45 Avenue des Champs-Élysées, 75008 Paris', dropoffLat: 48.8698, dropoffLng: 2.3079,
    fee: 8.2,
  },
];

async function main() {
  const customerHash = await bcrypt.hash(CUSTOMER_PASSWORD, 12);
  const customerIds: string[] = [];
  for (const c of CUSTOMERS) {
    const customer = await prisma.user.upsert({
      where: { email: c.email },
      update: { emailVerifiedAt: new Date() },
      // demo customers are pre-verified so the checkout flow works out of the box (Module 1 gate)
      create: { email: c.email, passwordHash: customerHash, name: c.name, phone: c.phone, role: 'customer', emailVerifiedAt: new Date() },
    });
    customerIds.push(customer.id);
  }
  console.log(`demo customers: ${CUSTOMERS.map((c) => c.email).join(', ')} / ${CUSTOMER_PASSWORD}`);

  const riderHash = await bcrypt.hash(RIDER_PASSWORD, 12);
  let primaryRider: { id: string } | null = null;
  const approvedRiderIds: string[] = [];
  for (const r of RIDERS) {
    const approved = r.status === RiderApplicationStatus.approved;
    const rider = await prisma.user.upsert({
      where: { email: r.email },
      // analytics/active-riders.onlineNow lit User.riderOnline : au moins un livreur approuve doit
      // etre en ligne, sinon la carte « livreurs en ligne » affiche 0 sur une base fraiche.
      update: { riderApplicationStatus: r.status, ...(approved ? { riderOnline: true } : {}) },
      create: {
        email: r.email,
        passwordHash: riderHash,
        name: r.name,
        phone: r.phone,
        role: 'rider',
        vehicleType: r.vehicleType,
        licenseNumber: r.licenseNumber,
        insuranceNumber: r.insuranceNumber,
        riderApplicationStatus: r.status,
        riderOnline: approved,
      },
    });
    if (!primaryRider) primaryRider = rider;
    // le livreur « pending » ne porte aucune livraison : il sert a demontrer le flux d'approbation
    if (approved) approvedRiderIds.push(rider.id);
  }
  const rider = primaryRider!;
  console.log(`demo riders: ${RIDERS.map((r) => `${r.email} (${r.status})`).join(', ')} / ${RIDER_PASSWORD}`);

  // Warehouse manager + assignation à un entrepôt existant (seedé par seed-catalog)
  const managerHash = await bcrypt.hash(WAREHOUSE_MANAGER_PASSWORD, 12);
  const manager = await prisma.user.upsert({
    where: { email: WAREHOUSE_MANAGER.email },
    update: {},
    create: {
      email: WAREHOUSE_MANAGER.email,
      passwordHash: managerHash,
      name: WAREHOUSE_MANAGER.name,
      phone: WAREHOUSE_MANAGER.phone,
      role: 'warehouse_manager',
    },
  });
  const warehouse = await prisma.warehouse.findFirst({ orderBy: { name: 'asc' } });
  if (warehouse && warehouse.managerId !== manager.id) {
    await prisma.warehouse.update({ where: { id: warehouse.id }, data: { managerId: manager.id } });
  }
  console.log(`demo warehouse manager: ${WAREHOUSE_MANAGER.email} / ${WAREHOUSE_MANAGER_PASSWORD}${warehouse ? ` (entrepôt: ${warehouse.name})` : ''}`);

  // Le garde ne couvre QUE la boucle SAMPLE_JOBS : avant, un `return` global sautait aussi le
  // retour planifie, les notifications et (desormais) tout l'historique analytique des qu'il
  // restait 3 commandes en attente — c'est-a-dire des le second run.
  const existingPending = await prisma.order.count({ where: { status: 'pending_assignment' } });
  if (existingPending >= SAMPLE_JOBS.length) {
    console.log(`already ${existingPending} pending orders — skipping the ${SAMPLE_JOBS.length} sample delivery jobs`);
  } else {
    for (const job of SAMPLE_JOBS) {
      await prisma.order.create({
        data: {
          reference: `EZ-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
          status: 'pending_assignment',
          pickupAddress: job.pickup,
          pickupLat: job.pickupLat,
          pickupLng: job.pickupLng,
          dropoffAddress: job.dropoff,
          dropoffLat: job.dropoffLat,
          dropoffLng: job.dropoffLng,
          riderFee: new Prisma.Decimal(job.fee),
          events: { create: { status: 'pending_assignment', note: 'order created (demo)' } },
        },
      });
    }
    console.log(`seeded ${SAMPLE_JOBS.length} pending delivery jobs`);
  }

  // Reference fixe + upsert : le retour de demo est cree une fois puis simplement replanifie, au
  // lieu d'empiler une ligne RET-xxxxxx a chaque execution.
  await prisma.return.upsert({
    where: { reference: DEMO_RETURN_REFERENCE },
    update: { scheduledFor: new Date(Date.now() + 3 * 60 * 60 * 1000) },
    create: {
      reference: DEMO_RETURN_REFERENCE,
      status: 'scheduled',
      pickupAddress: '14 Rue Oberkampf, 75011 Paris',
      pickupLat: 48.8645,
      pickupLng: 2.3712,
      scheduledFor: new Date(Date.now() + 3 * 60 * 60 * 1000),
      riderFee: new Prisma.Decimal(4.5),
    },
  });

  // Notification.@@unique([orderId, event, channel]) ne protege pas ces lignes : orderId est NULL et
  // Postgres n'egalise pas deux NULL dans un index unique. On tague donc l'event 'demo:*' et on
  // supprime nos propres lignes avant de les recreer — aucune notification reelle n'est touchee.
  await prisma.notification.deleteMany({ where: { userId: rider.id, event: { startsWith: 'demo:' } } });
  await prisma.notification.createMany({
    data: [
      { userId: rider.id, type: 'return_scheduled', event: 'demo:return_scheduled', title: 'Nouveau retour à récupérer', body: 'Un retour est planifié près de vous.' },
      { userId: rider.id, type: 'new_order', event: 'demo:new_order', title: 'Nouvelle commande disponible', body: 'Une livraison vient d\'être créée à proximité.' },
    ],
  });
  console.log('seeded 1 scheduled return, 2 notifications');

  // Historique analytique (60 jours). Cree/remplace uniquement les commandes EZDEMO-*.
  const analytics = await seedDemoOrders(prisma, { customerIds, riderIds: approvedRiderIds });
  if (analytics) {
    console.log(
      `analytics demo: ${analytics.created} orders (${analytics.paid} paid, ${analytics.delivered} delivered, ` +
        `${analytics.cancelled} cancelled, ${analytics.awaitingPayment} awaiting payment, ${analytics.live} in progress), ` +
        `${analytics.items} items, ${analytics.events} events, revenue ${analytics.revenue} € ` +
        `from ${analytics.from} to ${analytics.to} (replaced ${analytics.deleted} previous EZDEMO- orders)`,
    );
    // Invariant du flux livreur : au moins un compte approuve doit rester sans course active, sinon
    // « Accepter » renvoie 409 already_on_delivery sur les jobs pending_assignment seedes plus haut.
    console.log(`approved riders free to accept a job: ${analytics.ridersAvailable}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
