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

// headline price shown on a card — the "à partir de" figure, NOT the price any tier is charged at
const flatten = (p: ProductPrice) => p.flat ?? p.daily ?? p.hourly ?? p.weekly ?? 0

// Decimal columns arrive as strings; a missing tier stays missing. A tier the product does not
// price must never be filled in from another tier: the server reprices every line from these exact
// columns (backend/src/lib/pricing.ts computeLineTotal), so an invented tier is a price the
// customer is shown but is not charged.
const num = (v: string | null | undefined): number | undefined => {
  if (v == null) return undefined
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

function tierPrices(p: Pick<ApiProduct, 'pricingType' | 'flatPrice' | 'hourlyPrice' | 'dailyPrice' | 'weeklyPrice'>): ProductPrice {
  if (p.pricingType === 'flat') {
    const flat = num(p.flatPrice)
    return flat === undefined ? {} : { flat }
  }
  const out: ProductPrice = {}
  const hourly = num(p.hourlyPrice)
  const daily = num(p.dailyPrice)
  const weekly = num(p.weeklyPrice)
  if (hourly !== undefined) out.hourly = hourly
  if (daily !== undefined) out.daily = daily
  if (weekly !== undefined) out.weekly = weekly
  return out
}

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
      prices: p.price,
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
    return res.products.map((p) => {
      const prices = tierPrices(p)
      return {
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
        price: flatten(prices),
        prices,
        stock: p.stock,
      }
    })
  } catch (err) {
    // In live mode, surface the failure instead of silently serving mock data — same rule as
    // server/api/orders.ts. A catalog of mock products with prod_* ids looks perfectly healthy,
    // but every one of them dies at checkout with product_not_found because those rows do not
    // exist in the database. A visible error beats a convincing lie.
    console.error('[catalog BFF] /products backend fetch failed:', err)
    const e = err as { statusCode?: number, response?: { status?: number } }
    throw createError({
      statusCode: e.statusCode ?? e.response?.status ?? 502,
      statusMessage: 'products_fetch_failed',
    })
  }
})
