import { Prisma } from '@prisma/client';
import type { NotificationType } from '@prisma/client';
import { prisma } from './prisma.js';
import { sendEmail } from './resend.js';
import { getIO } from './socket.js';
import { userRoom } from '../socket/rooms.js';
import { USER_NOTIFICATION } from '../socket/events.js';

export type Channel = 'in_app' | 'email';

export interface DispatchInput {
  userId: string;
  type: NotificationType;
  event: string;
  orderId?: string | null;
  title: string;
  body?: string;
  email?: { subject: string; html: string; text: string };
  socketPush?: boolean;
  essential: boolean;
}

// The single multi-channel funnel every trigger calls (Plans 04/05/06). Persists one idempotent
// in-app row, then optionally best-effort socket-pushes and/or emails, gated by opt-out unless
// the send is essential (N-06). RESEARCH §Architecture Patterns Pattern 2.
export async function dispatch(i: DispatchInput): Promise<void> {
  // 1. persist in-app (idempotent). orderId null for fan-out rows so they never collide on the
  // (orderId,event,channel) unique key (Pitfall 2 — Postgres treats NULL as distinct).
  let row;
  try {
    row = await prisma.notification.create({
      data: {
        userId: i.userId,
        type: i.type,
        event: i.event,
        channel: 'in_app',
        orderId: i.orderId ?? null,
        title: i.title,
        body: i.body ?? '',
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return; // already sent
    throw e;
  }

  // 2. best-effort socket push — getIO() throws before the socket layer is initialised (e.g. in
  // HTTP-only tests); swallow so the caller's transaction/response is never coupled to realtime
  // (orders.ts:341 idiom, Pitfall 5).
  if (i.socketPush) {
    try {
      getIO().to(userRoom(i.userId)).emit(USER_NOTIFICATION, row);
    } catch {
      // socket layer not initialised — realtime is best-effort
    }
  }

  // 3. optional email — essential sends (password reset, order lifecycle, return reminder) ignore
  // emailOptOut (N-06/Pitfall 7); non-essential (low-stock/marketing) is suppressed when opted out.
  if (i.email) {
    const user = await prisma.user.findUnique({ where: { id: i.userId }, select: { email: true, emailOptOut: true } });
    if (user) {
      const suppressed = !i.essential && user.emailOptOut;
      if (!suppressed) await sendEmail({ to: user.email, ...i.email });
    }
  }
}

// create a single notification for one user — thin wrapper over dispatch() (legacy call sites in
// orders.ts/rider.ts keep this exact signature; internally routed through the funnel above).
export async function notify(userId: string, type: NotificationType, title: string, body = '') {
  return dispatch({ userId, type, event: type, orderId: null, title, body, essential: true, socketPush: true });
}

// fan a notification out to every approved rider that is currently online — thin wrapper over
// dispatch(); fan-out rows keep orderId=null so multiple riders never collide (Pitfall 2).
export async function notifyOnlineRiders(type: NotificationType, title: string, body = ''): Promise<number> {
  const riders = await prisma.user.findMany({
    where: { role: 'rider', riderOnline: true, riderApplicationStatus: 'approved' },
    select: { id: true },
  });
  if (riders.length === 0) return 0;
  await Promise.all(
    riders.map((r) => dispatch({ userId: r.id, type, event: type, orderId: null, title, body, essential: true, socketPush: true })),
  );
  return riders.length;
}
