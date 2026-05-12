import { z } from 'zod';

// PATCH /api/orders/:id/status — rider advances the delivery through its lifecycle
// (murx's Socket.io layer subscribes to these changes and broadcasts to the customer)
export const UpdateOrderStatusSchema = z.object({
  status: z.enum(['at_warehouse', 'picked_up', 'in_transit', 'delivered']),
  note: z.string().max(500).optional(),
});

// POST /api/orders — minimal creation endpoint so riders have something to accept in dev/demo
export const CreateOrderSchema = z.object({
  customerId: z.string().uuid().optional(),
  pickupAddress: z.string().min(1),
  pickupLat: z.number().optional(),
  pickupLng: z.number().optional(),
  dropoffAddress: z.string().min(1),
  dropoffLat: z.number().optional(),
  dropoffLng: z.number().optional(),
  riderFee: z.number().nonnegative().optional(),
});
