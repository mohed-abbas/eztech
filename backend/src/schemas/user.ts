import { z } from 'zod';

export const PatchUserSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  role: z.enum(['customer', 'rider', 'warehouse_manager', 'admin']).optional(),
});

// PATCH /api/users/me — owner-scoped self-service profile update (H5, blocks Wilson's profile.vue).
// Deliberately excludes email (unique + would need re-verification) and role (privilege escalation).
export const PatchMeSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  vehicleType: z.enum(['bicycle', 'scooter', 'car']).optional(),
  licenseNumber: z.string().optional(),
  insuranceNumber: z.string().optional(),
});

// PATCH /api/users/:id/rider-application — admin onboarding review (coordinates with Wilson's admin UI)
export const ReviewRiderApplicationSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']),
});

// PATCH /api/users/me/notifications — owner-scoped global email opt-out toggle (NOTIF-07)
export const NotificationPrefsSchema = z.object({
  emailOptOut: z.boolean(),
});
