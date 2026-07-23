// GET /api/directions?from=lat,lng&to=lat,lng  → driving route polyline + distance + duration.
//
// Proxied server-side (D4) so the OpenRouteService key never reaches the client bundle. Powers
// rider navigation (Module 4) and the ETA on the customer tracking map (Module 5).
//
// Caching: the warehouse→customer route for a given order does not change, so identical
// coordinate pairs are cached in-process to protect the free-tier quota (2K req/day). A rider's
// live position DOES change, but rider navigation re-queries against a moving origin — callers
// that want to spare the quota should query origin→destination once and reuse it.
//
// Degradation: with no key configured (or an ORS error), we return a straight-line (haversine)
// estimate flagged `estimated: true` rather than failing, so the map still shows *something*.

interface OrsGeoJson {
  features: Array<{
    geometry: { type: 'LineString', coordinates: number[][] }
    properties: { summary: { distance: number, duration: number } }
  }>
}

export interface DirectionsResult {
  // GeoJSON [lng, lat] pairs — Leaflet consumers swap to [lat, lng]
  coordinates: number[][]
  distance: number // metres
  duration: number // seconds
  estimated: boolean // true when this is a straight-line fallback, not a real road route
}

const CACHE_TTL_MS = 60 * 60 * 1000 // 1h — the route geometry itself is effectively static
const cache = new Map<string, { at: number, value: DirectionsResult }>()

function parseLatLng(raw: unknown): [number, number] | null {
  const parts = String(raw ?? '').split(',')
  if (parts.length !== 2) return null
  const lat = Number(parts[0])
  const lng = Number(parts[1])
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return [lat, lng]
}

function haversine(a: [number, number], b: [number, number]): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b[0] - a[0])
  const dLng = toRad(b[1] - a[1])
  const lat1 = toRad(a[0])
  const lat2 = toRad(b[0])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

// Straight-line fallback: distance + a coarse 30 km/h urban ETA. Flagged estimated:true.
function fallback(from: [number, number], to: [number, number]): DirectionsResult {
  const distance = haversine(from, to)
  return {
    coordinates: [[from[1], from[0]], [to[1], to[0]]],
    distance,
    duration: (distance / 1000 / 30) * 3600,
    estimated: true,
  }
}

export default defineEventHandler(async (event): Promise<DirectionsResult> => {
  const query = getQuery(event)
  const from = parseLatLng(query.from)
  const to = parseLatLng(query.to)
  if (!from || !to) {
    throw createError({ statusCode: 400, statusMessage: 'from and to must be "lat,lng" pairs' })
  }

  const cacheKey = `${from[0].toFixed(5)},${from[1].toFixed(5)}|${to[0].toFixed(5)},${to[1].toFixed(5)}`
  const hit = cache.get(cacheKey)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value

  const config = useRuntimeConfig()
  const key = config.orsApiKey as string
  if (!key) {
    // No key provisioned yet — degrade rather than 500 so the map still renders.
    return fallback(from, to)
  }

  try {
    // ORS expects [lng, lat] order.
    const res = await $fetch<OrsGeoJson>(
      'https://api.openrouteservice.org/v2/directions/driving-car/geojson',
      {
        method: 'POST',
        headers: { Authorization: key, 'Content-Type': 'application/json' },
        body: { coordinates: [[from[1], from[0]], [to[1], to[0]]] },
      },
    )
    const feature = res.features?.[0]
    if (!feature) return fallback(from, to)

    const value: DirectionsResult = {
      coordinates: feature.geometry.coordinates,
      distance: feature.properties.summary.distance,
      duration: feature.properties.summary.duration,
      estimated: false,
    }
    cache.set(cacheKey, { at: Date.now(), value })
    return value
  }
  catch (err) {
    console.error('[directions BFF] ORS request failed, returning straight-line estimate:', err)
    return fallback(from, to)
  }
})
