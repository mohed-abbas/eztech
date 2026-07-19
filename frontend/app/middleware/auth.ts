export default defineNuxtRouteMiddleware((to) => {
  // Runs on server AND client now (Phase 7): the auth plugin has already bootstrapped the session
  // from the httpOnly cookie by the time middleware runs, so SSR and client agree on auth state —
  // no more unauthenticated SSR render of a protected page (which caused hydration mismatches).
  const auth = useAuthStore()
  if (import.meta.client) auth.hydrate()
  if (!auth.isAuthenticated) {
    return navigateTo({
      path: '/login',
      query: { redirect: to.fullPath },
    })
  }
})
