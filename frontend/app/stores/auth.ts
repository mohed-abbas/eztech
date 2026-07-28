import { defineStore } from 'pinia'

export interface Address {
  id: string
  label: string
  street: string
  city: string
  zipCode: string
  // adresse de livraison par defaut (une seule par compte, garantie cote serveur)
  isDefault?: boolean
  coordinates?: { lat: number, lng: number }
}

export interface User {
  id: string
  name: string
  email: string
  phone: string
  role: 'customer' | 'rider' | 'warehouse_manager' | 'admin'
  avatar?: string
  addresses: Address[]
  vehicleType?: 'bicycle' | 'scooter' | 'car'
  licenseNumber?: string
  insuranceNumber?: string
  createdAt: string
  // ISO timestamp once the email is confirmed (Module 1); null/undefined until then
  emailVerifiedAt?: string | null
}

export interface RegisterCustomerPayload {
  name: string
  email: string
  password: string
  phone: string
  address: {
    label: string
    street: string
    city: string
    zipCode: string
  }
}

export interface RegisterRiderPayload {
  name: string
  email: string
  password: string
  phone: string
  vehicleType: 'bicycle' | 'scooter' | 'car'
  licenseNumber: string
  insuranceNumber: string
}

type RegisterPayload = RegisterCustomerPayload | RegisterRiderPayload

const AUTH_STORAGE_KEY = 'ez-auth'

function isRiderPayload(p: RegisterPayload): p is RegisterRiderPayload {
  return 'vehicleType' in p
}

// dedupes concurrent token refreshes (several requests can 401 at once)
let refreshInFlight: Promise<boolean> | null = null

// same idea for the startup session probe: middleware, plugin and a burst of pages must not
// fire N /auth/me + N /auth/refresh round trips for one and the same session.
let validateInFlight: Promise<boolean> | null = null

