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

const flatten = (p: ProductPrice) => p.flat ?? p.daily ?? p.hourly ?? p.weekly ?? 0

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
  const { public: pub } = useRuntimeConfig()

  if (!id || !ID_RE.test(id)) throw notFound()

  if (!pub.useMock) {
    try {
      const { product: p } = await $fetch<{ product: ApiProduct }>(`${pub.apiUrl}/products/${encodeURIComponent(id)}`)
      return {
        id: p.id,
        slug: p.slug,
        name: p.name,
        description: p.description,
        categoryId: slugToMockCategory.get(p.category.slug) ?? p.category.slug,
        image: p.imageUrl,
        pricingType: p.pricingType,
        price: Number(p.flatPrice ?? p.dailyPrice ?? p.hourlyPrice ?? p.weeklyPrice ?? 0),
        rating: p.rating != null ? Number(p.rating) : 0,
        reviewCount: p.reviewCount,
        stock: p.stock,
        compatibilityTags: p.compatibilityTags,
        warehouseIds: [] as string[],
      }
    } catch (err) {
      if ((err as { statusCode?: number }).statusCode === 404) throw notFound()
      // other errors — fall through to mock so the page still renders, but surface the outage
      console.error('[catalog BFF] /products/:id backend fetch failed, serving mock data:', err)
    }
  }

  const found = (mockProducts as MockProduct[]).find((p) => p.id === id || p.slug === id)
  if (!found) throw notFound()
  return mapMock(found)
})
