import type { NotificationType } from '@prisma/client';
import { prisma } from './prisma.js';

// create a single notification for one user
export async function notify(userId: string, type: NotificationType, title: string, body = '') {
  return prisma.notification.create({ data: { userId, type, title, body } });
}

// fan a notification out to every approved rider that is currently online
export async function notifyOnlineRiders(type: NotificationType, title: string, body = ''): Promise<number> {
  const riders = await prisma.user.findMany({
    where: { role: 'rider', riderOnline: true, riderApplicationStatus: 'approved' },
    select: { id: true },
  });
  if (riders.length === 0) return 0;
  const res = await prisma.notification.createMany({
    data: riders.map((r) => ({ userId: r.id, type, title, body })),
  });
  return res.count;
}
