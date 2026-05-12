import crypto from 'node:crypto';
import type { OrderStatus } from '@prisma/client';

// how long a rider has to accept an offered order before it expires back to the pool
export const ASSIGNMENT_TTL_MS = 60_000;

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

// true when the order is offered to a rider but the acceptance window has elapsed
export function isAssignmentExpired(assignmentExpiresAt: Date | null): boolean {
  return assignmentExpiresAt !== null && assignmentExpiresAt.getTime() < Date.now();
}
