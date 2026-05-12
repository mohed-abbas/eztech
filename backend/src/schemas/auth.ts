import { z } from 'zod';

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  phone: z.string().default(''),
  // role determined server-side; optional rider fields accepted but not persisted until Wilson's schema PR
  vehicleType: z.enum(['bicycle', 'scooter', 'car']).optional(),
  licenseNumber: z.string().optional(),
  insuranceNumber: z.string().optional(),
  // address accepted, not persisted Phase 2
  address: z.object({
    label: z.string(),
    street: z.string(),
    city: z.string(),
    zipCode: z.string(),
  }).optional(),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const RefreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const LogoutSchema = z.object({
  refreshToken: z.string().min(1),
});
