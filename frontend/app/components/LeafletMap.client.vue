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
  autoCenter?: boolean      // recentre la carte sur le livreur à chaque déplacement
  height?: string
  initialEta?: number       // ETA initial en secondes
}

const props = withDefaults(defineProps<Props>(), {
  center: () => [48.8566, 2.3522],
  zoom: 13,
  route: () => [],
  animateRider: false,
  autoCenter: true,
  height: '400px',
  initialEta: 0,
})

const emit = defineEmits<{
  'rider-moved': [pos: [number, number], stepIndex: number]
  'delivery-complete': []
}>()

const mapContainer = ref<HTMLElement | null>(null)
let mapInstance: Map | null = null
let riderMarker: Marker | null = null
let animInterval: ReturnType<typeof setInterval> | null = null

// ETA countdown
const etaSeconds = ref(props.initialEta)
let etaInterval: ReturnType<typeof setInterval> | null = null

const etaDisplay = computed(() => {
  const m = Math.floor(etaSeconds.value / 60)
  const s = etaSeconds.value % 60
  if (m === 0) return `${s}s`
  return `${m} min`
})

// ─── Marqueur livreur : cercle violet avec icône véhicule ───────────
function createRiderIcon(L: typeof import('leaflet')) {
  return L.divIcon({
    html: `
      <div style="position:relative;width:46px;height:46px;">
        <!-- Halo pulsant -->
        <div style="
          position:absolute;inset:-6px;
          border-radius:50%;
          background:rgba(124,58,237,.18);
          animation:riderPulse 2s ease-in-out infinite;
        "></div>
        <!-- Corps principal -->
        <div style="
          position:absolute;inset:0;
          background:linear-gradient(135deg,#7C3AED,#6D28D9);
          border:3px solid white;
          border-radius:50%;
          box-shadow:0 4px 16px rgba(124,58,237,.45);
          display:flex;align-items:center;justify-content:center;
        ">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
            <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
          </svg>
        </div>
        <!-- Indicateur statut (vert) -->
        <div style="
          position:absolute;bottom:1px;right:1px;
          width:10px;height:10px;
          background:#10B981;border:2px solid white;
          border-radius:50%;
        "></div>
      </div>
    `,
    className: '',
    iconSize: [46, 46],
    iconAnchor: [23, 23],
    popupAnchor: [0, -25],
  })
}

// ─── Marqueur destination : pin rouge avec étiquette ───────────────
function createDestinationIcon(L: typeof import('leaflet')) {
  return L.divIcon({
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;gap:0;">
        <div style="
          background:white;
          border:1.5px solid #FCA5A5;
          border-radius:6px;
          padding:3px 7px;
          font-size:10px;
          font-weight:700;
          color:#EF4444;
          white-space:nowrap;
          box-shadow:0 2px 8px rgba(0,0,0,.12);
          margin-bottom:3px;
          font-family:system-ui,sans-serif;
        ">📦 Destination</div>
        <div style="
          width:14px;height:14px;
          background:#EF4444;
          border:2px solid white;
          border-radius:50% 50% 50% 0;
          transform:rotate(-45deg);
          box-shadow:0 2px 8px rgba(239,68,68,.4);
        "></div>
      </div>
    `,
    className: '',
    iconSize: [80, 46],
    iconAnchor: [40, 46],
    popupAnchor: [0, -50],
  })
}

// ─── Marqueur entrepôt : box amber ─────────────────────────────────
function createWarehouseIcon(L: typeof import('leaflet')) {
  return L.divIcon({
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;gap:0;">
        <div style="
          background:white;
          border:1.5px solid #FDE68A;
          border-radius:6px;
          padding:3px 7px;
          font-size:10px;
          font-weight:700;
          color:#D97706;
          white-space:nowrap;
          box-shadow:0 2px 8px rgba(0,0,0,.12);
          margin-bottom:3px;
          font-family:system-ui,sans-serif;
        ">🏭 Entrepôt</div>
        <div style="
          width:34px;height:34px;
          background:linear-gradient(135deg,#F59E0B,#D97706);
          border:3px solid white;
          border-radius:8px;
          box-shadow:0 3px 12px rgba(245,158,11,.35);
          display:flex;align-items:center;justify-content:center;
        ">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
            <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4z"/>
          </svg>
        </div>
      </div>
    `,
    className: '',
    iconSize: [80, 56],
    iconAnchor: [40, 56],
    popupAnchor: [0, -60],
  })
}

