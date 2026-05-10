import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = process.env['ADMIN_EMAIL'] ?? 'admin@eztech.fr';
  const password = process.env['ADMIN_PASSWORD'] ?? 'change-me';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return; // idempotent — run multiple times safely

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: { email, passwordHash, role: 'admin', name: 'Admin', phone: '' },
  });
  console.log('admin user seeded:', email);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
