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
