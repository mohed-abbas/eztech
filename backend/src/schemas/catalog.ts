import { z } from 'zod';

const slug = z.string().min(1).regex(/^[a-z0-9-]+$/, 'invalid_slug');

// GET /api/products — public listing filters + pagination (query params arrive as strings)
export const ProductQuerySchema = z.object({
  category: z.string().optional(), // category slug
  brand: z.string().optional(), // brand slug
  search: z.string().optional(), // matches name/description, case-insensitive
  featured: z.enum(['true', 'false']).optional(),
  sort: z.enum(['price_asc', 'price_desc', 'newest']).default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const pricing = {
  pricingType: z.enum(['flat', 'tiered']),
  // only the fields matching pricingType are expected; others stay null
  flatPrice: z.number().nonnegative().nullable().optional(),
  hourlyPrice: z.number().nonnegative().nullable().optional(),
  dailyPrice: z.number().nonnegative().nullable().optional(),
  weeklyPrice: z.number().nonnegative().nullable().optional(),
};

export const CreateProductSchema = z.object({
  name: z.string().min(1),
  slug,
  description: z.string().optional(),
  categoryId: z.string().uuid(),
  brandId: z.string().uuid().nullable().optional(),
  imageUrl: z.string().optional(),
  ...pricing,
  compatibilityTags: z.array(z.string()).optional(),
  stock: z.number().int().nonnegative().optional(),
  featured: z.boolean().optional(),
  rating: z.number().min(0).max(5).nullable().optional(),
  reviewCount: z.number().int().nonnegative().optional(),
  isActive: z.boolean().optional(),
});

export const PatchProductSchema = CreateProductSchema.partial();

export const CreateCategorySchema = z.object({
  name: z.string().min(1),
  slug,
  description: z.string().optional(),
  icon: z.string().optional(),
});

export const PatchCategorySchema = CreateCategorySchema.partial();

export const CreateBrandSchema = z.object({
  name: z.string().min(1),
  slug,
});
