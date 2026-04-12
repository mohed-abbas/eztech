import products from '../../app/data/mock/products.json'

type ProductPrice = {
  flat?: number
  hourly?: number
  daily?: number
  weekly?: number
}

type Product = {
  id: string
  name: string
  description: string
  categoryId: string
  image: string
  featured: boolean
  rating: number
  price: ProductPrice
}

export default defineEventHandler(() => {
  const highTechCategoryIds = new Set([
    'cat_chargers',
    'cat_cables',
    'cat_laptops',
    'cat_monitors',
    'cat_peripherals',
    'cat_adapters',
  ])

  return (products as (Product & { stock?: number })[])
    .filter((product) => highTechCategoryIds.has(product.categoryId))
    .map((product) => ({
      ...product,
      price:
        product.price.flat
        ?? product.price.daily
        ?? product.price.hourly
        ?? product.price.weekly
        ?? 0,
      stock: product.stock ?? 0,
    }))
})