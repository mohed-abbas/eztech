import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { buildApp } from '../src/app.js';
import { truncateRiderTables, testPrisma } from './helpers/db.js';
import * as notificationsLib from '../src/lib/notifications.js';
import { sendEmail } from '../src/lib/resend.js';

// RED scaffold (06-01 Task 3). `dispatch()` lands in Wave 2 (plan 06-02); the owner-scoped bell
// router lands in Wave 2 (plan 06-03). These tests intentionally fail until those plans ship —
// they author the phase's core invariants ahead of the implementation (NOTIF-01/04/06).

const app = buildApp();

type AuthResponse = { user: { id: string }; token: string };

async function registerCustomer(email: string): Promise<{ id: string; token: string }> {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'password123', name: 'Cust', phone: '' });
  const body = res.body as AuthResponse;
  return { id: body.user.id, token: body.token };
}

interface DispatchInput {
  userId: string;
  type: string;
  event: string;
  orderId?: string | null;
  title: string;
  body?: string;
  email?: { subject: string; html: string; text: string };
  socketPush?: boolean;
  essential: boolean;
}
type DispatchFn = (input: DispatchInput) => Promise<unknown>;

// `dispatch` is not exported yet — this cast-through-unknown compiles today (it makes no claim
// about the module's real shape) and simply resolves to `undefined` at runtime until Wave 2 adds
// the export, which is what drives the RED failure below.
function getDispatch(): DispatchFn {
  const mod = notificationsLib as unknown as { dispatch?: DispatchFn };
  if (typeof mod.dispatch !== 'function') {
    throw new Error('dispatch() is not implemented yet (lands in Wave 2, plan 06-02)');
  }
  return mod.dispatch;
}

describe('notification dispatcher (lib/notifications.dispatch)', () => {
  beforeEach(truncateRiderTables);

  it('persists an in-app row for a single-recipient event', async () => {
    const { id: userId } = await registerCustomer('dispatch-1@example.com');
    const dispatch = getDispatch();

    await dispatch({ userId, type: 'order_confirmed', event: 'order_confirmed', orderId: 'order-1', title: 'Confirmed', essential: true });

    const rows = await testPrisma.notification.findMany({ where: { userId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.channel).toBe('in_app');
    expect(rows[0]?.orderId).toBe('order-1');
  });

  it('does not create a duplicate row for a replayed (orderId, event, channel)', async () => {
    const { id: userId } = await registerCustomer('dispatch-2@example.com');
    const dispatch = getDispatch();
    const input: DispatchInput = { userId, type: 'order_confirmed', event: 'order_confirmed', orderId: 'order-2', title: 'Confirmed', essential: true };

    await dispatch(input);
    await dispatch(input); // replay — must be a no-op (P2002 swallowed)

    const rows = await testPrisma.notification.findMany({ where: { userId, orderId: 'order-2' } });
    expect(rows).toHaveLength(1);
  });

  it('fans out to riders with orderId=null so two riders never collide on the unique key', async () => {
    const rider1 = await registerCustomer('dispatch-rider-1@example.com');
    const rider2 = await registerCustomer('dispatch-rider-2@example.com');
    const dispatch = getDispatch();

    await dispatch({ userId: rider1.id, type: 'new_order', event: 'new_order', orderId: null, title: 'New order', essential: true });
    await dispatch({ userId: rider2.id, type: 'new_order', event: 'new_order', orderId: null, title: 'New order', essential: true });

    const rows = await testPrisma.notification.findMany({ where: { event: 'new_order' } });
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.orderId === null)).toBe(true);
  });

  it('suppresses non-essential email when the recipient opted out, but always sends essential email', async () => {
    const { id: userId } = await registerCustomer('dispatch-optout@example.com');
    await testPrisma.user.update({ where: { id: userId }, data: { emailOptOut: true } });
    const dispatch = getDispatch();

    // non-essential: dispatch() must gate this on emailOptOut and suppress the send
    await dispatch({
      userId, type: 'low_stock', event: 'low_stock', orderId: null, title: 'Low stock',
      email: { subject: 'Low stock', html: '<p>low</p>', text: 'low' }, essential: false,
    });
    // essential: opt-out must never suppress this one (N-06)
    await dispatch({
      userId, type: 'order_confirmed', event: 'order_confirmed', orderId: 'order-optout', title: 'Confirmed',
      email: { subject: 'Confirmed', html: '<p>ok</p>', text: 'ok' }, essential: true,
    });

    const rows = await testPrisma.notification.findMany({ where: { userId } });
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });
});

describe('sendEmail() — inert when RESEND_API_KEY is unset', () => {
  it('skips the send and returns {skipped:true} so the suite runs without a Resend key', async () => {
    const result = await sendEmail({ to: 'nobody@example.com', subject: 'x', html: '<p>x</p>', text: 'x' });
    expect(result).toEqual({ skipped: true });
  });
});

describe('bell API — GET/PATCH /api/notifications', () => {
  beforeEach(truncateRiderTables);

  it('returns owner-scoped rows and an unreadCount', async () => {
    const { id: userId, token } = await registerCustomer('bell-1@example.com');
    await testPrisma.notification.create({ data: { userId, type: 'order_confirmed', title: 'Hi', event: 'x', channel: 'in_app' } });

    const res = await request(app).get('/api/notifications').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const body = res.body as { notifications: unknown[]; unreadCount: number };
    expect(body.notifications).toHaveLength(1);
    expect(body.unreadCount).toBe(1);
  });

  it('marks a single notification read via PATCH /:id/read, owner-scoped', async () => {
    const { id: userId, token } = await registerCustomer('bell-2@example.com');
    const n = await testPrisma.notification.create({ data: { userId, type: 'order_confirmed', title: 'Hi', event: 'x', channel: 'in_app' } });

    const res = await request(app).patch(`/api/notifications/${n.id}/read`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(204);
    const updated = await testPrisma.notification.findUnique({ where: { id: n.id } });
    expect(updated?.read).toBe(true);
  });

  it('marks every unread notification read via PATCH /read-all', async () => {
    const { id: userId, token } = await registerCustomer('bell-3@example.com');
    await testPrisma.notification.createMany({
      data: [
        { userId, type: 'order_confirmed', title: 'A', event: 'a', channel: 'in_app' },
        { userId, type: 'order_confirmed', title: 'B', event: 'b', channel: 'in_app' },
      ],
    });

    const res = await request(app).patch('/api/notifications/read-all').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const remaining = await testPrisma.notification.count({ where: { userId, read: false } });
    expect(remaining).toBe(0);
  });
});
