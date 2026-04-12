import { z } from 'zod'

const FR_PHONE_REGEX = /^(\+33|0)[67]\d{8}$/

export const emailField = z
  .string({ message: 'Email is required.' })
  .trim()
  .min(1, 'Email is required.')
  .email('Please enter a valid email address.')

export const passwordField = z
  .string({ message: 'Password is required.' })
  .min(8, 'Password must be at least 8 characters.')

export const phoneField = z
  .string({ message: 'Phone number is required.' })
  .trim()
  .min(1, 'Phone number is required.')
  .refine(v => FR_PHONE_REGEX.test(v.replace(/\s/g, '')), {
    message: 'Please enter a valid French mobile number (+33 6/7... or 06/07...).',
  })

export const loginSchema = z.object({
  email: emailField,
  password: passwordField,
})
export type LoginInput = z.infer<typeof loginSchema>

export const forgotPasswordSchema = z.object({
  email: emailField,
})
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>

const registerBase = z.object({
  name: z
    .string({ message: 'Name is required.' })
    .trim()
    .min(2, 'Name must be at least 2 characters.'),
  email: emailField,
  password: passwordField,
  confirmPassword: z.string({ message: 'Please confirm your password.' }),
  phone: phoneField,
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match.',
  path: ['confirmPassword'],
})

export const registerCustomerSchema = z.object({
  name: z
    .string({ message: 'Name is required.' })
    .trim()
    .min(2, 'Name must be at least 2 characters.'),
  email: emailField,
  password: passwordField,
  confirmPassword: z.string({ message: 'Please confirm your password.' }),
  phone: phoneField,
  addressLabel: z.string().trim().min(1, 'Address label is required.'),
  street: z.string().trim().min(1, 'Street is required.'),
  city: z.string().trim().min(1, 'City is required.'),
  zipCode: z.string().trim().min(1, 'Zip code is required.'),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match.',
  path: ['confirmPassword'],
})
export type RegisterCustomerInput = z.infer<typeof registerCustomerSchema>

export const registerRiderSchema = z.object({
  name: z
    .string({ message: 'Name is required.' })
    .trim()
    .min(2, 'Name must be at least 2 characters.'),
  email: emailField,
  password: passwordField,
  confirmPassword: z.string({ message: 'Please confirm your password.' }),
  phone: phoneField,
  vehicleType: z.enum(['bicycle', 'scooter', 'car'], {
    message: 'Vehicle type is required.',
  }),
  licenseNumber: z.string().trim().min(1, 'License number is required.'),
  insuranceNumber: z.string().trim().min(1, 'Insurance number is required.'),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match.',
  path: ['confirmPassword'],
})
export type RegisterRiderInput = z.infer<typeof registerRiderSchema>

// Helper: flatten Zod errors into a Record<field, firstMessage>
export function zodErrorsToRecord<T extends z.ZodType>(
  err: z.ZodError<z.infer<T>>,
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of err.issues) {
    const key = issue.path.join('.') || '_root'
    if (!out[key]) out[key] = issue.message
  }
  return out
}

export { registerBase }

export const profilePersonalSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters.'),
  email: emailField,
  phone: phoneField,
})
export type ProfilePersonalInput = z.infer<typeof profilePersonalSchema>

export const profilePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required.'),
  newPassword: passwordField,
  confirmNewPassword: z.string().min(1, 'Please confirm your new password.'),
}).refine(data => data.newPassword === data.confirmNewPassword, {
  message: 'Passwords do not match.',
  path: ['confirmNewPassword'],
})
export type ProfilePasswordInput = z.infer<typeof profilePasswordSchema>

export const profileAddressSchema = z.object({
  label: z.string().trim().min(1, 'Label is required.'),
  street: z.string().trim().min(1, 'Street is required.'),
  city: z.string().trim().min(1, 'City is required.'),
  zipCode: z.string().trim().min(1, 'Zip code is required.'),
})
export type ProfileAddressInput = z.infer<typeof profileAddressSchema>

export const profileVehicleSchema = z.object({
  vehicleType: z.enum(['bicycle', 'scooter', 'car']),
  licenseNumber: z.string().trim().min(1, 'License number is required.'),
  insuranceNumber: z.string().trim().min(1, 'Insurance number is required.'),
})
export type ProfileVehicleInput = z.infer<typeof profileVehicleSchema>
