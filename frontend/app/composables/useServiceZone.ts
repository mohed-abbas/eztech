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

export function useServiceZone() {
  const zones = (zonesData as unknown as { features: ZoneFeature[] }).features

  function check(lng: number, lat: number): ZoneCheckResult {
    const pt = point([lng, lat])
    for (const zone of zones) {
      if (!zone.properties.isActive) continue
      if (booleanPointInPolygon(pt, zone)) {
        return { inZone: true, zoneName: zone.properties.name }
      }
    }
    return { inZone: false, zoneName: null }
  }

  return { check }
}
