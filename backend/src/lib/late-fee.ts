import { Prisma } from '@prisma/client';

// Late-fee calculation for overdue rentals (Module 9). Pure and side-effect free so it can be
// unit-tested without a DB or Stripe. The fee extends the rental at its own per-period rate:
// each overdue period is billed at the item's unitPrice, capped at the original rental length so
// a forgotten item can never accrue more than double its initial cost.

export interface LateFeeItem {
  durationUnit: string; // flat | hourly | daily | weekly
  durationValue: number;
  unitPrice: Prisma.Decimal | string | number;
  quantity: number;
}

// milliseconds per rental period. `flat` items have no rental clock and never incur a late fee.
const UNIT_MS: Record<string, number> = {
  hourly: 3_600_000,
  daily: 86_400_000,
  weekly: 604_800_000,
};

// Number of whole periods `now` is past `rentalEndsAt` for a given unit (always rounds up: any
// part of a period overdue counts as one), capped at `durationValue`.
function overduePeriods(unit: string, durationValue: number, overdueMs: number): number {
  const unitMs = UNIT_MS[unit];
  if (!unitMs || overdueMs <= 0) return 0;
  return Math.min(Math.ceil(overdueMs / unitMs), durationValue);
}

// Total late fee for an order's items given its rental end and the current time. Returns a Decimal
// in euros (0 when not overdue, no rental items, or rentalEndsAt is null).
export function computeLateFee(
  items: LateFeeItem[],
  rentalEndsAt: Date | null,
  now: Date,
): Prisma.Decimal {
  if (!rentalEndsAt) return new Prisma.Decimal(0);
  const overdueMs = now.getTime() - rentalEndsAt.getTime();
  if (overdueMs <= 0) return new Prisma.Decimal(0);

  let fee = new Prisma.Decimal(0);
  for (const item of items) {
    const periods = overduePeriods(item.durationUnit, item.durationValue, overdueMs);
    if (periods === 0) continue;
    // periods × unitPrice × quantity — same rate the rental was originally billed at (D-06 idiom)
    fee = fee.add(new Prisma.Decimal(item.unitPrice).mul(periods).mul(item.quantity));
  }
  return fee.toDecimalPlaces(2);
}

// Convert a euro Decimal to the integer cents Stripe expects (mirrors payments.ts create-intent).
export function toCents(amount: Prisma.Decimal): number {
  return amount.mul(100).toNearest(1).toNumber();
}
