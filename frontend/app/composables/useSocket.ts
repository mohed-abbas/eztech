import { io, type Socket } from 'socket.io-client'

// ─── Singleton socket.io-client (D-11 / TRACK-05) ──────────────────────────
// One client per browser session, created lazily and ONLY on the client (CLAUDE.md:
// the socket must never instantiate during SSR). Connects to the backend ROOT
// (config.public.socketUrl, e.g. :3001) — NOT config.public.apiUrl, which ends in /api.
// The JWT is carried in the handshake auth and re-set from the auth store on every
// (re)connect attempt so a refreshed token is picked up after expiry (TRACK-05).

let socket: Socket | null = null

// reactive connection state shared across every consumer of the singleton
const connected = ref(false)
const reconnecting = ref(false)

function ensureSocket(): Socket | null {
  // SSR guard — never build a client during server render (T-05-14)
  if (!import.meta.client) return null
  if (socket) return socket

  const config = useRuntimeConfig()
  const auth = useAuthStore()
  // make sure the token is restored from storage before the handshake goes out
  auth.hydrate()

  const url = (config.public.socketUrl as string) || 'http://localhost:3001'

  socket = io(url, {
    // rely on socket.io-client's BUILT-IN reconnection — do NOT hand-roll backoff
    autoConnect: true,
    transports: ['websocket', 'polling'],
    auth: { token: auth.token },
  })

  socket.on('connect', () => {
    connected.value = true
    reconnecting.value = false
  })

  // Re-set the (possibly refreshed) token before each reconnection attempt so the
  // server re-authorises the handshake after a token rotation (TRACK-05 / T-05-12).
  socket.io.on('reconnect_attempt', () => {
    reconnecting.value = true
    if (socket) socket.auth = { token: useAuthStore().token }
  })

  socket.on('connect_error', () => {
    connected.value = false
    reconnecting.value = true
    // refresh the token on the handshake so the next built-in retry can re-auth
    if (socket) socket.auth = { token: useAuthStore().token }
  })

  socket.on('disconnect', () => {
    connected.value = false
    reconnecting.value = true
    if (socket) socket.auth = { token: useAuthStore().token }
  })

  return socket
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
    emit,
    on,
    off,
  }
}
