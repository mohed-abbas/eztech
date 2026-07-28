<script setup lang="ts">
import 'leaflet/dist/leaflet.css'
import type {
  Map as LeafletMap,
  LayerGroup,
  LeafletMouseEvent,
  Marker,
} from 'leaflet'

definePageMeta({
  layout: 'admin',
  middleware: ['auth', 'role'],
  role: 'admin',
})

useHead({ title: 'Zones de service — Admin EzTech' })

const { adminFetch } = useAdminApi()
const auth = useAuthStore()

// ── Types ─────────────────────────────────────────────────────────────────────
interface PolygonGeometry {
  type: 'Polygon'
  coordinates: number[][][]
}

interface Zone {
  id: string
  name: string
  geometry: PolygonGeometry
  isActive: boolean
  createdAt: string
}

interface Pt { lat: number, lng: number }

// ── State ─────────────────────────────────────────────────────────────────────
const zones = ref<Zone[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const refreshing = ref(false)
const selectedId = ref<string | null>(null)

// Brouillon d'édition : `null` = aucune édition en cours.
//   id === null  → création (mode tracé tant que closed === false)
//   id !== null  → modification d'une zone existante (toujours closed)
interface Draft {
  id: string | null
  name: string
  isActive: boolean
  points: Pt[]
  closed: boolean
}
const draft = ref<Draft | null>(null)

const saving = ref(false)
const saveError = ref<string | null>(null)
const fieldErrors = ref<Record<string, string>>({})
const deactivating = ref<string | null>(null)
const deactivateError = ref<string | null>(null)

const drawing = computed(() => !!draft.value && !draft.value.closed)

// ── Conversions GeoJSON ⇄ Leaflet ─────────────────────────────────────────────
// GeoJSON est [lng, lat], Leaflet est [lat, lng]. Inverser la paire au mauvais
// endroit place Paris dans l'océan Indien et le filtre point-in-polygon du
// checkout (useServiceZone.ts) rejette alors toutes les adresses.

function ringToPoints(geometry: PolygonGeometry | null | undefined): Pt[] {
  const ring = geometry?.coordinates?.[0]
  if (!Array.isArray(ring)) return []
  const pts: Pt[] = []
  for (const pos of ring) {
    const lng = pos?.[0]
    const lat = pos?.[1]
    if (typeof lng !== 'number' || typeof lat !== 'number') continue
    pts.push({ lat, lng })
  }
  // l'anneau stocké est fermé (dernier = premier) : on retire le doublon pour
  // l'affichage, Leaflet referme le polygone tout seul.
  const first = pts[0]
  const last = pts[pts.length - 1]
  if (pts.length > 1 && first && last && first.lat === last.lat && first.lng === last.lng) pts.pop()
  return pts
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6

// CreateZoneSchema (backend/src/schemas/zone.ts) exige un anneau d'au moins
// 4 positions ET fermé (première === dernière), sinon 422 validation_failed.
function pointsToGeometry(points: Pt[]): PolygonGeometry {
  const ring: number[][] = points.map(p => [round6(p.lng), round6(p.lat)])
  const first = ring[0]
  if (first) ring.push([...first])
  return { type: 'Polygon', coordinates: [ring] }
}

function vertexCount(z: Zone): number {
  return ringToPoints(z.geometry).length
}

// deux sommets confondus ne comptent que pour un : un « triangle » dont deux
// points se superposent n'est pas un polygone.
function distinctCount(points: Pt[]): number {
  return new Set(points.map(p => `${round6(p.lat)},${round6(p.lng)}`)).size
}

// ── Erreurs backend → copie française ─────────────────────────────────────────
interface ZodIssue { message?: string, path?: (string | number)[] }

// Le middleware d'erreur du backend renvoie deux enveloppes selon le chemin :
//   HttpError(422, 'validation_failed', { issues }) → { error, details: { issues } }
//   ZodError non capturée                          → { error, issues }
function issuesOf(body: unknown): ZodIssue[] {
  const b = body as { issues?: ZodIssue[], details?: { issues?: ZodIssue[] } } | undefined
  return b?.details?.issues ?? b?.issues ?? []
}

function applyIssues(issues: ZodIssue[]): string | null {
  if (!issues.length) return null
  const next: Record<string, string> = {}
  const parts: string[] = []
  for (const i of issues) {
    const field = String(i.path?.[0] ?? '')
    if (field === 'name') {
      next.name = 'Le nom est obligatoire.'
      parts.push('Nom : valeur invalide.')
    }
    else if (field === 'geometry') {
      next.geometry = i.message?.includes('closed')
        ? 'Le tracé n’est pas fermé. Recommencez le polygone.'
        : 'Le tracé est invalide : il faut au moins 3 sommets distincts.'
      parts.push(`Tracé : ${next.geometry}`)
    }
    else {
      parts.push('Certains champs sont invalides.')
    }
  }
  fieldErrors.value = { ...fieldErrors.value, ...next }
  return [...new Set(parts)].join(' · ')
}

function toFrench(e: unknown, fallback: string): string {
  const apiErr = e as { data?: { error?: string }, statusCode?: number, message?: string }
  const code = apiErr?.data?.error
  if (code === 'validation_failed')
    return applyIssues(issuesOf(apiErr?.data)) ?? 'Certains champs sont invalides.'
  if (code === 'zone_not_found')
    return 'Cette zone n’existe plus. Actualisez la liste.'
  if (code === 'missing_token' || code === 'invalid_token' || apiErr?.statusCode === 401)
    return 'Session expirée : reconnectez-vous.'
  if (code === 'forbidden' || apiErr?.statusCode === 403)
    return 'Action réservée aux administrateurs.'
  if (apiErr?.statusCode && apiErr.statusCode >= 500)
    return 'Le serveur a renvoyé une erreur : la zone n’a pas été enregistrée.'
  return apiErr?.message ?? fallback
}

// ── Chargement ────────────────────────────────────────────────────────────────
// /admin/zones, jamais /zones : en production nginx détourne /api/zones vers le
// BFF Nuxt (frontend/server/api/zones.ts), qui répond une FeatureCollection et
// n'a AUCUN handler d'écriture — un POST /api/zones y répond 200 avec le corps
// de lecture, sans rien écrire, et un PATCH/DELETE y répond 404 Nitro. Vérifié
// en prod le 28/07/2026. /api/admin/zones n'est pas détourné et atteint donc
// toujours Express (voir backend/src/routes/index.ts, même raison que
// /admin/orders dans app/pages/admin/index.vue).
const LIST_PATH = '/admin/zones'

const SHAPE_ERROR = 'Réponse inattendue de l’API : « zones » manquant.'

async function load(silent = false) {
  auth.hydrate()
  if (silent) refreshing.value = true
  else {
    loading.value = true
    error.value = null
  }
  try {
    const data = await adminFetch<{ zones: Zone[] }>(LIST_PATH)
    // Un tableau nu / une FeatureCollection (réponse du BFF) ne doit jamais
    // passer pour « aucune zone ».
    if (!Array.isArray(data?.zones)) throw new Error(SHAPE_ERROR)
    zones.value = data.zones
    error.value = null
  }
  catch (e) {
    if (!silent) {
      zones.value = []
      error.value = e instanceof Error && e.message === SHAPE_ERROR
        ? SHAPE_ERROR
        : toFrench(e, 'Impossible de charger les zones de service.')
    }
  }
  finally {
    loading.value = false
    refreshing.value = false
  }
}

// ── Leaflet ───────────────────────────────────────────────────────────────────
// Instances Leaflet volontairement hors du système réactif de Vue : les envelopper
// dans un ref() ferait proxifier tout l'arbre interne de la carte.
const mapContainer = useTemplateRef<HTMLElement>('mapContainer')
let leaflet: typeof import('leaflet') | null = null
let mapInstance: LeafletMap | null = null
let zonesLayer: LayerGroup | null = null
let draftLayer: LayerGroup | null = null
let vertexLayer: LayerGroup | null = null
const mapReady = ref(false)

const PARIS: [number, number] = [48.8566, 2.3522]

const STYLE_ZONE = { color: '#7C3AED', fillColor: '#7C3AED', fillOpacity: 0.1, weight: 2 }
const STYLE_ZONE_SELECTED = { color: '#6D28D9', fillColor: '#7C3AED', fillOpacity: 0.22, weight: 4 }
const STYLE_ZONE_INACTIVE = { color: '#94A3B8', fillColor: '#94A3B8', fillOpacity: 0.06, weight: 2, dashArray: '5 5' }
const STYLE_DRAFT = { color: '#F59E0B', fillColor: '#F59E0B', fillOpacity: 0.18, weight: 3 }

function vertexIcon(L: typeof import('leaflet'), draggable: boolean) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:14px;height:14px;border-radius:50%;
      background:#F59E0B;border:3px solid white;
      box-shadow:0 1px 4px rgba(0,0,0,.35);
      cursor:${draggable ? 'move' : 'default'};
    "></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  })
}

async function initMap() {
  const L = await import('leaflet')
  leaflet = L
  if (!mapContainer.value) return

  mapInstance = L.map(mapContainer.value, {
    center: PARIS,
    zoom: 12,
    zoomControl: false,
    attributionControl: true,
  })
  L.control.zoom({ position: 'bottomright' }).addTo(mapInstance)

  // mêmes tuiles que LeafletMap.client.vue (CartoDB Positron)
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OSM</a> © <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20,
  }).addTo(mapInstance)

  zonesLayer = L.layerGroup().addTo(mapInstance)
  draftLayer = L.layerGroup().addTo(mapInstance)
  vertexLayer = L.layerGroup().addTo(mapInstance)

  mapInstance.on('click', onMapClick)
  mapReady.value = true

  drawZones()
  drawDraftShape()
  drawVertices()
}

