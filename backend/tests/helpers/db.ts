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

export { prisma as testPrisma };
