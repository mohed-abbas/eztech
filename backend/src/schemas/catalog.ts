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
  // admin-only: when 'true' the isActive filter is skipped (enforced server-side via requireRole)
  includeInactive: z.enum(['true', 'false']).optional(),
});

// Le formulaire admin envoie `null` pour un champ texte laisse vide. Les colonnes correspondantes
// (Product.description, Product.imageUrl) sont NOT NULL avec DEFAULT '' : on accepte donc le null en
// entree et on le ramene a '', qui est la representation "pas de valeur" de ce schema. Sans ce
// transform, `z.string().optional()` repondait 422 validation_failed, et un null laisse passer tel
// quel jusqu'a Prisma ferait 500 (clean() ne filtre que `undefined`).
const emptiable = z.string().nullable().optional().transform((v) => (v === null ? '' : v));

const pricing = {
  pricingType: z.enum(['flat', 'tiered']),
  // only the fields matching pricingType are expected; others stay null
  flatPrice: z.number().nonnegative().nullable().optional(),
  hourlyPrice: z.number().nonnegative().nullable().optional(),
  dailyPrice: z.number().nonnegative().nullable().optional(),
  weeklyPrice: z.number().nonnegative().nullable().optional(),
};

const ProductFields = z.object({
  name: z.string().min(1),
  slug,
  description: emptiable,
  // categoryId reste requis a la creation — un produit sans categorie casse les filtres du catalogue
  categoryId: z.string().uuid(),
  brandId: z.string().uuid().nullable().optional(), // colonne reellement nullable, elle
  imageUrl: emptiable,
  ...pricing,
  compatibilityTags: z.array(z.string()).optional(),
  stock: z.number().int().nonnegative().optional(),
  featured: z.boolean().optional(),
  rating: z.number().min(0).max(5).nullable().optional(),
  reviewCount: z.number().int().nonnegative().optional(),
  isActive: z.boolean().optional(),
});

// the price column(s) must match the declared pricingType, else sortPrice/display break (WR-01)
export const CreateProductSchema = ProductFields.superRefine((v, ctx) => {
  if (v.pricingType === 'flat' && v.flatPrice == null) {
    ctx.addIssue({ code: 'custom', path: ['flatPrice'], message: 'flat pricing requires flatPrice' });
  }
  if (v.pricingType === 'tiered' && v.hourlyPrice == null && v.dailyPrice == null && v.weeklyPrice == null) {
    ctx.addIssue({ code: 'custom', path: ['pricingType'], message: 'tiered pricing requires hourly, daily or weekly' });
  }
});

export const PatchProductSchema = ProductFields.partial();

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
