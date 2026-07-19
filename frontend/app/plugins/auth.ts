// Bootstraps the auth session on every render (server + client) so protected pages and their
// middleware know who is logged in during SSR — the token lives in an httpOnly cookie the JS
// never sees, so we load the user from /auth/me using the forwarded cookie (Phase 7).
export default defineNuxtPlugin(async () => {
  const auth = useAuthStore()
  await auth.init()
})
