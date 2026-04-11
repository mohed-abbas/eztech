import products from '../../../app/data/mock/products.json'

type ProductPrice = {
  flat?: number
  hourly?: number
  daily?: number
  weekly?: number
}

type Product = {
  id: string
  slug?: string
  name: string
  description: string
  categoryId: string
  image: string
  featured: boolean
  rating: number
  price: ProductPrice
}

export default defineEventHandler((event) => {
  const id = getRouterParam(event, 'id')

  const found = (products as Product[]).find(
    (product) => product.id === id || product.slug === id,
  )

  if (!found) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Product not found',
    })
  }

  return {
    ...found,
    price:
      found.price.flat
      ?? found.price.daily
      ?? found.price.hourly
      ?? found.price.weekly
      ?? 0,
  }
})
