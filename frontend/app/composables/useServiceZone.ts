import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import { point } from '@turf/helpers'
import zonesData from '~/data/mock/service-zones.json'

interface ZoneFeature {
  type: 'Feature'
  properties: { id: string, name: string, isActive: boolean }
  geometry: { type: 'Polygon', coordinates: number[][][] }
}

export interface ZoneCheckResult {
  inZone: boolean
  zoneName: string | null
}

/** Aucune zone chargée en mode live : impossible de dire si une adresse est desservie. */
export const ZONES_UNAVAILABLE = 'Zones de livraison indisponibles pour le moment. Réessayez dans quelques instants.'

const mockFeatures = (zonesData as unknown as { features: ZoneFeature[] }).features

// Client-side delivery-zone gate. In live mode this must read the SAME polygons the backend
// enforces on POST /api/orders, otherwise a zone edited in the DB lets the UI green-light an
// address the backend then rejects with outside_delivery_zone (H4). The mock JSON is used ONLY
// under isMock — never as a live fallback. If /api/zones fails in live mode we hold no zones and
// report the outage, because a wrong "adresse desservie" is worse than an honest "indisponible".
export function useServiceZone() {
  const { isMock } = useMock()
  const zones = ref<ZoneFeature[]>(isMock.value ? mockFeatures : [])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function load(): Promise<void> {
    if (isMock.value) {
      zones.value = mockFeatures
      return
    }
    loading.value = true
    error.value = null
    try {
      // /api/zones returns a GeoJSON FeatureCollection remapped from the backend's DB zones.
      const fc = await $fetch<{ features: ZoneFeature[] }>('/api/zones')
      zones.value = fc.features
    }
    catch (err) {
      console.error('[useServiceZone] /api/zones fetch failed:', err)
      zones.value = []
      error.value = ZONES_UNAVAILABLE
    }
    finally {
      loading.value = false
    }
  }

  // Fetch on the client as soon as the composable is used; check() reads zones.value reactively,
  // so any computed depending on it re-runs once the live zones arrive.
  if (import.meta.client) load()

  function check(lng: number, lat: number): ZoneCheckResult {
    const pt = point([lng, lat])
    for (const zone of zones.value) {
      if (!zone.properties.isActive) continue
      if (booleanPointInPolygon(pt, zone)) {
        return { inZone: true, zoneName: zone.properties.name }
      }
    }
    return { inZone: false, zoneName: null }
  }

  return { check, load, zones, loading, error }
}
