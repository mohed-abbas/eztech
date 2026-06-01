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
  category: { slug: string }
}

const HIGH_TECH = new Set([
  'cat_chargers',
  'cat_cables',
  'cat_laptops',
  'cat_monitors',
  'cat_peripherals',
  'cat_adapters',
])

// the frontend keys categories by mock id (cat_*); map the API's category slug back onto it
const slugToMockCategory = new Map(
  (categoriesData as { id: string; slug: string }[]).map((c) => [c.slug, c.id]),
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
      image: p.image,
      featured: p.featured,
      rating: p.rating,
      price: flatten(p.price),
      stock: p.stock ?? 0,
    }))
}

export default defineEventHandler(async () => {
  const { public: pub } = useRuntimeConfig()
  if (pub.useMock) return fromMock()

  try {
    const res = await $fetch<{ products: ApiProduct[] }>(`${pub.apiUrl}/products`, {
      query: { pageSize: 100 },
    })
    return res.products.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      description: p.description,
      categoryId: slugToMockCategory.get(p.category.slug) ?? p.category.slug,
      image: p.imageUrl,
      featured: p.featured,
      rating: p.rating != null ? Number(p.rating) : 0,
      pricingType: p.pricingType,
      price: Number(p.flatPrice ?? p.dailyPrice ?? p.hourlyPrice ?? p.weeklyPrice ?? 0),
      stock: p.stock,
    }))
  } catch {
    // backend unreachable — degrade to local data rather than breaking the catalog
    return fromMock()
  }
})
