import { z } from 'zod';

// POST /api/returns — a customer/admin schedules a return pickup
export const CreateReturnSchema = z.object({
  orderId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  pickupAddress: z.string().min(1),
  pickupLat: z.number().optional(),
  pickupLng: z.number().optional(),
  scheduledFor: z.coerce.date().optional(),
  riderFee: z.number().nonnegative().optional(),
});

// PATCH /api/returns/:id/process — inspection entrepot d'un retour collecte
export const ProcessReturnSchema = z.object({
  result: z.enum(['available', 'damaged']),
  note: z.string().max(300).optional(),
  warehouseId: z.string().min(1).optional(), // requis pour un admin qui remet en stock
});
