/**
 * useAuthedFetch — le SEUL chemin "401 → refresh → retry → clearSession" de l'application.
 *
 * Pourquoi ici : chaque store authentifié avait sa propre copie du retry (rider, warehouse,
 * useAdminApi), avec des règles légèrement différentes, et les fetchs côté client n'en avaient
 * aucune — une session morte y restait affichée indéfiniment.
 *
 * Garanties :
 *   - au plus UN refresh par requête en échec : le retry n'est volontairement pas ré-enveloppé,
 *     donc un refresh raté ne peut pas en déclencher un autre (pas de boucle) ;
 *   - `auth.refresh()` déduplique déjà les appels concurrents (refreshInFlight), donc une rafale
 *     de requêtes qui tombent en 401 ensemble ne produit qu'un seul aller-retour /auth/refresh ;
 *   - quand le refresh échoue (ou ne peut rien réparer), la session locale est effacée :
 *     le nom disparaît de la barre et le middleware auth reprend la main.
 *
 * Usage :
 *   const { authedFetch } = useAuthedFetch()
 *   const { orders } = await authedFetch<{ orders: Order[] }>('/orders')
 *
 *   // ou, si on garde son propre $fetch :
 *   const { withAuthRetry, authHeaders, csrfHeaders } = useAuthedFetch()
 *   await withAuthRetry(() => $fetch(url, { headers: { ...authHeaders(), ...csrfHeaders() } }))
 */

export interface AuthRetryOptions {
  // renvoie vers /login quand la session est définitivement morte (défaut : true, client uniquement)
  redirectOnExpiry?: boolean
}

interface AuthErrorInfo {
  unauthorized: boolean
  code: string | null
}

// ofetch expose le statut et le corps d'erreur sous plusieurs formes selon l'appelant :
// on lit les trois plutôt que de parier sur une seule.
function readAuthError(e: unknown): AuthErrorInfo {
  const err = e as {
    status?: number
    statusCode?: number
    response?: { status?: number, _data?: { error?: string } }
    data?: { error?: string }
  }
  const status = err?.status ?? err?.statusCode ?? err?.response?.status ?? 0
  const code = err?.data?.error ?? err?.response?._data?.error ?? null
  const unauthorized = status === 401
    || code === 'invalid_token'
    || code === 'missing_token'
    || code === 'user_revoked'
  return { unauthorized, code }
}

export function useAuthedFetch() {
  const auth = useAuthStore()
  const config = useRuntimeConfig()

  function authHeaders(): Record<string, string> {
    // n'attacher un Bearer que si on en a réellement un : côté backend le header prime sur le
    // cookie, donc un "Bearer " vide masquerait la session cookie (Phase 7).
    return auth.token ? { Authorization: `Bearer ${auth.token}` } : {}
  }

  function csrfHeaders(): Record<string, string> {
    const csrf = useCookie('ez_csrf').value
    return csrf ? { 'x-csrf-token': csrf } : {}
  }

  // Session définitivement morte : on efface l'identité locale (localStorage compris) puis on
  // renvoie vers /login. Pas de boucle possible — clearSession() a déjà remis isAuthenticated à
  // false (le middleware guest ne renvoie donc pas ici) et on ne redirige jamais depuis /login.
  function endSession(options: AuthRetryOptions): void {
    auth.clearSession()
    if (!import.meta.client || options.redirectOnExpiry === false) return
    const here = window.location.pathname
    if (here.startsWith('/login')) return
    void navigateTo({ path: '/login', query: { redirect: here + window.location.search } })
  }

  async function withAuthRetry<T>(call: () => Promise<T>, options: AuthRetryOptions = {}): Promise<T> {
    try {
      return await call()
    }
    catch (err) {
      const { unauthorized, code } = readAuthError(err)
      if (!unauthorized) throw err

      // compte supprimé / rôle révoqué : aucun refresh ne peut réparer ça, inutile de le tenter
      if (code === 'user_revoked') {
        endSession(options)
        throw err
      }

      if (!await auth.refresh()) {
        endSession(options)
        throw err
      }

      try {
        // un seul essai, hors withAuthRetry : un 401 ici ne relance PAS de refresh
        return await call()
      }
      catch (retryErr) {
        if (readAuthError(retryErr).unauthorized) endSession(options)
        throw retryErr
      }
    }
  }

  // Wrapper pratique : URL absolue vers l'API, auth + CSRF injectés, credentials inclus, et le
  // retry ci-dessus appliqué automatiquement. Les headers sont calculés à CHAQUE appel, donc le
  // retry repart bien avec le token fraîchement rafraîchi.
  async function authedFetch<T>(
    path: string,
    options: (Parameters<typeof $fetch>[1] & AuthRetryOptions) = {},
  ): Promise<T> {
    const { headers: extra, redirectOnExpiry, ...rest } = options as {
      headers?: Record<string, string>
      redirectOnExpiry?: boolean
      [k: string]: unknown
    }
    // $fetch renvoie TypedInternalResponse<…, T>, que TS ne ramène pas à T pour une URL absolue
    // (non-Nitro) — le cast garde les génériques des appelants honnêtes sans les élargir.
    return withAuthRetry(
      () => $fetch<T>(`${config.public.apiUrl}${path}`, {
        credentials: 'include',
        headers: {
          ...authHeaders(),
          ...csrfHeaders(),
          ...(extra ?? {}),
        },
        ...rest,
      }) as Promise<T>,
      { redirectOnExpiry },
    )
  }

  return { authedFetch, withAuthRetry, authHeaders, csrfHeaders }
}