function onMapClick(e: LeafletMouseEvent) {
  const d = draft.value
  if (!d || d.closed) return
  d.points.push({ lat: e.latlng.lat, lng: e.latlng.lng })
  fieldErrors.value = { ...fieldErrors.value, geometry: '' }
}

// ── Rendu des couches ─────────────────────────────────────────────────────────
// Trois couches distinctes pour que le glissement d'un sommet ne recrée pas le
// marqueur qu'on est en train de déplacer (voir drawVertices).

function drawZones() {
  const L = leaflet
  if (!L || !zonesLayer) return
  zonesLayer.clearLayers()
  for (const z of zones.value) {
    // la zone en cours d'édition est rendue par la couche brouillon
    if (draft.value?.id === z.id) continue
    const pts = ringToPoints(z.geometry)
    if (pts.length < 3) continue
    const style = !z.isActive
      ? STYLE_ZONE_INACTIVE
      : z.id === selectedId.value ? STYLE_ZONE_SELECTED : STYLE_ZONE
    const poly = L.polygon(pts.map(p => [p.lat, p.lng] as [number, number]), style)
    poly.bindTooltip(z.name, { sticky: true })
    poly.on('click', () => {
      if (drawing.value) return
      selectedId.value = z.id
    })
    poly.addTo(zonesLayer)
  }
}

