import { z } from 'zod';

export const PatchUserSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  role: z.enum(['customer', 'rider', 'warehouse_manager', 'admin']).optional(),
});

// PATCH /api/users/:id/rider-application — admin onboarding review (coordinates with Wilson's admin UI)
export const ReviewRiderApplicationSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']),
});

// PATCH /api/users/me/notifications — owner-scoped global email opt-out toggle (NOTIF-07)
export const NotificationPrefsSchema = z.object({
  emailOptOut: z.boolean(),
});
