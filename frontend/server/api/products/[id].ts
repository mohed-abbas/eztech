import categoriesData from '../../../app/data/mock/categories.json'
import mockProducts from '../../../app/data/mock/products.json'

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
  reviewCount?: number
  price: ProductPrice
  stock?: number
  compatibilityTags?: string[]
  warehouseIds?: string[]
}

type ApiProduct = {
  id: string
  slug: string
  name: string
  description: string
  imageUrl: string
  pricingType: 'flat' | 'tiered'
  flatPrice: string | null
  hourlyPrice: string | null
  dailyPrice: string | null
  weeklyPrice: string | null
  rating: string | null
  reviewCount: number
  stock: number
  compatibilityTags: string[]
  category: { slug: string }
}

const slugToMockCategory = new Map(
  (categoriesData as { id: string; slug: string }[]).map((c) => [c.slug, c.id]),
)

// headline price shown above the fold — the "à partir de" figure, NOT the price any tier is charged at
const flatten = (p: ProductPrice) => p.flat ?? p.daily ?? p.hourly ?? p.weekly ?? 0

// Decimal columns arrive as strings; a missing tier stays missing. Kept identical to
// server/api/products.ts so the list and the detail page describe the same product the same way.
// Never fill one tier from another: the server reprices every line from these exact columns
// (backend/src/lib/pricing.ts computeLineTotal), so an invented tier is a price the customer is
// shown but is not charged.
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

function mapMock(p: MockProduct) {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    description: p.description,
    categoryId: p.categoryId,
    image: p.image,
    pricingType: p.price.flat ? 'flat' : 'tiered',
    price: flatten(p.price),
    prices: p.price,
    rating: p.rating,
    reviewCount: p.reviewCount ?? 0,
    stock: p.stock ?? 0,
    compatibilityTags: p.compatibilityTags ?? [],
    warehouseIds: p.warehouseIds ?? [],
  }
}

function notFound() {
  return createError({ statusCode: 404, statusMessage: 'Product not found' })
}

// a valid id is a uuid or a catalog slug — reject anything else so it can never
// be interpolated into the upstream request path (CR-02: SSRF / path injection)
const ID_RE = /^[a-zA-Z0-9_-]+$/

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const config = useRuntimeConfig()

  if (!id || !ID_RE.test(id)) throw notFound()

  if (!config.public.useMock) {
    try {
      const { product: p } = await $fetch<{ product: ApiProduct }>(`${config.apiUrl}/products/${encodeURIComponent(id)}`)
      const prices = tierPrices(p)
      return {
        id: p.id,
        slug: p.slug,
        name: p.name,
        description: p.description,
        categoryId: slugToMockCategory.get(p.category.slug) ?? p.category.slug,
        image: p.imageUrl,
        pricingType: p.pricingType,
        price: flatten(prices),
        prices,
        rating: p.rating != null ? Number(p.rating) : 0,
        reviewCount: p.reviewCount,
        stock: p.stock,
        compatibilityTags: p.compatibilityTags,
        warehouseIds: [] as string[],
      }
    } catch (err) {
      if ((err as { statusCode?: number }).statusCode === 404) throw notFound()
      // In live mode, surface the failure instead of falling through to mock — same rule as
      // server/api/orders.ts. A mock product renders a complete, believable page whose id does not
      // exist in the database, so the only sign of trouble is product_not_found at checkout.
      console.error('[catalog BFF] /products/:id backend fetch failed:', err)
      const e = err as { statusCode?: number, response?: { status?: number } }
      throw createError({
        statusCode: e.statusCode ?? e.response?.status ?? 502,
        statusMessage: 'product_fetch_failed',
      })
    }
  }

  const found = (mockProducts as MockProduct[]).find((p) => p.id === id || p.slug === id)
  if (!found) throw notFound()
  return mapMock(found)
})