function drawDraftShape() {
  const L = leaflet
  if (!L || !draftLayer) return
  draftLayer.clearLayers()
  const d = draft.value
  if (!d) return
  const latlngs = d.points.map(p => [p.lat, p.lng] as [number, number])
  if (d.closed) {
    if (latlngs.length >= 3) L.polygon(latlngs, STYLE_DRAFT).addTo(draftLayer)
  }
  else if (latlngs.length >= 2) {
    // aperçu du tracé en cours : polyline ouverte
    L.polyline(latlngs, { color: STYLE_DRAFT.color, weight: 3, dashArray: '6 6' }).addTo(draftLayer)
  }
}

function drawVertices() {
  const L = leaflet
  if (!L || !vertexLayer) return
  vertexLayer.clearLayers()
  const d = draft.value
  if (!d) return
  d.points.forEach((p, index) => {
    const marker: Marker = L.marker([p.lat, p.lng], {
      icon: vertexIcon(L, d.closed),
      draggable: d.closed,
      keyboard: false,
    })
    if (d.closed) {
      marker.on('dragend', () => {
        const ll = marker.getLatLng()
        const cur = draft.value
        if (!cur) return
        // on remplace la position sans toucher au nombre de sommets : le watch
        // qui redessine les marqueurs ne se déclenche donc pas et le marqueur
        // manipulé n'est pas détruit sous le curseur.
        cur.points.splice(index, 1, { lat: ll.lat, lng: ll.lng })
      })
    }
    marker.addTo(vertexLayer!)
  })
}

