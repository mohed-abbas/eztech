// Garde de role : la page declare `definePageMeta({ middleware: ['auth','role'], role: '...' })`
// ou `role: ['admin','warehouse_manager']` pour autoriser plusieurs roles. L'admin passe partout ;
// sinon le role de l'utilisateur doit figurer parmi ceux exiges.
//
// Rappel securite : cette garde est de l'UX. Toute route admin/entrepot correspondante doit aussi
// porter requireRole cote backend — le frontend ne protege rien a lui seul.
export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuthStore()
  if (import.meta.client) auth.hydrate()

  const required = to.meta['role'] as string | string[] | undefined
  if (!required) return

  const allowed = Array.isArray(required) ? required : [required]
  // admin est implicitement autorise partout ; sinon le role doit figurer dans la liste
  if (auth.role !== 'admin' && !allowed.includes(auth.role as string)) {
    return navigateTo('/products')
  }
})
