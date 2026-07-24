export default defineNuxtRouteMiddleware((to) => {
  // Client-only guard: in SSR (Docker) the Nuxt server reaches the backend via an internal
  // network name, not localhost. auth.me() silently fails → user stays null → false redirect.
  // The auth plugin already bootstraps the session; on the client, hydrate() reads localStorage.
  // A protected page flashes briefly on first SSR render then immediately redirects client-side
  // if unauthenticated — acceptable for an admin-only SPA.
  if (import.meta.server) return

  const auth = useAuthStore()
  auth.hydrate()
  if (!auth.isAuthenticated) {
    return navigateTo({
      path: '/login',
      query: { redirect: to.fullPath },
    })
  }
})

