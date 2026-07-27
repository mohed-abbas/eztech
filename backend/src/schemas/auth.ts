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

export const ForgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(200),
});

// POST /api/auth/change-password — authenticated self-service rotation (H5). Distinct from
// reset-password (which consumes an emailed token); this verifies the current password instead.
export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(200),
});

// POST /api/auth/google — the browser sends the Google Identity Services ID token (a JWT) as
// `credential`; the backend verifies it against GOOGLE_CLIENT_ID and upserts the user.
export const GoogleAuthSchema = z.object({
  credential: z.string().min(1),
});

// POST /api/auth/verify-email — the raw single-use token from the confirmation link (Module 1).
export const VerifyEmailSchema = z.object({
  token: z.string().min(1),
});

// POST /api/auth/resend-verification — re-request the confirmation link for an address.
export const ResendVerificationSchema = z.object({
  email: z.string().email(),
});
