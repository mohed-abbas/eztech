import mockZones from '../../app/data/mock/service-zones.json'

interface ApiZone {
  id: string
  name: string
  geometry: { type: 'Polygon', coordinates: number[][][] }
  isActive: boolean
}

// the frontend useServiceZone reads a GeoJSON FeatureCollection (.features)
function fromMock() {
  return mockZones
}

function remap(zones: ApiZone[]) {
  return {
    type: 'FeatureCollection' as const,
    features: zones.map((z) => ({
      type: 'Feature' as const,
      properties: { id: z.id, name: z.name, isActive: z.isActive },
      geometry: z.geometry,
    })),
  }
}

export default defineEventHandler(async () => {
  const config = useRuntimeConfig()
  if (config.public.useMock) return fromMock()

  try {
    const res = await $fetch<{ zones: ApiZone[] }>(`${config.apiUrl}/zones`)
    return remap(res.zones)
  }
  catch (err) {
    // In live mode, surface the failure instead of serving the mock Paris polygons — same rule as
    // server/api/orders.ts. Those polygons green-light an address the backend then rejects with
    // outside_delivery_zone, which is the exact hazard useServiceZone.ts already warns about.
    console.error('[zones BFF] /zones backend fetch failed:', err)
    const e = err as { statusCode?: number, response?: { status?: number } }
    throw createError({
      statusCode: e.statusCode ?? e.response?.status ?? 502,
      statusMessage: 'zones_fetch_failed',
    })
  }
})
