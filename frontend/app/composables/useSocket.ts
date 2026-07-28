import { io, type Socket } from 'socket.io-client'

// ─── Singleton socket.io-client (D-11 / TRACK-05) ──────────────────────────
// One client per browser session, created lazily and ONLY on the client (CLAUDE.md:
// the socket must never instantiate during SSR). Connects to the backend ROOT
// (config.public.socketUrl, e.g. :3001) — NOT config.public.apiUrl, which ends in /api.
// The JWT is carried in the handshake auth and re-set from the auth store on every
// (re)connect attempt so a refreshed token is picked up after expiry (TRACK-05).
//
// Reconnection is socket.io's own (backoff + jitter); this module only makes sure that
// every retry leaves with usable credentials:
//   - the access token lives 15 minutes and backend/src/socket/auth.ts force-disconnects
//     the socket the moment it expires. Retrying with that same dead token loops forever,
//     so an `unauthorized` handshake refusal triggers ONE deduped auth.refresh() and lets
//     the built-in backoff carry the next attempt (bounded, see MAX_AUTH_RECOVERIES).
//   - when nothing can be renewed any more, `authExpired` says so instead of leaving the
//     UI stuck on a "reconnexion…" hint that will never resolve.

let socket: Socket | null = null

// reactive connection state shared across every consumer of the singleton
const connected = ref(false)
const reconnecting = ref(false)
// true once a handshake was refused for an auth reason AND no token refresh could repair it
const authExpired = ref(false)

// A backend answering `unauthorized` must never turn into a refresh storm: at most this many
// refresh round trips per disconnection episode. The counter resets on every successful connect.
const MAX_AUTH_RECOVERIES = 3
let authRecoveries = 0
let recoveringAuth = false

// socket.io surfaces a middleware rejection as a connect_error carrying the server-side
// Error message, and backend/src/socket/auth.ts rejects with `unauthorized`. Transport failures
// ("xhr poll error", "timeout", "websocket error") must NOT be treated as an auth problem.
function isAuthError(err: unknown): boolean {
  const message = (err as { message?: unknown } | null)?.message
  return typeof message === 'string' && message.toLowerCase().includes('unauthorized')
}

function ensureSocket(): Socket | null {
  // SSR guard — never build a client during server render (T-05-14)
  if (!import.meta.client) return null
  if (socket) return socket

  const config = useRuntimeConfig()
  const auth = useAuthStore()
  // Captured once: socket.io callbacks fire outside any Vue/Nuxt context, and auth.refresh()
  // reaches for useRuntimeConfig()/useCookie() internally. runWithContext re-enters the app
  // context so the refresh cannot throw "nuxt instance unavailable" from an event handler.
  const nuxtApp = useNuxtApp()
  // make sure the token is restored from storage before the handshake goes out
  auth.hydrate()

  const url = (config.public.socketUrl as string) || 'http://localhost:3001'

  socket = io(url, {
    // rely on socket.io-client's BUILT-IN reconnection — do NOT hand-roll backoff
    autoConnect: true,
    transports: ['websocket', 'polling'],
    // withCredentials sends the httpOnly ez_access cookie on the handshake so a cookie-only session
    // (no in-memory token) still authenticates; the auth.token path stays for header-based clients (Phase 7).
    withCredentials: true,
    auth: { token: auth.token },
  })

  // Puts the CURRENT token on the handshake. Called before every retry, so a token rotated by
  // any other part of the app (an authed fetch, a fresh login in this same tab) is picked up
  // without a page reload.
  function syncHandshakeAuth(): void {
    if (socket) socket.auth = { token: auth.token }
  }

  // Exchange the refresh token once, then hand the retry back to socket.io's backoff.
  async function recoverAuth(): Promise<void> {
    if (recoveringAuth || authRecoveries >= MAX_AUTH_RECOVERIES) return
    recoveringAuth = true
    authRecoveries += 1
    try {
      // auth.refresh() already dedupes concurrent callers (refreshInFlight in stores/auth.ts)
      const renewed = await nuxtApp.runWithContext(() => auth.refresh())
      if (renewed) syncHandshakeAuth()
      // nothing left to renew: stop spending attempts. A later login in this tab still heals
      // the socket, because syncHandshakeAuth() runs before every retry.
      else authRecoveries = MAX_AUTH_RECOVERIES
      authExpired.value = !renewed
    }
    catch {
      authExpired.value = true
    }
    finally {
      recoveringAuth = false
    }
  }

  socket.on('connect', () => {
    connected.value = true
    reconnecting.value = false
    authExpired.value = false
    authRecoveries = 0
  })

  // Re-set the (possibly refreshed) token before each reconnection attempt so the
  // server re-authorises the handshake after a token rotation (TRACK-05 / T-05-12).
  socket.io.on('reconnect_attempt', () => {
    reconnecting.value = true
    syncHandshakeAuth()
  })

  socket.on('connect_error', (err: Error) => {
    connected.value = false
    reconnecting.value = true
    // refresh the token on the handshake so the next built-in retry can re-auth
    syncHandshakeAuth()
    if (isAuthError(err)) void recoverAuth()
  })

  socket.on('disconnect', () => {
    connected.value = false
    reconnecting.value = true
    syncHandshakeAuth()
  })

  return socket
}

// Rooms are per-socket on the server (backend/src/socket/handlers/order.ts joins `order:<id>`)
// and there is no `unsubscribe:order` handler, so the only way to leave every room from the
// client is to hand the server a brand-new socket. Used when the app switches from tracking one
// order to another, otherwise the old room's rider-moved events would keep painting the new map.
function resetRooms(): void {
  if (!socket) return
  socket.disconnect()
  socket.connect()
}

export function useSocket() {
  const s = ensureSocket()

  function emit(event: string, ...args: unknown[]): void {
    s?.emit(event, ...args)
  }

  function on(event: string, handler: (...args: never[]) => void): void {
    s?.on(event, handler as (...args: unknown[]) => void)
  }

  function off(event: string, handler?: (...args: never[]) => void): void {
    s?.off(event, handler as ((...args: unknown[]) => void) | undefined)
  }

  return {
    socket: s,
    connected,
    reconnecting,
    authExpired,
    emit,
    on,
    off,
    resetRooms,
  }
}
