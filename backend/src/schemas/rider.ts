import { z } from 'zod';

// PUT /api/rider/profile — riders may edit these fields only
// bounds mirror RegisterSchema so the same DoS/log-bloat guard applies on update
export const UpdateRiderProfileSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    phone: z.string().max(40).optional(),
    vehicleType: z.enum(['bicycle', 'scooter', 'car']).optional(),
    licenseNumber: z.string().min(1).max(40).optional(),
    insuranceNumber: z.string().min(1).max(40).optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: 'at least one field is required',
  });

// PATCH /api/rider/status — online/offline toggle
export const RiderStatusSchema = z.object({
  online: z.boolean(),
});

const MAX_DOC_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_DOC_MIME = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;

// POST /api/rider/documents — file sent as a base64 data string (no multipart dependency)
export const UploadRiderDocumentSchema = z.object({
  type: z.enum(['license', 'insurance']),
  fileName: z.string().min(1).max(255),
  mimeType: z.enum(ALLOWED_DOC_MIME),
  // base64-encoded content (without the data: prefix); size is checked after decode in the route
  contentBase64: z.string().min(1),
});

export { MAX_DOC_BYTES };