// La forme se redessine à chaque changement de sommet ; les marqueurs seulement
// quand leur NOMBRE change (ou quand on change de brouillon), pour ne pas
// recréer le marqueur en cours de glissement.
watch(
  () => draft.value?.points.map(p => `${p.lat},${p.lng}`).join('|'),
  () => drawDraftShape(),
)
watch(
  () => [draft.value?.id ?? 'none', draft.value?.points.length ?? -1, draft.value?.closed ?? false].join(':'),
  () => {
    drawVertices()
    drawZones()
  },
)
watch(zones, () => drawZones(), { deep: true })
watch(selectedId, () => drawZones())

onMounted(async () => {
  auth.hydrate()
  await load()
  await nextTick()
  await initMap()
})

onBeforeUnmount(() => {
  if (mapInstance) {
    mapInstance.off('click', onMapClick)
    mapInstance.remove()
    mapInstance = null
  }
})

// ── Actions du brouillon ──────────────────────────────────────────────────────
function resetDraftErrors() {
  saveError.value = null
  fieldErrors.value = {}
}

function startCreate() {
  resetDraftErrors()
  selectedId.value = null
  draft.value = { id: null, name: '', isActive: true, points: [], closed: false }
}

function startEdit(z: Zone) {
  resetDraftErrors()
  selectedId.value = z.id
  draft.value = {
    id: z.id,
    name: z.name,
    isActive: z.isActive,
    points: ringToPoints(z.geometry),
    closed: true,
  }
  fitDraft()
}

function cancelDraft() {
  draft.value = null
  resetDraftErrors()
}

function undoPoint() {
  const d = draft.value
  if (!d || d.closed) return
  d.points.pop()
}

function closeRing() {
  const d = draft.value
  if (!d || d.closed) return
  if (distinctCount(d.points) < 3) {
    fieldErrors.value = { ...fieldErrors.value, geometry: 'Il faut au moins 3 sommets distincts pour fermer un polygone.' }
    return
  }
  d.closed = true
  fieldErrors.value = { ...fieldErrors.value, geometry: '' }
}

function fitDraft() {
  const L = leaflet
  const d = draft.value
  if (!L || !mapInstance || !d || d.points.length < 2) return
  mapInstance.fitBounds(L.latLngBounds(d.points.map(p => [p.lat, p.lng] as [number, number])), { padding: [40, 40] })
}

function focusZone(z: Zone) {
  const L = leaflet
  const pts = ringToPoints(z.geometry)
  selectedId.value = z.id
  if (!L || !mapInstance || pts.length < 2) return
  mapInstance.fitBounds(L.latLngBounds(pts.map(p => [p.lat, p.lng] as [number, number])), { padding: [40, 40] })
}

// ── Validation locale ─────────────────────────────────────────────────────────
const draftErrors = computed<Record<string, string>>(() => {
  const d = draft.value
  const e: Record<string, string> = {}
  if (!d) return e
  if (!d.name.trim()) e.name = 'Le nom est obligatoire.'
  if (distinctCount(d.points) < 3) e.geometry = 'Il faut au moins 3 sommets distincts.'
  else if (!d.closed) e.geometry = 'Terminez le tracé avant d’enregistrer.'
  return e
})

const canSave = computed(() => Object.keys(draftErrors.value).length === 0)

function err(field: 'name' | 'geometry'): string | undefined {
  return fieldErrors.value[field] || draftErrors.value[field] || undefined
}

// ── Enregistrement ────────────────────────────────────────────────────────────
async function save() {
  const d = draft.value
  if (!d || !canSave.value) {
    fieldErrors.value = { ...fieldErrors.value, ...draftErrors.value }
    return
  }
  saving.value = true
  saveError.value = null
  fieldErrors.value = {}
  try {
    const body = {
      name: d.name.trim(),
      geometry: pointsToGeometry(d.points),
      isActive: d.isActive,
    }
    if (d.id) {
      await adminFetch<{ zone: Zone }>(`${LIST_PATH}/${d.id}`, { method: 'PATCH', body })
    }
    else {
      await adminFetch<{ zone: Zone }>(LIST_PATH, { method: 'POST', body })
    }
    // On ne recopie JAMAIS le brouillon dans la liste : on relit l'API, seule
    // preuve que l'écriture a bien atteint la base.
    draft.value = null
    await load(true)
  }
  catch (e) {
    saveError.value = toFrench(e, 'Impossible d’enregistrer la zone.')
  }
  finally {
    saving.value = false
  }
}

