/**
 * useAdminApi — composable partagé pour les pages admin.
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
  const auth = useAuthStore()
  const config = useRuntimeConfig()

  // ── Auth / CSRF headers ────────────────────────────────────────────────────

  function authHeaders(): Record<string, string> {
    return auth.token ? { Authorization: `Bearer ${auth.token}` } : {}
  }

  function csrfHeaders(): Record<string, string> {
    const csrf = useCookie('ez_csrf').value
    return csrf ? { 'x-csrf-token': csrf } : {}
  }

  // ── Refresh-on-401 wrapper ─────────────────────────────────────────────────
  // Si le JWT stocké en localStorage est expiré, le backend répond 401 invalid_token.
  // On tente un refresh silencieux (ez_refresh cookie) puis on réessaie une fois.

  async function withAuth<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn()
    }
    catch (e: unknown) {
      const err = e as { data?: { error?: string }; statusCode?: number }
      const isAuthErr
        = err?.statusCode === 401
        || err?.data?.error === 'invalid_token'
        || err?.data?.error === 'missing_token'
      if (isAuthErr) {
        const ok = await auth.refresh()
        if (ok) return fn() // retry once with fresh token
      }
      throw e
    }
  }

  // ── adminFetch ─────────────────────────────────────────────────────────────
  // Wrapper pratique : construit l'URL absolue, injecte auth + CSRF, ajoute
  // credentials:'include', et applique withAuth automatiquement.

  async function adminFetch<T>(
    path: string,
    options: Parameters<typeof $fetch>[1] = {},
  ): Promise<T> {
    const { headers: extra, ...rest } = options as {
      headers?: Record<string, string>
      [k: string]: unknown
    }
    return withAuth(() =>
      $fetch<T>(`${config.public.apiUrl}${path}`, {
        credentials: 'include',
        headers: {
          ...authHeaders(),
          ...csrfHeaders(),
          ...(extra ?? {}),
        },
        ...rest,
      }),
    )
  }

  // ── Formatters ─────────────────────────────────────────────────────────────

  function fmtMoney(n: number | string): string {
    return Number(n).toFixed(2)
  }

  return { adminFetch, withAuth, fmtMoney, authHeaders, csrfHeaders }
}
