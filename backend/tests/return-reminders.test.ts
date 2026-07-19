import { describe, it, expect, beforeEach } from 'vitest';
import { truncateRiderTables, testPrisma } from './helpers/db.js';

// RED scaffold (06-01 Task 3). `src/jobs/return-reminders.ts` lands in Wave 3 (plan 06-05) and is
// referenced via a non-literal specifier below so `tsc --noEmit` does not attempt static module
// resolution against a file that does not exist yet -- the test still fails at RUNTIME (RED) until
// the job module ships, which is the point of this scaffold (NOTIF-03).
const RETURN_REMINDERS_JOB_PATH = '../src/jobs/return-reminders.js';

type RunOnceFn = () => Promise<unknown>;

async function getRunOnce(): Promise<RunOnceFn> {
  let mod: unknown;
  try {
    mod = await import(RETURN_REMINDERS_JOB_PATH);
  } catch {
    throw new Error('src/jobs/return-reminders.ts does not exist yet (lands in Wave 3, plan 06-05)');
  }
  const fn = (mod as { runReturnRemindersOnce?: RunOnceFn }).runReturnRemindersOnce;
  if (typeof fn !== 'function') {
    throw new Error('runReturnRemindersOnce() is not exported yet (lands in Wave 3, plan 06-05)');
  }
  return fn;
}

async function seedCustomer(email: string): Promise<string> {
  const user = await testPrisma.user.create({
    data: { email, name: 'Reminder Customer', passwordHash: 'not-used-in-this-test', role: 'customer' },
  });
  return user.id;
}

describe('return-reminders cron — claim-and-send double-fire guard (NOTIF-03)', () => {
  beforeEach(truncateRiderTables);

  it('claims a due reminder (sets sentAt) on the first pass and sends nothing on a second pass', async () => {
    const userId = await seedCustomer('reminder-1@example.com');
    const due = await testPrisma.notification.create({
      data: {
        userId,
        type: 'return_reminder',
        title: 'Return your item',
        event: 'return_reminder',
        channel: 'email',
        orderId: 'order-due-1',
        scheduledAt: new Date(Date.now() - 60_000), // due 1 minute ago
        sentAt: null,
      },
    });

    const runOnce = await getRunOnce();

    await runOnce();
    const afterFirst = await testPrisma.notification.findUnique({ where: { id: due.id } });
    expect(afterFirst?.sentAt).not.toBeNull();

    // second pass — the row is already claimed, must not be re-processed (no double-fire)
    await runOnce();
    const afterSecond = await testPrisma.notification.findUnique({ where: { id: due.id } });
    expect(afterSecond?.sentAt?.getTime()).toBe(afterFirst?.sentAt?.getTime());
  });

  it('does not claim a reminder scheduled in the future', async () => {
    const userId = await seedCustomer('reminder-2@example.com');
    const future = await testPrisma.notification.create({
      data: {
        userId,
        type: 'return_reminder',
        title: 'Return your item',
        event: 'return_reminder',
        channel: 'email',
        orderId: 'order-future-1',
        scheduledAt: new Date(Date.now() + 3_600_000), // due in 1 hour
        sentAt: null,
      },
    });

    const runOnce = await getRunOnce();
    await runOnce();

    const after = await testPrisma.notification.findUnique({ where: { id: future.id } });
    expect(after?.sentAt).toBeNull();
  });
});
