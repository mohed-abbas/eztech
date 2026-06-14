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
    // backend unreachable — degrade to the local zone hint rather than blocking checkout
    console.error('[zones BFF] /zones backend fetch failed, serving mock data:', err)
    return fromMock()
  }
})
