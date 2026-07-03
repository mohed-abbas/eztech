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
  role: 'customer' | 'rider' | 'admin'
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

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as User | null,
    token: null as string | null,
    refreshToken: null as string | null,
    loading: false,
    hydrated: false,
  }),

  getters: {
    isAuthenticated: state => !!state.user && !!state.token,
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

    // exchanges the stored refresh token for a fresh access token; returns false if it can't
    async refresh(): Promise<boolean> {
      if (refreshInFlight) return refreshInFlight
      refreshInFlight = (async () => {
        const { isMock } = useMock()
        if (isMock.value || !this.refreshToken) return false
        try {
          const config = useRuntimeConfig()
          const res = await $fetch<{ token: string, refreshToken: string }>(`${config.public.apiUrl}/auth/refresh`, {
            method: 'POST',
            body: { refreshToken: this.refreshToken },
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
        const response = await $fetch<{ user: User, token: string, refreshToken?: string }>(`${config.public.apiUrl}/auth/login`, {
          method: 'POST',
          body: { email, password },
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
      // best-effort server-side revoke (don't block the UI on it)
      if (!isMock.value && this.refreshToken) {
        const config = useRuntimeConfig()
        void $fetch(`${config.public.apiUrl}/auth/logout`, { method: 'POST', body: { refreshToken: this.refreshToken } }).catch(() => {})
      }
      this.user = null
      this.token = null
      this.refreshToken = null
      this.persist()
      navigateTo('/login')
    },
  },
})
