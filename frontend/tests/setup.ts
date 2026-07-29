import { vi } from 'vitest'
import { ref, computed, reactive, watch, onMounted, onBeforeUnmount } from 'vue'
import { useAuthedFetch } from '~/composables/useAuthedFetch'

// --- Stubs for the Nuxt auto-imports used by the code under test --------------
// This setup does NOT boot Nuxt; it just provides the few auto-imported globals
// the rider/auth stores reference at runtime. Tests reconfigure `nuxtStubState`.

interface MockAuth {
  token: string | null
  user: Record<string, unknown> | null
  hydrate: () => void
  refresh: () => Promise<boolean>
  logout: () => void
  // useAuthedFetch efface la session locale au lieu de repartir vers un serveur qui vient
  // deja de rejeter le token — le stub doit donc l'exposer.
  clearSession: () => void
}

export function makeAuth(over: Partial<MockAuth> = {}): MockAuth {
  return {
    token: 'test-token',
    user: { id: 'rider-1', name: 'Test Rider' },
    hydrate: vi.fn(),
    refresh: vi.fn().mockResolvedValue(false),
    logout: vi.fn(),
    clearSession: vi.fn(),
    ...over,
  }
}

const state = {
  apiUrl: 'http://api.test/api',
  isMock: false,
  auth: makeAuth(),
  fetch: vi.fn(),
  csrf: 'test-csrf',
}

// exported so tests can tweak behaviour
export const nuxtStubState = state

// Etat partage facon Nuxt useState() : une ref unique par cle pour toute « l'app ». Les
// notifications vivent desormais la-dedans (useNotifications.ts), et vitest ne demarre pas Nuxt.
const nuxtState = new Map<string, { value: unknown }>()

// a appeler dans beforeEach : sans ca, une cle survit d'un test a l'autre.
export function resetNuxtState() {
  nuxtState.clear()
}

const g = globalThis as Record<string, unknown>
g.useState = <T>(key: string, init: () => T) => {
  if (!nuxtState.has(key)) nuxtState.set(key, ref(init()) as { value: unknown })
  return nuxtState.get(key)!
}
g.$fetch = (...args: unknown[]) => state.fetch(...args)
g.useRuntimeConfig = () => ({ public: { apiUrl: state.apiUrl } })
g.useMock = () => ({ isMock: { value: state.isMock } })
g.useAuthStore = () => state.auth
// mimics Nuxt's useCookie() — the rider/auth stores only ever read `.value` for the
// CSRF cookie, so a plain ref-like object is enough (Phase 7 cookie/CSRF auth).
g.useCookie = (_name: string) => ({ value: state.csrf })
// vrai composable, pas un double : le chemin « 401 -> refresh -> retry -> clearSession » teste ici
// doit etre celui que le store utilise en production. Il ne lit que les stubs ci-dessus.
g.useAuthedFetch = useAuthedFetch
Object.assign(g, { ref, computed, reactive, watch, onMounted, onBeforeUnmount })
