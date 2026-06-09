import { z } from 'zod';

export const RegisterSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(200),
  name: z.string().min(1).max(120),
  phone: z.string().max(40).default(''),
  vehicleType: z.enum(['bicycle', 'scooter', 'car']).optional(),
  licenseNumber: z.string().min(1).max(40).optional(),
  insuranceNumber: z.string().min(1).max(40).optional(),
  address: z
    .object({
      label: z.string().min(1).max(40),
      street: z.string().min(1).max(200),
      city: z.string().min(1).max(120),
      zipCode: z.string().min(1).max(20),
    })
    .optional(),
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
