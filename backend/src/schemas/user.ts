import { z } from 'zod';

export const PatchUserSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  role: z.enum(['customer', 'rider', 'warehouse_manager', 'admin']).optional(),
});
