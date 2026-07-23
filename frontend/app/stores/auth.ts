import { defineStore } from 'pinia'

export interface Address {
  id: string
  label: string
  street: string
  city: string
  zipCode: string
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
  }),

  getters: {
    // user presence is the source of truth — the session may be carried by an httpOnly cookie
    // (SSR / cookie-only) with no in-memory token (Phase 7).
    isAuthenticated: state => !!state.user,
    role: state => state.user?.role ?? null,
  },

  actions: {
    hydrate() {
      if (!import.meta.client || this.hydrated) return
      this.hydrated = true
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
          this.user = parsed.user
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

    // one-shot session bootstrap, safe on both server and client. Restores the header-path token from
    // localStorage (client) and, when a session cookie is present but no user is loaded, fetches /me.
    async init(): Promise<void> {
      if (import.meta.client) this.hydrate()
      if (!this.user && useCookie('ez_csrf').value) {
        await this.me().catch(() => {})
      }
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
      this.user = null
      this.token = null
      this.refreshToken = null
      this.persist()
      navigateTo('/login')
    },
  },
})
