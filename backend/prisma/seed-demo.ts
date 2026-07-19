// Demo data for the showcase flow — run with: npm run seed:demo
// Creates a small roster of customers and riders (mix of approved / pending so the
// admin approval flow is demoable), a handful of pending delivery jobs, a scheduled
// return pickup, and a couple of notifications.
import { PrismaClient, Prisma, VehicleType, RiderApplicationStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

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
  for (const c of CUSTOMERS) {
    await prisma.user.upsert({
      where: { email: c.email },
      update: {},
      create: { email: c.email, passwordHash: customerHash, name: c.name, phone: c.phone, role: 'customer' },
    });
  }
  console.log(`demo customers: ${CUSTOMERS.map((c) => c.email).join(', ')} / ${CUSTOMER_PASSWORD}`);

  const riderHash = await bcrypt.hash(RIDER_PASSWORD, 12);
  let primaryRider: { id: string } | null = null;
  for (const r of RIDERS) {
    const rider = await prisma.user.upsert({
      where: { email: r.email },
      update: { riderApplicationStatus: r.status },
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
      },
    });
    if (!primaryRider) primaryRider = rider;
  }
  const rider = primaryRider!;
  console.log(`demo riders: ${RIDERS.map((r) => `${r.email} (${r.status})`).join(', ')} / ${RIDER_PASSWORD}`);

  const existingPending = await prisma.order.count({ where: { status: 'pending_assignment' } });
  if (existingPending >= SAMPLE_JOBS.length) {
    console.log(`already ${existingPending} pending orders — skipping demo data seed`);
    return;
  }

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

  await prisma.return.create({
    data: {
      reference: `RET-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
      status: 'scheduled',
      pickupAddress: '14 Rue Oberkampf, 75011 Paris',
      pickupLat: 48.8645,
      pickupLng: 2.3712,
      scheduledFor: new Date(Date.now() + 3 * 60 * 60 * 1000),
      riderFee: new Prisma.Decimal(4.5),
    },
  });

  await prisma.notification.createMany({
    data: [
      { userId: rider.id, type: 'return_scheduled', title: 'Nouveau retour à récupérer', body: 'Un retour est planifié près de vous.' },
      { userId: rider.id, type: 'new_order', title: 'Nouvelle commande disponible', body: 'Une livraison vient d\'être créée à proximité.' },
    ],
  });

  console.log(`seeded ${SAMPLE_JOBS.length} pending orders, 1 scheduled return, 2 notifications`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