// double-submit CSRF: echo the readable ez_csrf cookie back in the x-csrf-token header on
// state-changing requests (Phase 7). Client-only — SSR requests carry the cookie header directly.
function csrfHeader(): Record<string, string> {
  const token = useCookie('ez_csrf').value
  return token ? { 'x-csrf-token': token } : {}
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as User | null,
    token: null as string | null,
    refreshToken: null as string | null,
    loading: false,
    hydrated: false,
    // true when a session cookie is present but /auth/me could NOT be resolved for a transient
    // reason (429, 5xx, network). It means "auth state unknown", which is NOT the same as
    // "logged out" — the auth middleware must not bounce the user to /login on it.
    sessionUnresolved: false,
    // true once the backend has confirmed the session during this app load (login, register or a
    // successful /auth/me probe). It travels in the SSR payload, so a session already proven on
    // the server is not probed a second time on hydration.
    sessionValidated: false,
    // true once the backend definitively rejected the session and nothing is left to refresh.
    // It travels in the SSR payload too, so client-side hydrate() drops the stale localStorage
    // blob instead of putting the user's name back in the app bar.
    sessionRevoked: false,
  }),

  getters: {
    // user presence stays the source of truth — the session can legitimately be carried by the
    // httpOnly ez_access cookie with no in-memory token (SSR / cookie-only, Phase 7), so
    // `!!user && !!token` would log out every cookie-only and server-rendered visitor.
    // A dead session no longer reads as authenticated because validateSession() clears `user`
    // instead: the flag is only as trustworthy as the state behind it.
    isAuthenticated: state => !!state.user,
    role: state => state.user?.role ?? null,
  },

  actions: {
    // Restores the header-path credentials from localStorage. It proves NOTHING about the session
    // being alive: the blob outlives the 15-minute access cookie by days, which is exactly how a
    // dead session kept rendering the user's name. validateSession() is what settles it.
    hydrate() {
      if (!import.meta.client || this.hydrated) return
      this.hydrated = true
      // the server render already established this session is gone — purge, don't resurrect
      if (this.sessionRevoked) {
        localStorage.removeItem(AUTH_STORAGE_KEY)
        return
      }
      const stored = localStorage.getItem(AUTH_STORAGE_KEY)
      if (!stored) return
      try {
        const parsed = JSON.parse(stored)
        const { isMock } = useMock()
        // a mock-mode session is worthless against the real API — drop it on mode-switch.
        // we tag every persisted blob with `mock: true` rather than sniffing the token string.
        if (parsed.mock === true && !isMock.value) {
          localStorage.removeItem(AUTH_STORAGE_KEY)
          return
        }
        if (parsed.user && parsed.token) {
          // never overwrite a user resolved server-side by /auth/me with the persisted copy:
          // the payload one is authoritative and fresher.
          if (!this.user) this.user = parsed.user
          this.token = parsed.token
          this.refreshToken = parsed.refreshToken ?? null
        }
      }
      catch {
        localStorage.removeItem(AUTH_STORAGE_KEY)
      }
    },

    persist() {
      if (!import.meta.client) return
      if (this.user && this.token) {
        const { isMock } = useMock()
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
          user: this.user,
          token: this.token,
          refreshToken: this.refreshToken,
          mock: isMock.value,
        }))
      }
      else {
        localStorage.removeItem(AUTH_STORAGE_KEY)
      }
    },

    // drops local session state without the server round-trip or the redirect that logout() does.
    // Used when the backend has already told us the session is gone (401/403).
    clearSession() {
      this.user = null
      this.token = null
      this.refreshToken = null
      this.sessionValidated = false
      this.sessionUnresolved = false
      this.sessionRevoked = true
      // persist() already removes the blob when there is no user, but leaving no stale identity
      // behind IS the point of this action — remove it explicitly rather than by side effect.
      if (import.meta.client) localStorage.removeItem(AUTH_STORAGE_KEY)
      this.persist()
    },

    // marks the in-memory session as proven live (login / register / social login) so the next
    // init() does not spend an /auth/me probe on a session we just created ourselves.
    markSessionLive() {
      this.sessionValidated = true
      this.sessionUnresolved = false
      this.sessionRevoked = false
    },

    // exchanges the refresh token (cookie or in-memory) for a fresh access token; returns false if it can't
    async refresh(): Promise<boolean> {
      if (refreshInFlight) return refreshInFlight
      refreshInFlight = (async () => {
        const { isMock } = useMock()
        if (isMock.value) return false
        try {
          const config = useRuntimeConfig()
          // body carries the refresh token for the header-path client; the browser also sends the
          // httpOnly ez_refresh cookie (credentials:'include'), so a cookie-only session refreshes too.
          const res = await $fetch<{ token: string, refreshToken: string }>(`${config.public.apiUrl}/auth/refresh`, {
            method: 'POST',
            body: this.refreshToken ? { refreshToken: this.refreshToken } : {},
            credentials: 'include',
            headers: csrfHeader(),
          })
          this.token = res.token
          this.refreshToken = res.refreshToken
          this.persist()
          return true
        }
        catch {
          return false
        }
      })().finally(() => { refreshInFlight = null })
      return refreshInFlight
    },

    // loads the current user from the session cookie (SSR-visible via useRequestFetch). This is how
    // a page render knows who is logged in when the token lives only in an httpOnly cookie (Phase 7).
    async me(): Promise<void> {
      const { isMock } = useMock()
      if (isMock.value) return
      const config = useRuntimeConfig()
      // Server render reaches the backend over the internal docker network (config.apiUrl,
      // e.g. http://backend:3001/api) — NOT the browser-facing public URL — and must forward the
      // incoming request's cookie explicitly. On the client the browser sends it via credentials.
      const headers: Record<string, string> = {}
      let base = config.public.apiUrl as string
      if (import.meta.server) {
        base = (config.apiUrl as string) || base
        const cookie = useRequestHeaders(['cookie']).cookie
        if (cookie) headers.cookie = cookie
      }
      const res = await $fetch<{ user: User }>(`${base}/auth/me`, { credentials: 'include', headers })
      this.user = res.user
    },

    // Single /auth/me round trip, classified. 401/403 is the ONLY definitive "logged out" answer;
    // 429 (shared auth rate limit), 5xx and network failures merely mean "unknown" and get one
    // cheap retry — treating them as a logout is what used to bounce valid sessions to /login.
    // 'revoked' (account deleted / role changed) is dead in a way no refresh can repair.
    async probeSession(): Promise<'alive' | 'dead' | 'revoked' | 'unknown'> {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          await this.me()
          return 'alive'
        }
        catch (err: unknown) {
          const e = err as {
            status?: number
            statusCode?: number
            response?: { status?: number, _data?: { error?: string } }
            data?: { error?: string }
          }
          const status = e?.status ?? e?.statusCode ?? e?.response?.status ?? 0
          const code = e?.data?.error ?? e?.response?._data?.error ?? null
          if (code === 'user_revoked') return 'revoked'
          if (status === 401 || status === 403) return 'dead'
          // transient blip: usually clears within a few hundred ms, and this runs once per app
          // load, not per request.
          if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 300))
        }
      }
      return 'unknown'
    },

    // Resolves the restored session against the backend and settles the three possible answers:
    //   alive     → sessionValidated, the app bar is telling the truth
    //   unknown   → sessionUnresolved, keep the session (transient backend failure)
    //   dead      → clearSession(), the name leaves the app bar and localStorage is purged
    //
    // Exactly ONE refresh attempt per validation: the second probe cannot re-enter that branch,
    // so a failed refresh can never trigger another one. Concurrent callers share a single run.
    async validateSession(): Promise<boolean> {
      if (validateInFlight) return validateInFlight
      // read before the first await: a Nuxt composable needs the request context, which is not
      // guaranteed once a store action has resumed from an await during SSR.
      const renewable = import.meta.server ? !!useCookie('ez_refresh').value : true
      validateInFlight = (async () => {
        let outcome = await this.probeSession()

        // Only the browser can refresh: it holds the httpOnly ez_refresh cookie and is the only
        // side that can receive the rotated Set-Cookie back. A server-side attempt would send no
        // cookie and could not hand the new one to the browser, so we skip it there.
        if (outcome === 'dead' && import.meta.client && await this.refresh()) {
          outcome = await this.probeSession()
        }

        if (outcome === 'alive') {
          this.sessionValidated = true
          this.sessionUnresolved = false
          this.sessionRevoked = false
          return true
        }

        if (outcome === 'unknown') {
          // auth state is unknown, NOT logged out — the middleware reads sessionUnresolved as
          // "do not bounce" and the page's own fetches surface a real error if the API is down.
          this.sessionUnresolved = true
          return false
        }

        // The access cookie lives 15 minutes, the refresh cookie 7 days: on the server a plain
        // 'dead' usually just means "the access token expired". The client will renew it within
        // the same page load, so hand the render through as unresolved instead of destroying a
        // session that is about to come back. 'revoked' gets no such benefit of the doubt.
        if (import.meta.server && outcome === 'dead' && renewable) {
          this.sessionUnresolved = true
          return false
        }

        this.clearSession()
        return false
      })().finally(() => { validateInFlight = null })
      return validateInFlight
    },

    // one-shot session bootstrap, safe on both server and client. Restores the header-path token
    // from localStorage (client), then VALIDATES whatever it ended up with — a restored blob is
    // never trusted on its own, which is what let a dead session keep rendering a user.
    async init(): Promise<void> {
      if (import.meta.client) this.hydrate()

      const { isMock } = useMock()
      if (isMock.value) return

      // a session may exist either because we just restored one, or because the browser still
      // carries the readable CSRF cookie issued alongside the httpOnly session cookies.
      if (!this.user && !useCookie('ez_csrf').value) {
        // genuinely anonymous: make sure no leftover "unknown" flag reaches the middleware
        this.sessionUnresolved = false
        return
      }

      // already proven live during this app load — typically server-side, the flag arrives in the
      // SSR payload — so hydration does not spend a second /auth/me on it.
      if (this.sessionValidated) return

      await this.validateSession()
    },

    async login(email: string, password: string): Promise<User> {
      this.loading = true
      try {
        const { isMock } = useMock()

        if (isMock.value) {
          await new Promise(r => setTimeout(r, 600))

          const mockUsers = (await import('~/data/mock/users.json')).default
          const found = mockUsers.find(
            (u: { email: string, password: string }) => u.email === email && u.password === password,
          )

          if (!found) {
            throw new Error('Email ou mot de passe incorrect.')
          }

          const { password: _, ...userData } = found
          this.user = userData as User
          this.token = `mock-jwt-${found.id}-${Date.now()}`
          this.markSessionLive()
          this.persist()
          return this.user!
        }

        const config = useRuntimeConfig()
        // credentials:'include' so the browser stores the httpOnly session cookies the backend sets
        const response = await $fetch<{ user: User, token: string, refreshToken?: string }>(`${config.public.apiUrl}/auth/login`, {
          method: 'POST',
          body: { email, password },
          credentials: 'include',
        })
        this.user = response.user
        this.token = response.token
        this.refreshToken = response.refreshToken ?? null
        this.markSessionLive()
        this.persist()
        return this.user!
      }
      finally {
        this.loading = false
      }
    },

    // Exchanges a Google Identity Services ID token for our own session (POST /api/auth/google).
    // The backend verifies the token, upserts the user, and sets the same httpOnly cookies as
    // password login — so from here on the session is indistinguishable from a normal login.
    async loginWithGoogle(credential: string): Promise<User> {
      this.loading = true
      try {
        const config = useRuntimeConfig()
        const response = await $fetch<{ user: User, token: string, refreshToken?: string }>(`${config.public.apiUrl}/auth/google`, {
          method: 'POST',
          body: { credential },
          credentials: 'include',
        })
        this.user = response.user
        this.token = response.token
        this.refreshToken = response.refreshToken ?? null
        this.markSessionLive()
        this.persist()
        return this.user!
      }
      finally {
        this.loading = false
      }
    },

    async register(payload: RegisterPayload): Promise<User> {
      this.loading = true
      try {
        const { isMock } = useMock()

        if (isMock.value) {
          await new Promise(r => setTimeout(r, 800))

          const mockUsers = (await import('~/data/mock/users.json')).default
          const exists = mockUsers.some((u: { email: string }) => u.email === payload.email)
          if (exists) {
            throw new Error('Un compte avec cet email existe déjà.')
          }

          const newUser: User = {
            id: `user_${Date.now()}`,
            name: payload.name,
            email: payload.email,
            phone: payload.phone,
            role: isRiderPayload(payload) ? 'rider' : 'customer',
            addresses: isRiderPayload(payload)
              ? []
              : [{
                  id: `addr_${Date.now()}`,
                  label: (payload as RegisterCustomerPayload).address.label,
                  street: (payload as RegisterCustomerPayload).address.street,
                  city: (payload as RegisterCustomerPayload).address.city,
                  zipCode: (payload as RegisterCustomerPayload).address.zipCode,
                }],
            vehicleType: isRiderPayload(payload) ? payload.vehicleType : undefined,
            licenseNumber: isRiderPayload(payload) ? payload.licenseNumber : undefined,
            insuranceNumber: isRiderPayload(payload) ? payload.insuranceNumber : undefined,
            createdAt: new Date().toISOString(),
          }

          this.user = newUser
          this.token = `mock-jwt-${newUser.id}-${Date.now()}`
          this.markSessionLive()
          this.persist()
          return newUser
        }

        const config = useRuntimeConfig()
        const response = await $fetch<{ user: User, token: string, refreshToken?: string }>(`${config.public.apiUrl}/auth/register`, {
          method: 'POST',
          body: payload,
          credentials: 'include',
        })
        this.user = response.user
        this.token = response.token
        this.refreshToken = response.refreshToken ?? null
        this.markSessionLive()
        this.persist()
        return this.user!
      }
      finally {
        this.loading = false
      }
    },

    async forgotPassword(email: string): Promise<void> {
      this.loading = true
      try {
        const { isMock } = useMock()

        if (isMock.value) {
          await new Promise(r => setTimeout(r, 800))
          return
        }

        const config = useRuntimeConfig()
        await $fetch(`${config.public.apiUrl}/auth/forgot-password`, {
          method: 'POST',
          body: { email },
        })
      }
      finally {
        this.loading = false
      }
    },

    async resetPassword(token: string, password: string): Promise<void> {
      this.loading = true
      try {
        const { isMock } = useMock()

        if (isMock.value) {
          await new Promise(r => setTimeout(r, 800))
          return
        }

        const config = useRuntimeConfig()
        try {
          await $fetch(`${config.public.apiUrl}/auth/reset-password`, {
            method: 'POST',
            body: { token, password },
          })
        }
        catch (err) {
          const code = (err as { data?: { error?: string }, response?: { _data?: { error?: string } } })?.data?.error
            ?? (err as { response?: { _data?: { error?: string } } })?.response?._data?.error
          if (code === 'invalid_or_expired_token') {
            throw new Error('Ce lien de réinitialisation est invalide ou a expiré.')
          }
          throw err
        }
      }
      finally {
        this.loading = false
      }
    },

    // Confirms the account email from the link token (Module 1). Throws a friendly message on an
    // invalid/expired token so the page can show a resend affordance.
    async verifyEmail(token: string): Promise<void> {
      this.loading = true
      try {
        const { isMock } = useMock()
        if (isMock.value) {
          await new Promise(r => setTimeout(r, 600))
          return
        }

        const config = useRuntimeConfig()
        try {
          await $fetch(`${config.public.apiUrl}/auth/verify-email`, {
            method: 'POST',
            body: { token },
          })
        }
        catch (err) {
          const code = (err as { data?: { error?: string }, response?: { _data?: { error?: string } } })?.data?.error
            ?? (err as { response?: { _data?: { error?: string } } })?.response?._data?.error
          if (code === 'invalid_or_expired_token') {
            throw new Error('Ce lien de confirmation est invalide ou a expiré.')
          }
          throw err
        }

        // reflect verification locally without a round-trip so the order gate lifts immediately
        if (this.user) this.user.emailVerifiedAt = new Date().toISOString()
      }
      finally {
        this.loading = false
      }
    },

    // Re-requests the confirmation link. Always resolves (the backend is enumeration-safe).
    async resendVerification(email: string): Promise<void> {
      this.loading = true
      try {
        const { isMock } = useMock()
        if (isMock.value) {
          await new Promise(r => setTimeout(r, 600))
          return
        }

        const config = useRuntimeConfig()
        await $fetch(`${config.public.apiUrl}/auth/resend-verification`, {
          method: 'POST',
          body: { email },
        })
      }
      finally {
        this.loading = false
      }
    },

    // ── Profil self-service (persiste cote serveur, plus de localStorage seul) ──
    _authHeaders(): Record<string, string> {
      return { ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}), ...csrfHeader() }
    },

    // PATCH /api/users/me accepte aussi les champs vehicule (voir backend/src/schemas/user.ts
    // PatchMeSchema) — la route est owner-scoped sur req.user.sub, donc valable pour tous les roles.
    async updateProfile(payload: {
      name?: string
      phone?: string
      vehicleType?: 'bicycle' | 'scooter' | 'car'
      licenseNumber?: string
      insuranceNumber?: string
    }): Promise<void> {
      const config = useRuntimeConfig()
      const res = await $fetch<{ user: User }>(`${config.public.apiUrl}/users/me`, {
        method: 'PATCH',
        body: payload,
        credentials: 'include',
        headers: this._authHeaders(),
      })
      this.user = res.user
      this.persist()
    },

    async addAddress(payload: { label: string, street: string, city: string, zipCode: string }): Promise<void> {
      const config = useRuntimeConfig()
      const res = await $fetch<{ address: Address }>(`${config.public.apiUrl}/users/me/addresses`, {
        method: 'POST',
        body: payload,
        credentials: 'include',
        headers: this._authHeaders(),
      })
      if (this.user) this.user.addresses = [...(this.user.addresses ?? []), res.address]
      this.persist()
    },

    async updateAddress(id: string, payload: { label?: string, street?: string, city?: string, zipCode?: string }): Promise<void> {
      const config = useRuntimeConfig()
      const res = await $fetch<{ address: Address }>(`${config.public.apiUrl}/users/me/addresses/${id}`, {
        method: 'PATCH',
        body: payload,
        credentials: 'include',
        headers: this._authHeaders(),
      })
      if (this.user) {
        this.user.addresses = (this.user.addresses ?? []).map(a => (a.id === id ? res.address : a))
      }
      this.persist()
    },

    async deleteAddress(id: string): Promise<void> {
      const config = useRuntimeConfig()
      await $fetch(`${config.public.apiUrl}/users/me/addresses/${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: this._authHeaders(),
      })
      if (this.user) this.user.addresses = (this.user.addresses ?? []).filter(a => a.id !== id)
      this.persist()
      // supprimer l'adresse par defaut promeut la plus ancienne restante cote serveur (204, pas de
      // corps) : on relit la liste pour recuperer le nouveau flag. Best-effort, l'UI est deja a jour.
      await this.refreshAddresses().catch(() => {})
    },

    // Marque une adresse comme adresse par defaut. Le backend bascule les autres a false dans la
    // meme transaction et renvoie la liste complete — on la reassigne telle quelle plutot que de
    // recalculer le flag cote client (source de verite = serveur).
    async setDefaultAddress(id: string): Promise<void> {
      const config = useRuntimeConfig()
      const res = await $fetch<{ addresses: Address[] }>(`${config.public.apiUrl}/users/me/addresses/${id}/default`, {
        method: 'PATCH',
        credentials: 'include',
        headers: this._authHeaders(),
      })
      if (this.user) this.user.addresses = res.addresses
      this.persist()
    },

    // Recharge les adresses depuis l'API. Necessaire parce que hydrate() restaure le blob
    // localStorage et que init() n'appelle /auth/me que si aucun user n'est charge : sans ca la
    // liste d'adresses peut rester perimee apres un ajout fait dans un autre onglet.
    async refreshAddresses(): Promise<void> {
      const config = useRuntimeConfig()
      const res = await $fetch<{ addresses: Address[] }>(`${config.public.apiUrl}/users/me/addresses`, {
        credentials: 'include',
        headers: this._authHeaders(),
      })
      if (this.user) this.user.addresses = res.addresses
      this.persist()
    },

    async changePassword(currentPassword: string, newPassword: string): Promise<void> {
      const config = useRuntimeConfig()
      await $fetch(`${config.public.apiUrl}/auth/change-password`, {
        method: 'POST',
        body: { currentPassword, newPassword },
        credentials: 'include',
        headers: this._authHeaders(),
      })
    },

    logout() {
      const { isMock } = useMock()
      // best-effort server-side revoke + cookie clear (don't block the UI on it). Works for a
      // cookie-only session too — the backend reads the ez_refresh cookie when the body is empty.
      if (!isMock.value) {
        const config = useRuntimeConfig()
        void $fetch(`${config.public.apiUrl}/auth/logout`, {
          method: 'POST',
          body: this.refreshToken ? { refreshToken: this.refreshToken } : {},
          credentials: 'include',
          headers: csrfHeader(),
        }).catch(() => {})
      }
      // same teardown as an expired session (state + localStorage), plus the redirect
      this.clearSession()
      navigateTo('/login')
    },
  },
})
