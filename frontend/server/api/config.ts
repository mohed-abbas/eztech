// Exposes server-driven storefront config to the client (D-07: the delivery fee is a
// server-side single source of truth, not a hardcoded constant in the cart store).
export default defineEventHandler(() => {
  const config = useRuntimeConfig()
  return {
    deliveryFee: config.deliveryFee,
  }
})
