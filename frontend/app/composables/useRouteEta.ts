import { getCurrentInstance } from 'vue'
import type { Ref } from 'vue'

// Live routed ETA for the customer tracking map (D4). Fetches the real driving duration from
// /api/directions (rider position → dropoff) instead of the straight-line heuristic in lib/eta.ts.
//
// Throttling matters: rider positions arrive every ~3-5s, but the underlying router (OSRM public
// demo server) is rate-limited, so we refetch at most once per REFRESH_MS — except the very first
// fix, which resolves immediately so the ETA appears without a 30s wait.

interface LatLng { lat: number, lng: number }

const REFRESH_MS = 30_000

export function useRouteEta(from: Ref<LatLng | null>, to: Ref<LatLng | null | undefined>) {
  // routed duration in seconds; null until the first successful fetch
  const etaSeconds = ref<number | null>(null)
  // true when the router fell back to a straight-line estimate (no key / router down)
  const estimated = ref(false)
  let lastFetch = 0

  async function refresh(): Promise<void> {
    if (!import.meta.client) return
    const f = from.value
    const t = to.value
    if (!f || !t) return

    // always fetch the first fix; afterwards honour the throttle window
    const force = etaSeconds.value === null
    const now = Date.now()
    if (!force && now - lastFetch < REFRESH_MS) return
    lastFetch = now

    try {
      const res = await $fetch<{ duration: number, estimated: boolean }>('/api/directions', {
        query: { from: `${f.lat},${f.lng}`, to: `${t.lat},${t.lng}` },
      })
      etaSeconds.value = res.duration
      estimated.value = res.estimated
    }
    catch {
      // keep the last known ETA rather than flicker to null on a transient failure
    }
  }

  // recompute as the rider moves (throttled inside refresh) and when the destination resolves
  watch([from, to], refresh, { immediate: true })

  // clear once the parcel is delivered / positions stop (caller sets `from` to null)
  watch(from, (v) => { if (!v) etaSeconds.value = null })

  if (getCurrentInstance()) onMounted(refresh)

  return { etaSeconds, estimated, refresh }
}
