// ─── Rider-side GPS emit hook (D-02 / D-03 / D-06 / TRACK-03) ──────────────
// A gated watchPosition → rider:position emitter, ready for Ilia's rider client.
// This is NOT a full rider geolocation UI (Ilia's domain) — it is just the wiring
// that, once started for an active order, streams the browser's GPS fixes over the
// singleton socket using the frozen event name and named {lat,lng,accuracy} fields.
//
// Cadence: watchPosition with maximumAge ~3000ms keeps the effective fix rate around
// 3–5s (D-06); the server-side ≥1/s throttle (Plan 03) is the hard floor.

export function useRiderPositionEmitter(orderId: string) {
  const { emit } = useSocket()

  let watchId: number | null = null

  function start(): void {
    // client-only + geolocation-capable guard (T-05-14)
    if (!import.meta.client) return
    if (typeof navigator === 'undefined' || !navigator.geolocation) return
    if (watchId !== null) return // already watching

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        // ALWAYS named fields — never a coords array (D-12)
        emit('rider:position', {
          orderId,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        })
      },
      () => {
        // swallow geolocation errors here; the rider UI surfaces permission issues
      },
      {
        enableHighAccuracy: true,
        maximumAge: 3000,
        timeout: 10000,
      },
    )
  }

  function stop(): void {
    if (!import.meta.client) return
    if (watchId !== null && navigator?.geolocation) {
      navigator.geolocation.clearWatch(watchId)
      watchId = null
    }
  }

  // best-effort cleanup if used inside a component
  onBeforeUnmount(stop)

  return { start, stop }
}
