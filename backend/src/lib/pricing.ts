import { Prisma } from '@prisma/client';
import { env } from '../config/env.js';

// the live product columns needed to recompute money server-side (D-06) — read straight
// from the Product row so a tampered client price is never trusted
type PricedProduct = {
  pricingType: 'flat' | 'tiered';
  flatPrice: Prisma.Decimal | null;
  hourlyPrice: Prisma.Decimal | null;
  dailyPrice: Prisma.Decimal | null;
  weeklyPrice: Prisma.Decimal | null;
};

type LineInput = {
  quantity: number;
  durationUnit: 'flat' | 'hourly' | 'daily' | 'weekly';
  durationValue: number;
};

// mirrors the frontend cart computeLinePrice rule exactly: flat → unit = flatPrice, line = unit * qty;
// tiered → unit = price for the chosen durationUnit, line = unit * durationValue * qty. All Decimal.
export function computeLineTotal(product: PricedProduct, item: LineInput): {
  unitPrice: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
} {
  const zero = new Prisma.Decimal(0);
  if (product.pricingType === 'flat') {
    const unitPrice = product.flatPrice ?? zero;
    return { unitPrice, lineTotal: unitPrice.mul(item.quantity) };
  }
  const unitPrice =
    item.durationUnit === 'hourly' ? product.hourlyPrice ?? zero
      : item.durationUnit === 'daily' ? product.dailyPrice ?? zero
        : item.durationUnit === 'weekly' ? product.weeklyPrice ?? zero
          : zero;
  return { unitPrice, lineTotal: unitPrice.mul(item.durationValue).mul(item.quantity) };
}

// subtotal = sum(lineTotals); deliveryFee from env (D-07, single source of truth);
// total = subtotal + deliveryFee. Cents conversion happens only at the Stripe boundary, not here.
export function computeOrderTotals(lineTotals: Prisma.Decimal[]): {
  subtotal: Prisma.Decimal;
  deliveryFee: Prisma.Decimal;
  total: Prisma.Decimal;
} {
  const subtotal = lineTotals.reduce((sum, lt) => sum.add(lt), new Prisma.Decimal(0));
  const deliveryFee = new Prisma.Decimal(env.DELIVERY_FEE);
  return { subtotal, deliveryFee, total: subtotal.add(deliveryFee) };
}
