// Garde de role : la page declare `definePageMeta({ middleware: ['auth','role'], role: '...' })`.
// L'admin passe partout ; sinon le role de l'utilisateur doit correspondre a celui exige.
export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuthStore()
  if (import.meta.client) auth.hydrate()
  const required = to.meta['role'] as string | undefined
  if (required && auth.role !== required && auth.role !== 'admin') {
    return navigateTo('/products')
  }
})
