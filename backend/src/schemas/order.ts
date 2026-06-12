import { z } from 'zod';

// PATCH /api/orders/:id/status — rider advances the delivery through its lifecycle
// (murx's Socket.io layer subscribes to these changes and broadcasts to the customer)
export const UpdateOrderStatusSchema = z.object({
  status: z.enum(['at_warehouse', 'picked_up', 'in_transit', 'delivered']),
  note: z.string().max(500).optional(),
});

// POST /api/orders — commerce create. The client supplies ONLY what it is allowed to:
// the cart lines (product + quantity + rental duration) and the dropoff. All money is
// recomputed server-side from the live Product (D-06 anti-tamper) — any client-sent
// unitPrice/lineTotal/subtotal/deliveryFee/total fields are simply not in the schema and
// are dropped. Strict-by-default still drops unknown keys; we never read them.
const OrderItemInput = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
  durationUnit: z.enum(['flat', 'hourly', 'daily', 'weekly']),
  durationValue: z.number().int().positive(),
});

export const CreateOrderSchema = z.object({
  // admins may target a specific customer; customers anchor to their own id (enforced in the route)
  customerId: z.string().uuid().optional(),
  items: z.array(OrderItemInput).min(1),
  dropoff: z.object({
    address: z.string().min(1),
    lat: z.number(),
    lng: z.number(),
  }),
});
