import { vi } from 'vitest'
import { ref, computed, reactive, watch, onMounted, onBeforeUnmount } from 'vue'

// --- Stubs for the Nuxt auto-imports used by the code under test --------------
// This setup does NOT boot Nuxt; it just provides the few auto-imported globals
// the rider/auth stores reference at runtime. Tests reconfigure `nuxtStubState`.

interface MockAuth {
  token: string | null
  user: Record<string, unknown> | null
  hydrate: () => void
  refresh: () => Promise<boolean>
  logout: () => void
}

export function makeAuth(over: Partial<MockAuth> = {}): MockAuth {
  return {
    token: 'test-token',
    user: { id: 'rider-1', name: 'Test Rider' },
    hydrate: vi.fn(),
    refresh: vi.fn().mockResolvedValue(false),
    logout: vi.fn(),
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

const g = globalThis as Record<string, unknown>
g.$fetch = (...args: unknown[]) => state.fetch(...args)
g.useRuntimeConfig = () => ({ public: { apiUrl: state.apiUrl } })
g.useMock = () => ({ isMock: { value: state.isMock } })
g.useAuthStore = () => state.auth
// mimics Nuxt's useCookie() — the rider/auth stores only ever read `.value` for the
// CSRF cookie, so a plain ref-like object is enough (Phase 7 cookie/CSRF auth).
g.useCookie = (_name: string) => ({ value: state.csrf })
Object.assign(g, { ref, computed, reactive, watch, onMounted, onBeforeUnmount })
