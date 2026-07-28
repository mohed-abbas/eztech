import { getCurrentInstance } from 'vue'
import type { BackendOrderStatus } from '~/lib/orderStatus'

// ─── Live order-tracking composable (TRACK-01 / TRACK-04 / TRACK-07, Pitfall A) ──
// Consumes the singleton socket, subscribes to the per-order room, and exposes the
// reactive rider position + live status to the page. It is driven by the LIVE Prisma
// OrderStatus vocabulary (awaiting_payment | pending_assignment | rider_assigned |
// at_warehouse | picked_up | in_transit | delivered | cancelled) — NOT the divergent
// frontend mock vocabulary — so a live status never blows up a STATUS_CONFIG-style
// lookup (Pitfall A: the mock-vs-live reconciliation).
//
// Rooms are PER-SOCKET on the server (backend/src/socket/handlers/order.ts joins
// `order:<id>` on the socket that asked). A reconnect (Wi-Fi to 4G, or the 15-minute
// access token expiring, which force-disconnects the socket server-side) produces a new
// socket id that has joined nothing. Subscribing only on mount therefore left the map
// frozen and the badge stuck while the UI claimed a healthy connection. The subscription
// is now replayed on EVERY (re)connection, driven by the socket's `connected` state.

export interface RiderPos {
  lat: number
  lng: number
}

// the named-field payloads from the frozen contract (Plan 02 events.ts)
interface RiderMovedPayload {
  lat: number
  lng: number
  at: string
}
interface OrderStatusPayload {
  orderId: string
  status: string
}
interface SocketErrorPayload {
  code: string
}

// the only live statuses where the rider physically carries the parcel → live map on.
// Gating lives HERE against the LIVE status (moved out of pages/orders/[id].vue's
// mock TRANSIT_STATUSES) so the contract is testable in isolation (TRACK-07).
const TRANSIT_STATUSES: BackendOrderStatus[] = ['picked_up', 'in_transit']

// The order this browser's socket last joined a room for. Module scope on purpose: it is a
// property of the shared socket, not of a component. `rider-moved` carries no orderId, so a
// socket left in a previous order's room would paint the next order's map with the wrong
// rider. Client-only: SSR never subscribes, so no cross-request state is written on the server.
let joinedOrderId: string | null = null

export interface TrackedOrder {
  id: string
  status: string
}

export function useOrderTracking(orderId: string, liveOrder?: TrackedOrder | null) {
  const socketApi = useSocket()
  const { on, off, emit, connected, reconnecting } = socketApi
  // the socket layer grew these after this composable's test double was written; fall back so a
  // stubbed useSocket() can never break the tracking gate.
  const authExpired = socketApi.authExpired ?? ref(false)

  // reactive live position — null until the first rider-moved (last-known replays on subscribe, D-05)
  const riderPos = ref<RiderPos | null>(null)
  // live status seeded from the order, then kept current by order-status events.
  // Held as a plain string so the full Prisma vocabulary is tolerated without throwing.
  const status = ref<string>(liveOrder?.status ?? '')
  const lastUpdate = ref<number | null>(null)
  const forbidden = ref(false)

  // active ONLY for the live transit statuses; false on delivered (and everything else).
  const isActive = computed(() => TRANSIT_STATUSES.includes(status.value as BackendOrderStatus))
  // the live map is shown exactly when tracking is active (TRACK-07)
  const showMap = isActive

  // ─── socket event handlers ───────────────────────────────────────────────
  function onRiderMoved(payload: RiderMovedPayload) {
    if (!payload || typeof payload.lat !== 'number' || typeof payload.lng !== 'number') return
    // ALWAYS the named fields — never a coords array (D-12 / Pitfall D)
    riderPos.value = { lat: payload.lat, lng: payload.lng }
    lastUpdate.value = Date.now()
  }

  function onOrderStatus(payload: OrderStatusPayload) {
    if (!payload || payload.orderId !== orderId) return
    // assign verbatim — any Prisma OrderStatus value is valid here (Pitfall A)
    status.value = payload.status
  }

  function onError(payload: SocketErrorPayload) {
    if (payload?.code === 'FORBIDDEN') forbidden.value = true
  }

  // Listener registration is idempotent: socket.io stacks duplicate `on()` calls for the same
  // handler reference, so a re-subscription must never re-register, which would double every
  // rider-moved. Only the `subscribe:order` emit is replayed on reconnect.
  let listening = false

  function listen() {
    if (listening) return
    on('rider-moved', onRiderMoved as (...args: never[]) => void)
    on('order-status', onOrderStatus as (...args: never[]) => void)
    on('error', onError as (...args: never[]) => void)
    listening = true
  }

  function subscribe() {
    listen()

    // Switching from another order: the socket is still in that order's room and the server
    // has no unsubscribe handler, so ask for a fresh socket first. The bounce fires `connected`
    // false → true, and the watcher below re-enters subscribe() with a clean socket.
    if (joinedOrderId !== null && joinedOrderId !== orderId && typeof socketApi.resetRooms === 'function') {
      joinedOrderId = null
      socketApi.resetRooms()
      return
    }

    joinedOrderId = orderId
    // Re-emitting for a room already joined is harmless: the server re-runs the ownership check
    // and calls socket.join(), which is a Set insert, then replays the last known position.
    emit('subscribe:order', { orderId })
  }

  function cleanup() {
    if (!listening) return
    off('rider-moved', onRiderMoved as (...args: never[]) => void)
    off('order-status', onOrderStatus as (...args: never[]) => void)
    off('error', onError as (...args: never[]) => void)
    listening = false
    // `joinedOrderId` is deliberately NOT cleared: the socket really is still in that room, and
    // the next order page needs to know it must be reset.
  }

  // wire up on mount, tear down on unmount (client-only; SSR has no socket).
  // Only register the lifecycle hooks when called inside a component setup — keeps the
  // composable directly testable (and warning-free) outside a component instance.
  if (getCurrentInstance()) {
    onMounted(() => {
      if (!import.meta.client) return
      listen()
      // Only subscribe once the handshake is live. When it is still in flight the watcher below
      // fires on 'connect', which also avoids emitting into socket.io's send buffer twice.
      if (connected.value) subscribe()
    })

    // THE reconnect fix: every fresh socket has joined nothing, so replay the room join.
    // No storm risk: this is edge-driven by socket.io's own backoff, one emit per connect.
    watch(connected, (isConnected, wasConnected) => {
      if (!import.meta.client) return
      if (isConnected && !wasConnected) subscribe()
    })

    // Vue disposes the watcher with the scope, so a reconnect landing after the page is gone
    // cannot re-subscribe, and the removed listeners cannot repaint a dead component.
    onBeforeUnmount(cleanup)
  }

  return {
    riderPos,
    status,
    showMap,
    isActive,
    connected,
    reconnecting,
    // true when the session died and no refresh could revive the socket: the page must stop
    // promising a reconnection that will never come.
    authExpired,
    lastUpdate,
    forbidden,
    // exposed for tests / manual wiring without relying on the lifecycle hook
    _subscribe: subscribe,
    _onOrderStatus: onOrderStatus,
    _onRiderMoved: onRiderMoved,
  }
}