// ── Désactivation (DELETE = soft-delete côté backend) ─────────────────────────
// backend/src/routes/zones.ts : DELETE fait `update({ data: { isActive: false } })`
// et GET filtre `where: { isActive: true }`. Une zone désactivée disparaît donc
// de la liste et ne peut PAS être réactivée depuis cette page — le bouton est
// libellé « Désactiver » et la confirmation le dit explicitement.
async function deactivate(z: Zone) {
  if (!confirm(
    `Désactiver la zone « ${z.name} » ?\n\n`
    + 'Elle ne sera plus proposée à la commande et disparaîtra de cette liste. '
    + 'L’API ne renvoie que les zones actives : cette action n’est pas réversible depuis l’interface.',
  )) return
  deactivating.value = z.id
  deactivateError.value = null
  try {
    await adminFetch(`${LIST_PATH}/${z.id}`, { method: 'DELETE' })
    if (draft.value?.id === z.id) draft.value = null
    if (selectedId.value === z.id) selectedId.value = null
    await load(true)
  }
  catch (e) {
    deactivateError.value = toFrench(e, 'Impossible de désactiver cette zone.')
    await load(true)
  }
  finally {
    deactivating.value = null
  }
}

const selectedZone = computed(() => zones.value.find(z => z.id === selectedId.value) ?? null)
</script>

