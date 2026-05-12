// Demo data for the rider flow — run with: npm run seed:demo
// Creates one approved rider (rider@eztech.fr / riderpass123), a handful of
// pending delivery jobs, a scheduled return pickup, and a couple of notifications.
import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

const prisma = new PrismaClient();

const RIDER_EMAIL = 'rider@eztech.fr';
const RIDER_PASSWORD = 'riderpass123';

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
  const passwordHash = await bcrypt.hash(RIDER_PASSWORD, 12);
  const rider = await prisma.user.upsert({
    where: { email: RIDER_EMAIL },
    update: { riderApplicationStatus: 'approved' },
    create: {
      email: RIDER_EMAIL,
      passwordHash,
      name: 'Lucas Martin',
      phone: '+33 6 12 34 56 78',
      role: 'rider',
      vehicleType: 'scooter',
      licenseNumber: 'PARIS-2026-0042',
      insuranceNumber: 'AXA-77-998877',
      riderApplicationStatus: 'approved',
    },
  });
  console.log('demo rider:', RIDER_EMAIL, '/', RIDER_PASSWORD, `(id=${rider.id})`);

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
