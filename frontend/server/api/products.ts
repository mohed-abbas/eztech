import categoriesData from '../../app/data/mock/categories.json'
import mockProducts from '../../app/data/mock/products.json'

type ProductPrice = { flat?: number; hourly?: number; daily?: number; weekly?: number }

type MockProduct = {
  id: string
  slug?: string
  name: string
  description: string
  categoryId: string
  image: string
  featured: boolean
  rating: number
  price: ProductPrice
  stock?: number
}

// backend catalog API shape (Decimal columns serialize as strings)
type ApiProduct = {
  id: string
  slug: string
  name: string
  description: string
  imageUrl: string
  featured: boolean
  rating: string | null
  pricingType: 'flat' | 'tiered'
  flatPrice: string | null
  hourlyPrice: string | null
  dailyPrice: string | null
  weeklyPrice: string | null
  stock: number
  category: { slug: string; name: string; icon: string | null }
}

const HIGH_TECH = new Set([
  'cat_chargers',
  'cat_cables',
  'cat_laptops',
  'cat_monitors',
  'cat_peripherals',
  'cat_adapters',
])

type MockCategory = { id: string; name: string; slug: string; icon: string }

// LEGACY (declared limitation): products/[id].vue keys a hardcoded label map on the mock cat_* ids,
// so `categoryId` still carries the mock id. New consumers must use `categorySlug` instead — it is
// the real Category.slug from the database and the key the catalog filters and /api/categories share.
const slugToMockCategory = new Map(
  (categoriesData as MockCategory[]).map((c) => [c.slug, c.id]),
)

const mockCategoryById = new Map(
  (categoriesData as MockCategory[]).map((c) => [c.id, c]),
)

const flatten = (p: ProductPrice) => p.flat ?? p.daily ?? p.hourly ?? p.weekly ?? 0

function fromMock() {
  return (mockProducts as MockProduct[])
    .filter((p) => HIGH_TECH.has(p.categoryId))
    .map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      description: p.description,
      categoryId: p.categoryId,
      categorySlug: mockCategoryById.get(p.categoryId)?.slug ?? p.categoryId,
      categoryName: mockCategoryById.get(p.categoryId)?.name ?? 'Tech',
      categoryIcon: mockCategoryById.get(p.categoryId)?.icon ?? 'ph:package',
      image: p.image,
      featured: p.featured,
      rating: p.rating,
      pricingType: p.price.flat ? 'flat' : 'tiered',
      price: flatten(p.price),
      stock: p.stock ?? 0,
    }))
}

export default defineEventHandler(async () => {
  const config = useRuntimeConfig()
  if (config.public.useMock) return fromMock()

  try {
    const res = await $fetch<{ products: ApiProduct[] }>(`${config.apiUrl}/products`, {
      query: { pageSize: 100 },
    })
    return res.products.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      description: p.description,
      categoryId: slugToMockCategory.get(p.category.slug) ?? p.category.slug,
      categorySlug: p.category.slug,
      categoryName: p.category.name,
      categoryIcon: p.category.icon ?? 'ph:package',
      image: p.imageUrl,
      featured: p.featured,
      rating: p.rating != null ? Number(p.rating) : 0,
      pricingType: p.pricingType,
      price: Number(p.flatPrice ?? p.dailyPrice ?? p.hourlyPrice ?? p.weeklyPrice ?? 0),
      stock: p.stock,
    }))
  } catch (err) {
    // backend unreachable — degrade to local data rather than breaking the catalog, but surface the outage
    console.error('[catalog BFF] /products backend fetch failed, serving mock data:', err)
    return fromMock()
  }
})
