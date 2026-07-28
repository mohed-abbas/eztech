export default defineNuxtRouteMiddleware((to) => {
  // Runs on server AND client now (Phase 7): the auth plugin has already bootstrapped the session
  // from the httpOnly cookie by the time middleware runs, so SSR and client agree on auth state —
  // no more unauthenticated SSR render of a protected page (which caused hydration mismatches).
  const auth = useAuthStore()
  if (import.meta.client) auth.hydrate()
  if (auth.isAuthenticated) return

  // "we could not reach /auth/me" is not "you are logged out". When the bootstrap failed for a
  // transient reason (429 from the shared auth rate limit, 5xx, network), bouncing to /login
  // destroys a valid session — and produced the contradiction of a /login page that greeted the
  // user by name. Let the render continue instead; the client re-hydrates from localStorage and
  // the page's own data fetches surface a real error if the backend is genuinely down.
  if (auth.sessionUnresolved) return

  return navigateTo({
    path: '/login',
    query: { redirect: to.fullPath },
  })
})
