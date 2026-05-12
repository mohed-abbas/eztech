export default defineNuxtRouteMiddleware(() => {
  if (import.meta.server) return
  const auth = useAuthStore()
  auth.hydrate()
  if (auth.isAuthenticated) return navigateTo('/products', { replace: true })
})
