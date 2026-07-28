/**
 * useAdminApi — composable partagé pour les pages admin.
 *
 * Le retry sur 401 n'est plus implémenté ici : il vit dans useAuthedFetch(), l'unique chemin
 * "401 → refresh → retry une fois → clearSession" de l'application. Ce fichier n'est plus qu'un
 * alias nommé (adminFetch/withAuth) plus le formateur monétaire des pages admin.
 *
 * Expose :
 *   - adminFetch<T>(path, options?) : fetch vers le backend avec auth + CSRF +
 *     credentials inclus, et retry automatique sur 401 / invalid_token.
 *   - withAuth<T>(fn)              : wrapper retry-on-401 (si tu as besoin de
 *     garder un $fetch manuel).
 *   - fmtMoney(n)                  : formate un nombre en "XX.XX".
 *
 * Usage :
 *   const { adminFetch, fmtMoney } = useAdminApi()
 *   const data = await adminFetch<{ product: Product }>('/products/123', { method: 'PATCH', body })
 */
export function useAdminApi() {
  const { authedFetch, withAuthRetry, authHeaders, csrfHeaders } = useAuthedFetch()

  function fmtMoney(n: number | string): string {
    return Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  return {
    adminFetch: authedFetch,
    withAuth: withAuthRetry,
    fmtMoney,
    authHeaders,
    csrfHeaders,
  }
}
