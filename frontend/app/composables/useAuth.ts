import type { Ref } from 'vue'

export interface Address {
  id: string
  label: string
  street: string
  city: string
  zipCode: string
  coordinates?: { lat: number; lng: number }
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

export function useAuth() {
  const user = useState<User | null>('auth:user', () => null)
  const token = useState<string | null>('auth:token', () => null)
  const loading = useState<boolean>('auth:loading', () => false)

  const isAuthenticated = computed(() => !!user.value && !!token.value)
  const role = computed(() => user.value?.role ?? null)

  // Hydrate from localStorage on client
  if (import.meta.client) {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY)
    if (stored && !user.value) {
      try {
        const parsed = JSON.parse(stored)
        if (parsed.user && parsed.token) {
          user.value = parsed.user
          token.value = parsed.token
        }
      }
      catch {
        localStorage.removeItem(AUTH_STORAGE_KEY)
      }
    }
  }

  function persist() {
    if (!import.meta.client) return
    if (user.value && token.value) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
        user: user.value,
        token: token.value,
      }))
    }
    else {
      localStorage.removeItem(AUTH_STORAGE_KEY)
    }
  }

  // Sync state to localStorage on changes
  watch([user, token], persist, { deep: true })

  async function login(email: string, password: string): Promise<User> {
    loading.value = true
    try {
      const { isMock } = useMock()

      if (isMock.value) {
        // Simulate network delay
        await new Promise(r => setTimeout(r, 600))

        const mockUsers = (await import('~/data/mock/users.json')).default
        const found = mockUsers.find(
          (u: { email: string; password: string }) => u.email === email && u.password === password,
        )

        if (!found) {
          throw new Error('Email ou mot de passe incorrect.')
        }

        const { password: _, ...userData } = found
        user.value = userData as User
        token.value = `mock-jwt-${found.id}-${Date.now()}`
        return user.value!
      }

      // Real API (Phase 2)
      const config = useRuntimeConfig()
      const response = await $fetch<{ user: User; token: string }>(`${config.public.apiUrl}/auth/login`, {
        method: 'POST',
        body: { email, password },
      })
      user.value = response.user
      token.value = response.token
      return user.value!
    }
    finally {
      loading.value = false
    }
  }

  async function register(payload: RegisterPayload): Promise<User> {
    loading.value = true
    try {
      const { isMock } = useMock()

      if (isMock.value) {
        await new Promise(r => setTimeout(r, 800))

        // Check for duplicate email
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

        user.value = newUser
        token.value = `mock-jwt-${newUser.id}-${Date.now()}`
        return newUser
      }

      // Real API (Phase 2)
      const config = useRuntimeConfig()
      const response = await $fetch<{ user: User; token: string }>(`${config.public.apiUrl}/auth/register`, {
        method: 'POST',
        body: payload,
      })
      user.value = response.user
      token.value = response.token
      return user.value!
    }
    finally {
      loading.value = false
    }
  }

  async function forgotPassword(email: string): Promise<void> {
    loading.value = true
    try {
      const { isMock } = useMock()

      if (isMock.value) {
        await new Promise(r => setTimeout(r, 800))

        const mockUsers = (await import('~/data/mock/users.json')).default
        const exists = mockUsers.some((u: { email: string }) => u.email === email)
        if (!exists) {
          throw new Error('Aucun compte trouvé avec cet email.')
        }
        // In mock mode, just simulate success
        return
      }

      // Real API (Phase 2)
      const config = useRuntimeConfig()
      await $fetch(`${config.public.apiUrl}/auth/forgot-password`, {
        method: 'POST',
        body: { email },
      })
    }
    finally {
      loading.value = false
    }
  }

  function logout() {
    user.value = null
    token.value = null
    navigateTo('/login')
  }

  return {
    user: user as Ref<User | null>,
    token: token as Ref<string | null>,
    loading: loading as Ref<boolean>,
    isAuthenticated,
    role,
    login,
    register,
    forgotPassword,
    logout,
  }
}
