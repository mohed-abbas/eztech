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

// Part des frais de livraison reversee au livreur. Le client paie DELIVERY_FEE (4,99 EUR par
// defaut) ; le livreur en touche cette fraction, la plateforme garde le reste (frais de service,
// commission de paiement, support). C'est la SEULE regle de remuneration des courses boutique :
// pour changer ce que gagne un livreur, on ne modifie que cette constante.
// Volontairement forfaitaire : aucune tarification a la distance n'est calculee ici, aucune donnee
// de trajet n'est disponible au moment de la creation de la commande.
export const RIDER_DELIVERY_FEE_SHARE = new Prisma.Decimal('0.70');

// riderFee = deliveryFee x RIDER_DELIVERY_FEE_SHARE, arrondi au centime (la colonne Order.riderFee
// est un Decimal(10,2)). Tout le calcul reste en Decimal : passer par un `number` reintroduirait
// l'erreur de representation binaire que le reste du module money evite deja.
export function computeRiderFee(deliveryFee: Prisma.Decimal): Prisma.Decimal {
  return deliveryFee.mul(RIDER_DELIVERY_FEE_SHARE).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
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
