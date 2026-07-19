import { getCurrentInstance } from 'vue'
import type { BackendOrderStatus } from '~/lib/orderStatus'

// ─── Live order-tracking composable (TRACK-01 / TRACK-04 / TRACK-07, Pitfall A) ──
// Consumes the singleton socket, subscribes to the per-order room, and exposes the
// reactive rider position + live status to the page. It is driven by the LIVE Prisma
// OrderStatus vocabulary (awaiting_payment | pending_assignment | rider_assigned |
// at_warehouse | picked_up | in_transit | delivered | cancelled) — NOT the divergent
// frontend mock vocabulary — so a live status never blows up a STATUS_CONFIG-style
// lookup (Pitfall A: the mock-vs-live reconciliation).

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

export interface TrackedOrder {
  id: string
  status: string
}

export function useOrderTracking(orderId: string, liveOrder?: TrackedOrder | null) {
  const { on, off, emit, connected, reconnecting } = useSocket()

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

  function subscribe() {
    on('rider-moved', onRiderMoved as (...args: never[]) => void)
    on('order-status', onOrderStatus as (...args: never[]) => void)
    on('error', onError as (...args: never[]) => void)
    emit('subscribe:order', { orderId })
  }

  function cleanup() {
    off('rider-moved', onRiderMoved as (...args: never[]) => void)
    off('order-status', onOrderStatus as (...args: never[]) => void)
    off('error', onError as (...args: never[]) => void)
  }

  // wire up on mount, tear down on unmount (client-only; SSR has no socket).
  // Only register the lifecycle hooks when called inside a component setup — keeps the
  // composable directly testable (and warning-free) outside a component instance.
  if (getCurrentInstance()) {
    onMounted(() => {
      if (!import.meta.client) return
      subscribe()
    })
    onBeforeUnmount(cleanup)
  }

  return {
    riderPos,
    status,
    showMap,
    isActive,
    connected,
    reconnecting,
    lastUpdate,
    forbidden,
    // exposed for tests / manual wiring without relying on the lifecycle hook
    _subscribe: subscribe,
    _onOrderStatus: onOrderStatus,
    _onRiderMoved: onRiderMoved,
  }
}
