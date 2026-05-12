import { PrismaClient } from '@prisma/client';

const dbUrl = process.env['DATABASE_URL'];
if (!dbUrl) throw new Error('DATABASE_URL must be set before importing test helpers');

const prisma = new PrismaClient({
  datasources: { db: { url: dbUrl } },
});

export async function truncateAuthTables() {
  // preserves admin row created by seed; deletes test users and tokens
  await prisma.$executeRaw`DELETE FROM "RefreshToken"`;
  await prisma.$executeRaw`DELETE FROM "User" WHERE role != 'admin'`;
}

// auth tables + everything the rider/order/return/notification flows touch
export async function truncateRiderTables() {
  await prisma.$executeRaw`DELETE FROM "OrderDecline"`;
  await prisma.$executeRaw`DELETE FROM "OrderEvent"`;
  await prisma.$executeRaw`DELETE FROM "RiderDocument"`;
  await prisma.$executeRaw`DELETE FROM "Notification"`;
  await prisma.$executeRaw`DELETE FROM "Return"`;
  await prisma.$executeRaw`DELETE FROM "Order"`;
  await truncateAuthTables();
}

export { prisma as testPrisma };
