import { getCurrentInstance } from 'vue'

// ─── Rider-side GPS emit hook (D-02 / D-03 / D-06 / TRACK-03) ──────────────
// A gated watchPosition → rider:position emitter. Once started for an active order it
// streams the browser's GPS fixes over the singleton socket using the frozen event name
// and named {lat,lng,accuracy} fields. The write path behind it (role check, zod bounds,
// 1/s throttle, Postgres assignment gate, Mongo upsert, then broadcast) is untouched.
//
// Cadence: watchPosition with maximumAge ~3000ms keeps the effective fix rate around
// 3–5s (D-06); the server-side ≥1/s throttle (Plan 03) is the hard floor.
//
// The watch is SHARED and reference-counted per order id, because more than one page
// legitimately drives the same delivery (the rider advances it from /rider/dashboard as
// well as from /rider/deliveries). Consequences:
//   - mounting a second emitter for an order already being emitted costs nothing and does
//     NOT double the fix rate;
//   - during a navigation where the new page mounts before the old one unmounts, the count
//     never reaches zero, so position sharing does not blink off between two rider screens;
//   - `sharing` is a shared reactive fact, so every page shows the same honest indicator.

export interface RiderGpsDelivery {
  id: string
  status: string
}

// the rider only broadcasts while physically carrying the parcel (D-06)
export const GPS_TRANSIT_STATUSES = ['picked_up', 'in_transit']

interface SharedWatch {
  watchId: number
  refs: number
}

// module scope = per browser tab, which is exactly the scope of the geolocation watch.
// Only ever written on the client (start() bails out during SSR).
const watches = new Map<string, SharedWatch>()

// reactive mirror of the map keys so templates can react to sharing starting/stopping
const watchedOrderIds = ref<string[]>([])
// timestamp of the last fix handed to the socket, so a page can prove the stream is alive
const lastFixAt = ref<number | null>(null)
// the browser refused the position (permission denied / unavailable): sharing is NOT live
const positionDenied = ref(false)

function syncWatchedIds() {
  watchedOrderIds.value = [...watches.keys()]
}

export function useRiderPositionEmitter(orderId: string) {
  const { emit, connected } = useSocket()

  // this handle's own claim on the shared watch. It makes stop() idempotent, so a page that
  // stops explicitly AND unmounts cannot release someone else's reference.
  let holds = false

  function start(): void {
    // client-only + geolocation-capable guard (T-05-14)
    if (!import.meta.client) return
    if (typeof navigator === 'undefined' || !navigator.geolocation) return
    if (holds) return

    const existing = watches.get(orderId)
    if (existing) {
      existing.refs += 1
      holds = true
      return
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        // A fix produced while the socket is down is worthless by the time the connection
        // returns: socket.io would flush the whole buffer at once and the server throttle
        // would keep an arbitrary stale one. Drop it and wait for the next fix instead.
        if (!connected.value) return
        // ALWAYS named fields — never a coords array (D-12)
        emit('rider:position', {
          orderId,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        })
        lastFixAt.value = Date.now()
        positionDenied.value = false
      },
      (err) => {
        // the rider UI surfaces the permission problem through `denied`; nothing to log here
        positionDenied.value = err?.code === 1 || err?.code === 2
      },
      {
        enableHighAccuracy: true,
        maximumAge: 3000,
        timeout: 10000,
      },
    )

    watches.set(orderId, { watchId, refs: 1 })
    holds = true
    syncWatchedIds()
  }

  function stop(): void {
    if (!import.meta.client || !holds) return
    holds = false
    const entry = watches.get(orderId)
    if (!entry) return
    entry.refs -= 1
    if (entry.refs > 0) return
    if (navigator?.geolocation) navigator.geolocation.clearWatch(entry.watchId)
    watches.delete(orderId)
    syncWatchedIds()
    if (watches.size === 0) {
      lastFixAt.value = null
      positionDenied.value = false
    }
  }

  // Truthful indicator: a registered watch is not enough, since a denied permission produces no
  // fix, and a dead socket sends nothing. Both pages read the same value (align with the
  // "Position partagée en direct avec le client" chip in pages/rider/deliveries.vue).
  const sharing = computed(() =>
    watchedOrderIds.value.includes(orderId) && !positionDenied.value && connected.value,
  )

  // best-effort cleanup if used inside a component; the hook is skipped when the composable
  // is created from a watcher callback (no active instance), where the caller owns the release.
  if (getCurrentInstance()) onBeforeUnmount(stop)

  return { start, stop, sharing, denied: readonly(positionDenied), lastFixAt: readonly(lastFixAt) }
}

// ─── Drop-in wiring for a page that owns an active delivery ────────────────
// Mirrors what pages/rider/deliveries.vue does by hand: start emitting as soon as the
// delivery enters a transit status, stop on any other status, follow an order id change,
// and release on unmount. Any page holding an active-delivery card can adopt live position
// sharing with two lines instead of a home-made copy of the same state machine.
export function useRiderGpsSharing(getDelivery: () => RiderGpsDelivery | null | undefined) {
  // read the socket from setup so the singleton is created inside a valid Nuxt context,
  // never from the watcher callback below
  const { connected } = useSocket()

  const emittingId = ref<string | null>(null)
  let handle: ReturnType<typeof useRiderPositionEmitter> | null = null

  function sync() {
    const delivery = getDelivery()
    const shouldEmit = !!delivery && GPS_TRANSIT_STATUSES.includes(delivery.status)

    if (shouldEmit && delivery) {
      if (emittingId.value === delivery.id) return
      handle?.stop()
      handle = useRiderPositionEmitter(delivery.id)
      handle.start()
      emittingId.value = delivery.id
      return
    }

    if (handle) {
      handle.stop()
      handle = null
      emittingId.value = null
    }
  }

  function release() {
    handle?.stop()
    handle = null
    emittingId.value = null
  }

  if (getCurrentInstance()) {
    watch(
      () => {
        const delivery = getDelivery()
        return `${delivery?.id ?? ''}:${delivery?.status ?? ''}`
      },
      sync,
      { immediate: true },
    )
    onBeforeUnmount(release)
  }

  // same truth test as the handle's own `sharing`, so both rider pages light up identically
  const sharing = computed(() =>
    !!emittingId.value && watchedOrderIds.value.includes(emittingId.value)
    && !positionDenied.value && connected.value,
  )

  return {
    sharing,
    emittingId: readonly(emittingId),
    denied: readonly(positionDenied),
    lastFixAt: readonly(lastFixAt),
    _sync: sync,
  }
}
