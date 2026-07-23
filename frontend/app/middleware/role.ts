// Garde de role : la page declare `definePageMeta({ middleware: ['auth','role'], role: '...' })`.
// L'admin passe partout ; sinon le role de l'utilisateur doit correspondre a celui exige.
//
// SSR guard : le store auth hydrate depuis localStorage (client-only). Cote serveur auth.role
// vaut toujours null, ce qui provoquerait une redirection vers /products pour tout le monde,
// y compris les admins. On laisse passer le SSR et on laisse le client re-evaluer.
export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.server) return

  const auth = useAuthStore()
  auth.hydrate()
  const required = to.meta['role'] as string | undefined
  if (required && auth.role !== required && auth.role !== 'admin') {
    return navigateTo('/products')
  }
})
