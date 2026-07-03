import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';

// Owner-scoped bell API (NOTIF-04). Generalizes routes/rider.ts:407-449 to any authenticated
// caller (customer AND rider) — no requireRole. Every query/mutation is scoped by
// userId = req.user!.sub (T-06-09); a caller can never read or mutate another user's rows.
export const notificationsRouter = Router();

const DEFAULT_PAGE_SIZE = 20;

// GET /api/notifications?page=&limit=&unread= — newest first, paginated, plus unreadCount.
notificationsRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const onlyUnread = req.query['unread'] === 'true';
    const page = Math.max(1, Number.parseInt(String(req.query['page'] ?? '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query['limit'] ?? String(DEFAULT_PAGE_SIZE)), 10) || DEFAULT_PAGE_SIZE));

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId, ...(onlyUnread ? { read: false } : {}) },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.notification.count({ where: { userId, read: false } }),
    ]);
    res.json({ notifications, unreadCount, page });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/notifications/:id/read — owner-scoped, mark a single notification read.
notificationsRouter.patch('/:id/read', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const updated = await prisma.notification.updateMany({
      where: { id: String(req.params['id']), userId },
      data: { read: true, readAt: new Date() },
    });
    if (updated.count === 0) return next(new HttpError(404, 'notification_not_found'));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// PATCH /api/notifications/read-all — owner-scoped, mark every unread notification read.
notificationsRouter.patch('/read-all', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const result = await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true, readAt: new Date() },
    });
    res.json({ updated: result.count });
  } catch (err) {
    next(err);
  }
});
