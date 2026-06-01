// shared helpers for the catalog routes

// strips undefined entries so Prisma falls back to column defaults (exactOptionalPropertyTypes)
export function clean<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

type PricingFields = {
  flatPrice?: number | null | undefined;
  hourlyPrice?: number | null | undefined;
  dailyPrice?: number | null | undefined;
  weeklyPrice?: number | null | undefined;
};

// the single comparable price persisted to Product.sortPrice — keeps catalog
// price sorting correct across flat and tiered products (CR-01)
export function sortPriceFor(p: PricingFields): number {
  return p.flatPrice ?? p.dailyPrice ?? p.hourlyPrice ?? p.weeklyPrice ?? 0;
}
