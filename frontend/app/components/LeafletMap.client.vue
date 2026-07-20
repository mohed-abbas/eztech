<script setup lang="ts">
import 'leaflet/dist/leaflet.css'
import type { Map, Marker, LatLng } from 'leaflet'

interface RiderPos {
  lat: number
  lng: number
}

interface Props {
  center?: [number, number]
  zoom?: number
  warehousePos?: [number, number]
  destinationPos?: [number, number]
  // live rider position pushed from useOrderTracking (rider-moved {lat,lng}) — D-06/D-12/TRACK-06
  riderPos?: RiderPos | null
  autoCenter?: boolean      // recentre la carte sur le livreur à chaque déplacement
  height?: string
  delivered?: boolean       // état final figé : marqueur vert (check), pas de halo
}

const props = withDefaults(defineProps<Props>(), {
  center: () => [48.8566, 2.3522],
  zoom: 13,
  riderPos: null,
  autoCenter: true,
  height: '400px',
  delivered: false,
})

const mapContainer = ref<HTMLElement | null>(null)
let mapInstance: Map | null = null
let riderMarker: Marker | null = null
let leaflet: typeof import('leaflet') | null = null

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

// ─── Marqueur livraison terminée : cercle vert figé avec check ─────
function createDeliveredIcon(L: typeof import('leaflet')) {
  return L.divIcon({
    html: `
      <div style="
        width:46px;height:46px;
        background:linear-gradient(135deg,#10B981,#059669);
        border:3px solid white;
        border-radius:50%;
        box-shadow:0 4px 16px rgba(16,185,129,.45);
        display:flex;align-items:center;justify-content:center;
      ">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
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
  leaflet = L
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

  // Marqueur livreur — placé immédiatement si une dernière position connue est disponible
  // (last-known au chargement, D-05). Sinon il est créé au premier rider-moved.
  if (props.riderPos) {
    placeRider(props.riderPos)
  }
}

// ─── Glide du marqueur livreur vers une position live ───────────────────────
// Interpole la position courante vers la nouvelle via requestAnimationFrame pour
// éviter le « téléport » entre deux fixes GPS (D-06/TRACK-06). Coordonnées TOUJOURS
// nommées via L.latLng(lat,lng) — jamais un tableau [lat,lng] (D-12/Pitfall D).
let glideFrame: number | null = null

function placeRider(pos: RiderPos) {
  if (!leaflet || !mapInstance) return
  const L = leaflet
  const target = L.latLng(pos.lat, pos.lng)

  if (!riderMarker) {
    const icon = props.delivered ? createDeliveredIcon(L) : createRiderIcon(L)
    const popup = props.delivered
      ? '<strong>Livraison terminée</strong><br>Commande livrée ✓'
      : '<strong>Livreur EzTech</strong><br>En route vers vous ⚡'
    riderMarker = L.marker(target, { icon })
      .addTo(mapInstance)
      .bindPopup(popup)
    recenter(target)
    return
  }

  // glide depuis la position actuelle vers la cible
  if (glideFrame !== null) cancelAnimationFrame(glideFrame)
  const start = riderMarker.getLatLng()
  const startAt = performance.now()
  const DURATION = 900 // ms — assez doux pour des fixes de 3–5s

  const step = (now: number) => {
    const k = Math.min(1, (now - startAt) / DURATION)
    const lat = start.lat + (target.lat - start.lat) * k
    const lng = start.lng + (target.lng - start.lng) * k
    riderMarker?.setLatLng(L.latLng(lat, lng))
    if (k < 1) {
      glideFrame = requestAnimationFrame(step)
    } else {
      glideFrame = null
      recenter(target)
    }
  }
  glideFrame = requestAnimationFrame(step)
}

function recenter(target: LatLng) {
  if (!mapInstance) return
  if (props.autoCenter) {
    mapInstance.panTo(target, { animate: true, duration: 0.5 })
  }
}

// Drive the marker from the reactive live position pushed by the parent
watch(() => props.riderPos, (pos) => {
  if (pos) placeRider(pos)
})

onMounted(initMap)

onUnmounted(() => {
  if (glideFrame !== null) cancelAnimationFrame(glideFrame)
  if (mapInstance) mapInstance.remove()
})
</script>

<template>
  <div class="relative w-full" :style="{ height: props.height }">
    <!-- Carte -->
    <div ref="mapContainer" class="w-full h-full rounded-xl overflow-hidden z-0" />

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