<template>
  <div>
    <!-- ═══ En-tête ═══ -->
    <div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-h2 font-semibold text-text-primary">
          Zones de service
        </h1>
        <p class="mt-1 text-body-sm text-text-muted">
          {{ zones.length }} zone{{ zones.length !== 1 ? 's' : '' }} active{{ zones.length !== 1 ? 's' : '' }} —
          ce sont les polygones que le checkout utilise pour accepter ou refuser une adresse.
        </p>
      </div>
      <div class="flex items-center gap-2">
        <button
          type="button"
          :disabled="loading || refreshing"
          title="Recharger les zones depuis l’API"
          class="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-4 py-2.5 text-body-sm font-medium text-text-secondary transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          @click="load()"
        >
          <Icon name="ph:arrows-clockwise" class="size-4" :class="refreshing && 'animate-spin'" />
          Actualiser
        </button>
        <button
          type="button"
          :disabled="loading || !!draft"
          class="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-body-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          @click="startCreate"
        >
          <Icon name="ph:plus" class="size-4" />
          Nouvelle zone
        </button>
      </div>
    </div>

    <!-- ═══ Erreur de chargement ═══ -->
    <div
      v-if="error"
      role="alert"
      class="mb-6 flex flex-col gap-3 rounded-2xl border border-error/30 bg-error/5 p-6 sm:flex-row sm:items-center sm:justify-between"
    >
      <div class="flex items-start gap-3">
        <Icon name="ph:warning-circle" class="mt-0.5 size-5 shrink-0 text-error" />
        <div>
          <p class="text-body-sm font-semibold text-text-primary">
            Zones indisponibles
          </p>
          <p class="text-body-sm text-text-muted">
            {{ error }}
          </p>
        </div>
      </div>
      <button
        type="button"
        class="shrink-0 rounded-xl border border-border bg-white px-4 py-2 text-body-sm font-medium text-text-secondary transition hover:bg-neutral-50 outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
        @click="load()"
      >
        Réessayer
      </button>
    </div>

    <div class="grid gap-6 lg:grid-cols-[24rem_minmax(0,1fr)]">
      <!-- ═══ Panneau latéral ═══ -->
      <div class="flex flex-col gap-4">
        <!-- Formulaire brouillon -->
        <div
          v-if="draft"
          class="rounded-2xl border border-border bg-white p-5"
        >
          <h2 class="mb-4 text-body font-semibold text-text-primary">
            {{ draft.id ? 'Modifier la zone' : 'Nouvelle zone' }}
          </h2>

          <!-- Étape 1 : tracé -->
          <div
            v-if="!draft.closed"
            class="mb-4 rounded-xl bg-primary-50 p-4"
          >
            <p class="text-body-sm font-medium text-primary-700">
              Mode tracé actif
            </p>
            <p class="mt-1 text-caption text-text-muted">
              Cliquez sur la carte pour poser chaque sommet du polygone, puis terminez le tracé.
            </p>
            <p class="mt-2 text-caption font-medium text-text-secondary">
              {{ draft.points.length }} sommet{{ draft.points.length !== 1 ? 's' : '' }} posé{{ draft.points.length !== 1 ? 's' : '' }}
            </p>
            <div class="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                :disabled="draft.points.length < 3"
                class="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-caption font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                @click="closeRing"
              >
                <Icon name="ph:check" class="size-3.5" />
                Terminer le tracé
              </button>
              <button
                type="button"
                :disabled="!draft.points.length"
                class="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2 text-caption font-medium text-text-secondary transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                @click="undoPoint"
              >
                <Icon name="ph:arrow-u-up-left" class="size-3.5" />
                Annuler le dernier point
              </button>
            </div>
          </div>

          <!-- Étape 2 : nom / état -->
          <div v-else class="mb-4 rounded-xl bg-neutral-50 p-4">
            <p class="text-body-sm font-medium text-text-primary">
              Tracé fermé — {{ draft.points.length }} sommets
            </p>
            <p class="mt-1 text-caption text-text-muted">
              Faites glisser les points orange sur la carte pour ajuster la forme.
            </p>
          </div>

          <div class="flex flex-col gap-4">
            <FormField
              id="zone-name"
              label="Nom de la zone"
              required
              :error="err('name')"
              hint="Affiché au client dans le badge de zone au checkout."
            >
              <input
                id="zone-name"
                v-model="draft.name"
                type="text"
                placeholder="Paris Centre"
                class="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-body-sm text-text-primary outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                :aria-invalid="!!err('name')"
                :aria-describedby="err('name') ? 'zone-name-error' : undefined"
              >
            </FormField>

            <label class="flex items-start gap-3">
              <input
                v-model="draft.isActive"
                type="checkbox"
                class="mt-0.5 size-4 rounded border-border text-primary-600 focus:ring-primary-500"
              >
              <span>
                <span class="block text-body-sm font-medium text-text-primary">Zone active</span>
                <span class="block text-caption text-text-muted">
                  Décocher revient à désactiver la zone : elle disparaîtra de cette liste
                  (l’API ne renvoie que les zones actives) et ne pourra pas être réactivée ici.
                </span>
              </span>
            </label>

            <p v-if="err('geometry')" role="alert" class="text-caption text-error">
              {{ err('geometry') }}
            </p>

            <p v-if="saveError" role="alert" class="rounded-xl bg-error/5 p-3 text-caption text-error">
              {{ saveError }}
            </p>

            <div class="flex gap-2">
              <button
                type="button"
                :disabled="saving || !canSave"
                :title="canSave ? undefined : Object.values(draftErrors).join(' ')"
                class="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-body-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                @click="save"
              >
                <Icon v-if="saving" name="ph:spinner" class="size-4 animate-spin" />
                {{ saving ? 'Enregistrement…' : 'Enregistrer' }}
              </button>
              <button
                type="button"
                :disabled="saving"
                class="rounded-xl border border-border bg-white px-4 py-2.5 text-body-sm font-medium text-text-secondary transition hover:bg-neutral-50 disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                @click="cancelDraft"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>

        <!-- Liste des zones -->
        <div class="rounded-2xl border border-border bg-white">
          <div class="flex items-center justify-between border-b border-border px-5 py-3">
            <h2 class="text-body-sm font-semibold text-text-primary">
              Zones enregistrées
            </h2>
            <Icon v-if="refreshing" name="ph:spinner" class="size-4 animate-spin text-text-muted" />
          </div>

          <!-- Chargement -->
          <div v-if="loading" class="space-y-3 p-5">
            <div v-for="i in 3" :key="i" class="animate-pulse">
              <div class="h-4 w-1/2 rounded bg-neutral-200" />
              <div class="mt-2 h-3 w-1/3 rounded bg-neutral-100" />
            </div>
          </div>

          <!-- Vide -->
          <div v-else-if="!zones.length && !error" class="p-5">
            <EmptyState
              title="Aucune zone de service"
              description="Sans zone active, le checkout refuse toutes les adresses. Tracez un premier polygone."
            >
              <template #icon>
                <Icon name="ph:map-trifold" class="size-8 text-primary-600" />
              </template>
              <template #actions>
                <button
                  type="button"
                  class="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-body-sm font-semibold text-white transition hover:bg-primary-700 outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                  @click="startCreate"
                >
                  <Icon name="ph:plus" class="size-4" />
                  Nouvelle zone
                </button>
              </template>
            </EmptyState>
          </div>

          <!-- Liste -->
          <ul v-else class="divide-y divide-border">
            <li
              v-for="z in zones"
              :key="z.id"
              class="px-5 py-4 transition"
              :class="z.id === selectedId ? 'bg-primary-50/60' : 'hover:bg-neutral-50'"
            >
              <div class="flex items-start justify-between gap-3">
                <button
                  type="button"
                  class="min-w-0 flex-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                  @click="focusZone(z)"
                >
                  <span class="block truncate text-body-sm font-semibold text-text-primary">
                    {{ z.name }}
                  </span>
                  <span class="mt-0.5 block text-caption text-text-muted">
                    {{ vertexCount(z) }} sommet{{ vertexCount(z) !== 1 ? 's' : '' }}
                  </span>
                </button>
                <span
                  class="shrink-0 rounded-full px-2 py-0.5 text-caption font-medium"
                  :class="z.isActive ? 'bg-success/10 text-success' : 'bg-neutral-100 text-text-muted'"
                >
                  {{ z.isActive ? 'Active' : 'Inactive' }}
                </span>
              </div>
              <div class="mt-3 flex gap-2">
                <button
                  type="button"
                  :disabled="!!draft || !mapReady"
                  class="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-caption font-medium text-text-secondary transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                  @click="startEdit(z)"
                >
                  <Icon name="ph:pencil-simple" class="size-3.5" />
                  Modifier
                </button>
                <button
                  type="button"
                  :disabled="deactivating === z.id || !!draft"
                  class="inline-flex items-center gap-1.5 rounded-lg border border-error/30 bg-white px-3 py-1.5 text-caption font-medium text-error transition hover:bg-error/5 disabled:cursor-not-allowed disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                  @click="deactivate(z)"
                >
                  <Icon
                    :name="deactivating === z.id ? 'ph:spinner' : 'ph:prohibit'"
                    class="size-3.5"
                    :class="deactivating === z.id && 'animate-spin'"
                  />
                  Désactiver
                </button>
              </div>
            </li>
          </ul>

          <p v-if="deactivateError" role="alert" class="border-t border-border px-5 py-3 text-caption text-error">
            {{ deactivateError }}
          </p>
        </div>

        <p class="text-caption text-text-muted">
          La suppression est un « soft delete » côté API : une zone désactivée reste en base pour
          les commandes historiques, mais n’apparaît plus ici et ne peut pas être réactivée depuis
          cette page.
        </p>
      </div>

      <!-- ═══ Carte ═══ -->
      <div class="relative overflow-hidden rounded-2xl border border-border bg-white">
        <div
          ref="mapContainer"
          class="z-0 h-[32rem] w-full lg:h-[calc(100vh-13rem)]"
          :class="drawing && 'cursor-crosshair'"
        />

        <!-- Bandeau mode tracé -->
        <div
          v-if="drawing"
          class="pointer-events-none absolute inset-x-3 top-3 z-[500] rounded-xl bg-warning/95 px-4 py-2.5 text-center text-body-sm font-medium text-white shadow-lg"
        >
          Cliquez sur la carte pour ajouter un sommet ({{ draft?.points.length ?? 0 }})
        </div>

        <!-- Détail de la zone sélectionnée -->
        <div
          v-else-if="selectedZone && !draft"
          class="absolute bottom-3 left-3 z-[500] rounded-xl border border-border bg-white/95 px-4 py-2.5 shadow-lg backdrop-blur-sm"
        >
          <p class="text-body-sm font-semibold text-text-primary">
            {{ selectedZone.name }}
          </p>
          <p class="text-caption text-text-muted">
            {{ vertexCount(selectedZone) }} sommets · {{ selectedZone.isActive ? 'active' : 'inactive' }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
