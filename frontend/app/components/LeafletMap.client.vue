<script setup lang="ts">
import 'leaflet/dist/leaflet.css'
import type { Map, Marker, Polyline, LatLngExpression } from 'leaflet'

interface Props {
  center?: [number, number]
  zoom?: number
  route?: [number, number][]
  warehousePos?: [number, number]
  destinationPos?: [number, number]
  animateRider?: boolean
  height?: string
}

const props = withDefaults(defineProps<Props>(), {
  center: () => [48.8566, 2.3522],
  zoom: 13,
  route: () => [],
  animateRider: false,
  height: '400px'
})

const mapContainer = ref<HTMLElement | null>(null)
let mapInstance: Map | null = null
let riderMarker: Marker | null = null
let routePolyline: Polyline | null = null
let animInterval: ReturnType<typeof setInterval> | null = null

// Crée une icône custom SVG pour le livreur
function createRiderIcon(L: typeof import('leaflet')) {
  return L.divIcon({
    html: `<div style="
      width:36px;height:36px;
      background:#7C3AED;
      border:3px solid white;
      border-radius:50%;
      box-shadow:0 2px 8px rgba(0,0,0,.3);
      display:flex;align-items:center;justify-content:center;
    ">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
        <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
      </svg>
    </div>`,
    className: '',
    iconSize: [36, 36],
    iconAnchor: [18, 18]
  })
}

function createDestinationIcon(L: typeof import('leaflet')) {
  return L.divIcon({
    html: `<div style="
      width:32px;height:32px;
      background:#EF4444;
      border:3px solid white;
      border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      box-shadow:0 2px 8px rgba(0,0,0,.3);
    "></div>`,
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 32]
  })
}

function createWarehouseIcon(L: typeof import('leaflet')) {
  return L.divIcon({
    html: `<div style="
      width:32px;height:32px;
      background:#F59E0B;
      border:3px solid white;
      border-radius:6px;
      box-shadow:0 2px 8px rgba(0,0,0,.3);
      display:flex;align-items:center;justify-content:center;
    ">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
        <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
      </svg>
    </div>`,
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  })
}

async function initMap() {
  const L = await import('leaflet')

  if (!mapContainer.value) return

  mapInstance = L.map(mapContainer.value, {
    center: props.center,
    zoom: props.zoom,
    zoomControl: true,
    attributionControl: true
  })

  // Tuiles CartoDB Positron
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20
  }).addTo(mapInstance)

  // Marqueur entrepôt
  if (props.warehousePos) {
    L.marker(props.warehousePos, { icon: createWarehouseIcon(L) })
      .addTo(mapInstance)
      .bindPopup('<b>Entrepôt EzTech</b>')
  }

  // Marqueur destination
  if (props.destinationPos) {
    L.marker(props.destinationPos, { icon: createDestinationIcon(L) })
      .addTo(mapInstance)
      .bindPopup('<b>Adresse de livraison</b>')
  }

  // Polyline de route
  if (props.route.length > 1) {
    routePolyline = L.polyline(props.route as LatLngExpression[], {
      color: '#7C3AED',
      weight: 4,
      opacity: 0.8,
      dashArray: '8, 4'
    }).addTo(mapInstance)

    // Marqueur livreur au départ de la route
    riderMarker = L.marker(props.route[0], { icon: createRiderIcon(L) })
      .addTo(mapInstance)
      .bindPopup('<b>Livreur EzTech</b>')

    // Animation du livreur si activée
    if (props.animateRider && props.route.length > 1) {
      let step = 0
      animInterval = setInterval(() => {
        step = (step + 1) % props.route.length
        if (riderMarker && mapInstance) {
          riderMarker.setLatLng(props.route[step] as LatLngExpression)
          mapInstance.panTo(props.route[step] as LatLngExpression, { animate: true, duration: 0.5 })
        }
      }, 2500)
    }
  }
}

onMounted(() => {
  initMap()
})

onUnmounted(() => {
  if (animInterval) clearInterval(animInterval)
  if (mapInstance) mapInstance.remove()
})
</script>

<template>
  <div
    ref="mapContainer"
    :style="{ height: props.height, width: '100%' }"
    class="rounded-xl overflow-hidden shadow-md z-0"
  />
</template>
