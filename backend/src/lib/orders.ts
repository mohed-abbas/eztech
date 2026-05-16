import crypto from 'node:crypto';
import type { OrderStatus } from '@prisma/client';

export function generateOrderReference(): string {
  return `EZ-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

export function generateReturnReference(): string {
  return `RET-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

// allowed forward transitions a rider can perform on an order they are assigned to
const RIDER_STATUS_FLOW: Record<string, OrderStatus[]> = {
  rider_assigned: ['at_warehouse'],
  at_warehouse: ['picked_up'],
  picked_up: ['in_transit'],
  in_transit: ['delivered'],
};

export function canRiderTransition(from: OrderStatus, to: OrderStatus): boolean {
  return RIDER_STATUS_FLOW[from]?.includes(to) ?? false;
}
