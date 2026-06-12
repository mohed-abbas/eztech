// Geocodes a free-text address to coordinates so the manual checkout address can be
// zone-checked and sent as a dropoff (the Address model stores no lat/lng, and geolocation
// is the only other coordinate source). Proxied server-side to set a Nominatim-compliant
// User-Agent and keep the provider swappable without touching the client.
interface NominatimHit {
  lat: string
  lon: string
}

export default defineEventHandler(async (event) => {
  const q = String(getQuery(event).q ?? '').trim()
  if (q.length < 3) {
    throw createError({ statusCode: 400, statusMessage: 'address query too short' })
  }

  try {
    const hits = await $fetch<NominatimHit[]>('https://nominatim.openstreetmap.org/search', {
      query: { q, format: 'json', limit: 1, countrycodes: 'fr' },
      headers: { 'User-Agent': 'eztech-checkout/1.0 (dev geocoding)' },
    })
    const hit = hits?.[0]
    if (!hit) return { found: false as const }
    return { found: true as const, lat: Number(hit.lat), lng: Number(hit.lon) }
  }
  catch (err) {
    console.error('[geocode BFF] nominatim lookup failed:', err)
    return { found: false as const }
  }
})
