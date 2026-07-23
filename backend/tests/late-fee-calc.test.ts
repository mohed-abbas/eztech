import { describe, it, expect } from 'vitest';
import { computeLateFee, toCents } from '../src/lib/late-fee.js';

const HOUR = 3_600_000;
const DAY = 86_400_000;

// a daily rental: 2 units of a device at 10.00/day, rented for 3 days
const dailyItem = { durationUnit: 'daily', durationValue: 3, unitPrice: '10.00', quantity: 2 };
// an accessory, flat-priced — no rental clock
const flatItem = { durationUnit: 'flat', durationValue: 1, unitPrice: '5.00', quantity: 1 };

describe('computeLateFee', () => {
  const end = new Date('2026-07-20T12:00:00Z');

  it('is zero when not overdue', () => {
    const now = new Date(end.getTime() - HOUR);
    expect(computeLateFee([dailyItem], end, now).toNumber()).toBe(0);
  });

  it('is zero when rentalEndsAt is null (all-flat order, no rental clock)', () => {
    expect(computeLateFee([flatItem], null, new Date()).toNumber()).toBe(0);
  });

  it('bills one full period for any part of a period overdue (rounds up)', () => {
    const now = new Date(end.getTime() + HOUR); // 1h into the first overdue day
    // 1 day × 10.00 × 2 units = 20.00
    expect(computeLateFee([dailyItem], end, now).toNumber()).toBe(20);
  });

  it('bills two periods once two days overdue', () => {
    const now = new Date(end.getTime() + 2 * DAY);
    expect(computeLateFee([dailyItem], end, now).toNumber()).toBe(40);
  });

  it('caps the fee at the original rental length (never more than durationValue periods)', () => {
    const now = new Date(end.getTime() + 100 * DAY); // wildly overdue
    // capped at 3 periods × 10.00 × 2 = 60.00 (== original lineTotal), not 100×
    expect(computeLateFee([dailyItem], end, now).toNumber()).toBe(60);
  });

  it('ignores flat-priced accessories, sums only rental lines', () => {
    const now = new Date(end.getTime() + DAY);
    expect(computeLateFee([dailyItem, flatItem], end, now).toNumber()).toBe(20);
  });

  it('sums mixed rental units', () => {
    const hourly = { durationUnit: 'hourly', durationValue: 5, unitPrice: '2.00', quantity: 1 };
    const now = new Date(end.getTime() + 3 * HOUR);
    // daily: 1×10×2=20 ; hourly: 3×2×1=6 ; total 26
    expect(computeLateFee([dailyItem, hourly], end, now).toNumber()).toBe(26);
  });
});

describe('toCents', () => {
  it('converts euros to integer cents', () => {
    expect(toCents(computeLateFee([dailyItem], new Date('2026-07-20T12:00:00Z'), new Date('2026-07-21T12:00:00Z')))).toBe(2000);
  });
});
