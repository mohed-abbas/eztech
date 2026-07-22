import { z } from 'zod';

const timeString = z.string().regex(/^\d{2}:\d{2}$/, 'format HH:MM attendu');

export const CreateWarehouseSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  lat: z.number(),
  lng: z.number(),
  serviceRadius: z.number().int().positive().optional(),
  openTime: timeString.optional(),
  closeTime: timeString.optional(),
  isActive: z.boolean().optional(),
  managerId: z.string().min(1).nullable().optional(),
});

export const PatchWarehouseSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().min(1).optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  serviceRadius: z.number().int().positive().optional(),
  openTime: timeString.optional(),
  closeTime: timeString.optional(),
  isActive: z.boolean().optional(),
  managerId: z.string().min(1).nullable().optional(), // null pour desassigner
});

// ajustement de stock : on fixe la nouvelle quantite absolue, le delta est calcule et journalise
export const AdjustStockSchema = z.object({
  quantity: z.number().int().min(0),
  reason: z.string().max(300).optional(),
});
