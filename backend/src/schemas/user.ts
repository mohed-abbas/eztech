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

// PATCH /api/users/me — l'utilisateur met a jour son propre profil (jamais son role)
export const UpdateMeSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  phone: z.string().max(40).optional(),
});

// adresses de livraison de l'utilisateur connecte
export const CreateAddressSchema = z.object({
  label: z.string().min(1).max(40),
  street: z.string().min(1).max(200),
  city: z.string().min(1).max(120),
  zipCode: z.string().min(1).max(20),
});

export const PatchAddressSchema = CreateAddressSchema.partial();
