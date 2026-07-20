// ETA (temps estimé d'arrivée) du livreur vers la destination.
// Heuristique locale : distance à vol d'oiseau (haversine) / vitesse moyenne urbaine.
// L'ETA « routier » exact via OpenRouteService reste côté backend temps réel.
export interface LatLng {
  lat: number
  lng: number
}

const EARTH_RADIUS_M = 6_371_000
// Vitesse moyenne d'un livreur en ville (km/h).
export const AVG_RIDER_SPEED_KMH = 18

export function haversineMeters(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

// ETA en secondes entre deux points à la vitesse moyenne livreur.
export function estimateEtaSeconds(from: LatLng, to: LatLng, speedKmh = AVG_RIDER_SPEED_KMH): number {
  if (speedKmh <= 0) return 0
  const meters = haversineMeters(from, to)
  const metersPerSecond = (speedKmh * 1000) / 3600
  return Math.round(meters / metersPerSecond)
}

export function formatEta(seconds: number): string {
  if (seconds <= 0) return 'Arrivée imminente'
  const minutes = Math.round(seconds / 60)
  if (minutes < 1) return "moins d'1 min"
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h} h` : `${h} h ${m}`
}