async function initMap() {
  const L = await import('leaflet')
  if (!mapContainer.value) return

  mapInstance = L.map(mapContainer.value, {
    center: props.center,
    zoom: props.zoom,
    zoomControl: false,
    attributionControl: true,
  })

  // Zoom controls en bas à droite
  L.control.zoom({ position: 'bottomright' }).addTo(mapInstance)

  // Tuiles CartoDB Positron (carte grise épurée)
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OSM</a> © <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20,
  }).addTo(mapInstance)

  // Marqueur entrepôt
  if (props.warehousePos) {
    L.marker(props.warehousePos, { icon: createWarehouseIcon(L) })
      .addTo(mapInstance)
      .bindPopup('<strong>Entrepôt EzTech</strong><br>Point de départ')
  }

  // Marqueur destination
  if (props.destinationPos) {
    L.marker(props.destinationPos, { icon: createDestinationIcon(L) })
      .addTo(mapInstance)
      .bindPopup('<strong>Adresse de livraison</strong>')
  }

  // Polyline de route (partie "restante" en violet)
  if (props.route.length > 1) {
    // Ombre de la route complète (gris clair)
    L.polyline(props.route as LatLngExpression[], {
      color: '#E5E7EB',
      weight: 6,
      opacity: 1,
    }).addTo(mapInstance)

    // Route violette en pointillés par-dessus
    L.polyline(props.route as LatLngExpression[], {
      color: '#7C3AED',
      weight: 4,
      opacity: 0.9,
      dashArray: '10, 6',
    }).addTo(mapInstance)

    // Marqueur livreur au départ (positionné mais immobile)
    riderMarker = L.marker(props.route[0]!, { icon: createRiderIcon(L) })
      .addTo(mapInstance)
      .bindPopup('<strong>Livreur EzTech</strong><br>En route vers vous ⚡')
  }
}

// Démarre l'animation du livreur — appelé depuis le parent quand l'étape "En route" est atteinte
function startAnimation() {
  if (!props.animateRider || props.route.length < 2) return
  if (animInterval) return // déjà en cours

  let stepIdx = 0

  // ETA countdown
  if (props.initialEta > 0) {
    const perStep = Math.floor(props.initialEta / props.route.length)
    etaInterval = setInterval(() => {
      etaSeconds.value = Math.max(0, etaSeconds.value - perStep)
    }, 2500)
  }

  animInterval = setInterval(async () => {
    stepIdx = (stepIdx + 1) % props.route.length
    const newPos = props.route[stepIdx] as LatLngExpression

    if (riderMarker) {
      riderMarker.setLatLng(newPos)
    }

    if (mapInstance) {
      if (props.autoCenter) {
        mapInstance.flyTo(newPos, mapInstance.getZoom(), {
          animate: true,
          duration: 0.8,
        })
      } else {
        mapInstance.panTo(newPos, { animate: true, duration: 0.5 })
      }
    }

    emit('rider-moved', props.route[stepIdx]!, stepIdx)

    if (stepIdx === props.route.length - 1) {
      emit('delivery-complete')
      if (animInterval) clearInterval(animInterval)
      if (etaInterval) {
        clearInterval(etaInterval)
        etaSeconds.value = 0
      }
    }
  }, 2500)
}

defineExpose({ startAnimation })

onMounted(initMap)

onUnmounted(() => {
  if (animInterval) clearInterval(animInterval)
  if (etaInterval) clearInterval(etaInterval)
  if (mapInstance) mapInstance.remove()
})
</script>

<template>
  <div class="relative w-full" :style="{ height: props.height }">
    <!-- Carte -->
    <div ref="mapContainer" class="w-full h-full rounded-xl overflow-hidden z-0" />

    <!-- Badge ETA superposé (si ETA actif) -->
    <div
      v-if="props.initialEta > 0"
      class="absolute top-3 left-3 z-[400] pointer-events-none"
    >
      <div class="flex items-center gap-2 rounded-xl bg-white/95 backdrop-blur-sm border border-neutral-200 px-3 py-2 shadow-md">
        <span class="w-2 h-2 rounded-full bg-success animate-pulse" />
        <span class="text-[11px] font-semibold text-text-muted uppercase tracking-wide">ETA</span>
        <span class="text-sm font-bold text-text-primary tabular-nums">{{ etaDisplay }}</span>
      </div>
    </div>

    <!-- Légende -->
    <div class="absolute bottom-3 left-3 z-[400] pointer-events-none">
      <div class="flex items-center gap-2 rounded-lg bg-white/90 backdrop-blur-sm border border-neutral-100 px-2.5 py-1.5 shadow-sm">
        <span class="w-2.5 h-2.5 rounded-full bg-primary-600 inline-block" />
        <span class="text-[10px] text-text-muted">Livreur</span>
        <span class="text-neutral-200 mx-0.5">·</span>
        <span class="w-2.5 h-2.5 rounded-full bg-warning inline-block" />
        <span class="text-[10px] text-text-muted">Entrepôt</span>
        <span class="text-neutral-200 mx-0.5">·</span>
        <span class="w-2.5 h-2.5 rounded-full bg-error inline-block" />
        <span class="text-[10px] text-text-muted">Destination</span>
      </div>
    </div>
  </div>
</template>

<style>
@keyframes riderPulse {
  0%, 100% { transform: scale(1); opacity: 0.6; }
  50%       { transform: scale(1.3); opacity: 0.2; }
}
</style>