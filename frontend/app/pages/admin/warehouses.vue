<script setup lang="ts">
definePageMeta({
  layout: 'admin',
  middleware: ['auth', 'role'],
  role: 'admin',
})

useHead({ title: 'Entrepôts — Admin EzTech' })

// adminFetch préfixe config.public.apiUrl → toujours Express (jamais le BFF Nuxt).
// /api/warehouses, /api/inventory et /api/users n'ont aucun handler côté Nuxt :
// nginx ne peut donc pas les détourner vers le BFF en production.
const { adminFetch } = useAdminApi()
const auth = useAuthStore()

// ── Types ─────────────────────────────────────────────────────────────────────
interface Manager {
  id: string
  name: string
  email: string
}

interface Warehouse {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  serviceRadius: number
  openTime: string
  closeTime: string
  isActive: boolean
  managerId: string | null
  manager?: Manager | null
}

interface StockLine {
  id: string
  productId: string
  quantity: number
  product: {
    id: string
    name: string
    slug: string
    imageUrl: string | null
    category?: { name: string } | null
  }
}

// ── État ──────────────────────────────────────────────────────────────────────
const warehouses = ref<Warehouse[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const searchQuery = ref('')

// Candidats responsables : uniquement les warehouse_manager. Le backend ne
// vérifie PAS le rôle du managerId (schemas/warehouse.ts:26 = z.string()), donc
// assigner un client créerait un entrepôt dont le « responsable » ne pourrait
// jamais l'ouvrir (lib/warehouseAccess.ts:14). Le filtre est donc obligatoire ici.
const managers = ref<Manager[]>([])
const managersError = ref<string | null>(null)

const showModal = ref(false)
const editing = ref<Warehouse | null>(null)
const saving = ref(false)
const saveError = ref<string | null>(null)

const toggling = ref<string | null>(null)
const toggleError = ref<string | null>(null)

// Panneau stock
const selectedId = ref<string | null>(null)
const stock = ref<StockLine[]>([])
const stockLoading = ref(false)
const stockError = ref<string | null>(null)

const LOW_STOCK_THRESHOLD = 5

// ── Formulaire ────────────────────────────────────────────────────────────────
// Attention : sur un <input type="number">, Vue applique implicitement le
// modificateur `.number` — le champ vaut '' tant qu'il est vide puis un *number*
// dès qu'une valeur est saisie. lat / lng / serviceRadius sont donc typés
// `string | number` et normalisés par numText() avant validation, puis coercés
// avec Number() avant l'envoi (le schéma Zod exige z.number() et refuserait une
// chaîne avec validation_failed).
const emptyForm = () => ({
  name: '',
  address: '',
  lat: '' as string | number,
  lng: '' as string | number,
  serviceRadius: 5 as string | number,
  openTime: '08:00',
  closeTime: '22:00',
  isActive: true,
  managerId: '',
})
const form = reactive(emptyForm())

function numText(v: string | number): string {
  return typeof v === 'number' ? String(v) : v.trim()
}

const TOUCHABLE = ['name', 'address', 'lat', 'lng', 'serviceRadius', 'openTime', 'closeTime'] as const
const touched = reactive<Record<string, boolean>>(
  Object.fromEntries(TOUCHABLE.map(f => [f, false])),
)
function touch(field: string) {
  touched[field] = true
}
function resetTouched() {
  for (const k of Object.keys(touched)) touched[k] = false
}
function touchAll() {
  for (const k of Object.keys(touched)) touched[k] = true
}

const HHMM = /^\d{2}:\d{2}$/

const fieldErrors = computed(() => {
  const e: Record<string, string> = {}

  if (!form.name.trim()) e.name = 'Le nom est obligatoire.'
  if (!form.address.trim()) e.address = 'L’adresse est obligatoire.'

  const latText = numText(form.lat)
  const lat = Number(latText)
  if (!latText) e.lat = 'La latitude est obligatoire.'
  else if (!Number.isFinite(lat)) e.lat = 'Latitude invalide (exemple : 48.8566).'
  else if (lat < -90 || lat > 90) e.lat = 'La latitude doit être comprise entre -90 et 90.'

  const lngText = numText(form.lng)
  const lng = Number(lngText)
  if (!lngText) e.lng = 'La longitude est obligatoire.'
  else if (!Number.isFinite(lng)) e.lng = 'Longitude invalide (exemple : 2.3522).'
  else if (lng < -180 || lng > 180) e.lng = 'La longitude doit être comprise entre -180 et 180.'

  const radiusText = numText(form.serviceRadius)
  const radius = Number(radiusText)
  if (radiusText && (!Number.isInteger(radius) || radius <= 0))
    e.serviceRadius = 'Le rayon doit être un nombre entier de kilomètres supérieur à 0.'

  if (form.openTime && !HHMM.test(form.openTime)) e.openTime = 'Format attendu : HH:MM.'
  if (form.closeTime && !HHMM.test(form.closeTime)) e.closeTime = 'Format attendu : HH:MM.'

  return e
})

const formValid = computed(() => Object.keys(fieldErrors.value).length === 0)

function err(field: string) {
  return touched[field] ? fieldErrors.value[field] : undefined
}

// Résumé des champs manquants, visible dès l'ouverture de la modale pour que le
// bouton désactivé ne reste jamais sans explication.
const missingSummary = computed(() => {
  const labels: Record<string, string> = {
    name: 'Nom',
    address: 'Adresse',
    lat: 'Latitude',
    lng: 'Longitude',
    serviceRadius: 'Rayon de service',
    openTime: 'Heure d’ouverture',
    closeTime: 'Heure de fermeture',
  }
  const keys = Object.keys(fieldErrors.value)
  if (!keys.length) return null
  return keys.map(k => labels[k] ?? k).join(', ')
})

// ── Chargement ────────────────────────────────────────────────────────────────
async function fetchWarehouses(silent = false) {
  if (!silent) loading.value = true
  error.value = null
  try {
    const data = await adminFetch<{ warehouses: Warehouse[] }>('/warehouses')
    warehouses.value = data.warehouses
  }
  catch (e) {
    error.value = toFrench(e, 'Impossible de charger les entrepôts.')
  }
  finally {
    loading.value = false
  }
}

async function fetchManagers() {
  managersError.value = null
  try {
    const data = await adminFetch<{ users: Manager[] }>('/users?role=warehouse_manager')
    managers.value = data.users
  }
  catch (e) {
    managersError.value = toFrench(e, 'Impossible de charger la liste des responsables.')
  }
}

onMounted(async () => {
  auth.hydrate()
  await Promise.all([fetchWarehouses(), fetchManagers()])
})

const filtered = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return warehouses.value
  return warehouses.value.filter(
    w =>
      w.name.toLowerCase().includes(q)
      || w.address.toLowerCase().includes(q)
      || (w.manager?.name ?? '').toLowerCase().includes(q),
  )
})

const activeCount = computed(() => warehouses.value.filter(w => w.isActive).length)

// ── Erreurs backend → copie française ─────────────────────────────────────────
interface ZodIssue { message?: string, path?: (string | number)[] }

// Le middleware d'erreur renvoie deux enveloppes selon le chemin :
//   HttpError(422, 'validation_failed', { issues }) → { error, details: { issues } }
//   ZodError non capturée                           → { error, issues }
// (backend/src/middleware/error.ts:17-21) — on lit donc les deux.
function issuesOf(body: unknown): ZodIssue[] {
  const b = body as { issues?: ZodIssue[], details?: { issues?: ZodIssue[] } } | undefined
  return b?.details?.issues ?? b?.issues ?? []
}

const FIELD_LABELS: Record<string, string> = {
  name: 'Nom',
  address: 'Adresse',
  lat: 'Latitude',
  lng: 'Longitude',
  serviceRadius: 'Rayon de service',
  openTime: 'Heure d’ouverture',
  closeTime: 'Heure de fermeture',
  isActive: 'Statut',
  managerId: 'Responsable',
}

function describeIssues(issues: ZodIssue[]): string | null {
  if (!issues.length) return null
  const parts = issues.map((i) => {
    const field = String(i.path?.[0] ?? '')
    const label = FIELD_LABELS[field] ?? field
    if (field === 'openTime' || field === 'closeTime')
      return `${label} : format HH:MM attendu.`
    if (field === 'lat' || field === 'lng')
      return `${label} : un nombre est attendu.`
    if (field === 'serviceRadius')
      return `${label} : un entier positif est attendu.`
    return label ? `${label} : valeur invalide.` : 'Valeur invalide.'
  })
  return [...new Set(parts)].join(' · ')
}

function toFrench(e: unknown, fallback: string): string {
  const apiErr = e as {
    data?: { error?: string }
    statusCode?: number
    message?: string
  }
  const code = apiErr?.data?.error
  const map: Record<string, string> = {
    validation_failed:
      describeIssues(issuesOf(apiErr?.data)) ?? 'Certains champs sont invalides.',
    warehouse_not_found: 'Cet entrepôt n’existe plus. Actualisez la liste.',
    forbidden: 'Action réservée aux administrateurs.',
    missing_token: 'Session expirée, veuillez vous reconnecter.',
    invalid_token: 'Session expirée, veuillez vous reconnecter.',
  }
  if (code && map[code]) return map[code]!
  if (apiErr?.statusCode === 403) return 'Action réservée aux administrateurs.'
  if (apiErr?.statusCode === 404) return 'Ressource introuvable. Actualisez la liste.'
  return apiErr?.message ?? fallback
}

// ── Modale ────────────────────────────────────────────────────────────────────
function openCreate() {
  editing.value = null
  Object.assign(form, emptyForm())
  saveError.value = null
  resetTouched()
  showModal.value = true
}

function openEdit(w: Warehouse) {
  editing.value = w
  Object.assign(form, {
    name: w.name,
    address: w.address,
    lat: w.lat,
    lng: w.lng,
    serviceRadius: w.serviceRadius,
    openTime: w.openTime,
    closeTime: w.closeTime,
    isActive: w.isActive,
    managerId: w.managerId ?? '',
  })
  saveError.value = null
  resetTouched()
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  editing.value = null
  saveError.value = null
  resetTouched()
}

// ── Enregistrement (création / modification) ──────────────────────────────────
async function save() {
  touchAll()
  if (!formValid.value) return

  saving.value = true
  saveError.value = null
  try {
    const body: Record<string, unknown> = {
      name: form.name.trim(),
      address: form.address.trim(),
      lat: Number(form.lat),
      lng: Number(form.lng),
      isActive: form.isActive,
    }
    const radiusText = numText(form.serviceRadius)
    if (radiusText) body.serviceRadius = Number(radiusText)
    if (form.openTime) body.openTime = form.openTime
    if (form.closeTime) body.closeTime = form.closeTime

    // managerId est `.nullable()` côté Zod : null désassigne. À la création on
    // omet simplement le champ quand aucun responsable n'est choisi.
    if (form.managerId) body.managerId = form.managerId
    else if (editing.value) body.managerId = null

    if (editing.value) {
      await adminFetch<{ warehouse: Warehouse }>(`/warehouses/${editing.value.id}`, {
        method: 'PATCH',
        body,
      })
    }
    else {
      await adminFetch<{ warehouse: Warehouse }>('/warehouses', {
        method: 'POST',
        body,
      })
    }

    // PATCH et POST renvoient l'entrepôt SANS la relation `manager`
    // (backend/src/routes/warehouses.ts:112,129). On relit donc la liste, qui
    // l'inclut — c'est aussi ce qui prouve la persistance après rechargement.
    await fetchWarehouses(true)
    closeModal()
  }
  catch (e) {
    saveError.value = toFrench(e, 'Erreur lors de la sauvegarde.')
  }
  finally {
    saving.value = false
  }
}

// ── Activation / désactivation ────────────────────────────────────────────────
// Il n'existe PAS de DELETE /api/warehouses/:id : la « suppression » est une
// désactivation via PATCH { isActive: false }.
async function toggleActive(w: Warehouse) {
  const next = !w.isActive
  if (
    !next
    && !confirm(
      `Désactiver l’entrepôt « ${w.name} » ? Il ne sera plus proposé pour les nouvelles commandes.`,
    )
  ) return

  toggling.value = w.id
  toggleError.value = null
  try {
    await adminFetch<{ warehouse: Warehouse }>(`/warehouses/${w.id}`, {
      method: 'PATCH',
      body: { isActive: next },
    })
    const idx = warehouses.value.findIndex(x => x.id === w.id)
    // la réponse PATCH n'inclut pas `manager` : on ne remplace que le statut
    if (idx !== -1) warehouses.value[idx] = { ...warehouses.value[idx]!, isActive: next }
  }
  catch (e) {
    toggleError.value = toFrench(
      e,
      next ? 'Impossible d’activer cet entrepôt.' : 'Impossible de désactiver cet entrepôt.',
    )
  }
  finally {
    toggling.value = null
  }
}

// ── Stock par entrepôt ────────────────────────────────────────────────────────
async function loadStock(id: string) {
  stockLoading.value = true
  stockError.value = null
  stock.value = []
  try {
    const data = await adminFetch<{ stock: StockLine[] }>(`/inventory/${id}`)
    stock.value = data.stock
  }
  catch (e) {
    stockError.value = toFrench(e, 'Impossible de charger le stock de cet entrepôt.')
  }
  finally {
    stockLoading.value = false
  }
}

function selectWarehouse(w: Warehouse) {
  if (selectedId.value === w.id) {
    selectedId.value = null
    stock.value = []
    stockError.value = null
    return
  }
  selectedId.value = w.id
  loadStock(w.id)
}

const totalUnits = computed(() => stock.value.reduce((s, l) => s + l.quantity, 0))
const lowStockCount = computed(
  () => stock.value.filter(l => l.quantity <= LOW_STOCK_THRESHOLD).length,
)
</script>

<template>
  <div>
    <!-- ═══ En-tête ═══ -->
    <div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-h2 font-semibold text-text-primary">
          Entrepôts
        </h1>
        <p class="mt-1 text-body-sm text-text-muted">
          {{ warehouses.length }} entrepôt{{ warehouses.length !== 1 ? 's' : '' }} ·
          {{ activeCount }} actif{{ activeCount !== 1 ? 's' : '' }}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-4 py-2.5 text-body-sm font-medium text-text-secondary transition hover:bg-neutral-50"
          @click="fetchWarehouses()"
        >
          <Icon name="ph:arrows-clockwise" class="size-4" />
          Actualiser
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-body-sm font-semibold text-white transition hover:bg-primary-700"
          @click="openCreate"
        >
          <Icon name="ph:plus" class="size-4" />
          Nouvel entrepôt
        </button>
      </div>
    </div>

    <!-- Recherche -->
    <div class="relative mb-5 max-w-sm">
      <Icon
        name="ph:magnifying-glass"
        class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400"
      />
      <input
        v-model="searchQuery"
        type="search"
        placeholder="Rechercher un entrepôt..."
        aria-label="Rechercher un entrepôt"
        class="w-full rounded-xl border border-border bg-white py-2.5 pl-9 pr-4 text-body-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
      >
    </div>

    <!-- Erreur d'activation / désactivation -->
    <div
      v-if="toggleError"
      class="mb-4 rounded-xl border border-error/20 bg-error/10 px-4 py-3 text-body-sm text-error"
    >
      {{ toggleError }}
    </div>

    <!-- Chargement -->
    <div v-if="loading" class="space-y-3">
      <div v-for="i in 3" :key="i" class="h-28 animate-pulse rounded-2xl bg-white" />
    </div>

    <!-- Erreur -->
    <div
      v-else-if="error"
      class="rounded-2xl border border-error/20 bg-error/5 p-8 text-center"
    >
      <Icon name="ph:warning-circle" class="mx-auto mb-3 size-10 text-error" />
      <p class="text-body font-medium text-error">
        {{ error }}
      </p>
      <button
        type="button"
        class="mt-4 rounded-xl bg-primary-600 px-5 py-2 text-body-sm font-medium text-white transition hover:bg-primary-700"
        @click="fetchWarehouses()"
      >
        Réessayer
      </button>
    </div>

    <!-- Vide -->
    <EmptyState
      v-else-if="filtered.length === 0"
      title="Aucun entrepôt"
      :description="searchQuery.trim()
        ? 'Aucun entrepôt ne correspond à votre recherche.'
        : 'Créez votre premier entrepôt pour préparer et expédier les commandes.'"
    >
      <template #icon>
        <Icon name="ph:warehouse" class="size-10 text-primary-500" />
      </template>
      <template #actions>
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-body-sm font-semibold text-white transition hover:bg-primary-700"
          @click="openCreate"
        >
          <Icon name="ph:plus" class="size-4" />
          Créer un entrepôt
        </button>
      </template>
    </EmptyState>

    <!-- Liste -->
    <div v-else class="space-y-4">
      <article
        v-for="w in filtered"
        :key="w.id"
        class="overflow-hidden rounded-2xl border border-border bg-white"
        :class="w.isActive ? '' : 'opacity-75'"
      >
        <div class="flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between">
          <!-- Identité -->
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-3">
              <span
                class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700"
              >
                <Icon name="ph:warehouse" class="size-5" />
              </span>
              <div class="min-w-0">
                <h2 class="truncate text-body font-semibold text-text-primary">
                  {{ w.name }}
                </h2>
                <p class="truncate text-body-sm text-text-muted">
                  {{ w.address }}
                </p>
              </div>
              <span
                class="ml-2 shrink-0 rounded-full px-2.5 py-1 text-caption font-semibold"
                :class="w.isActive
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-neutral-100 text-text-muted'"
              >
                {{ w.isActive ? 'Actif' : 'Inactif' }}
              </span>
            </div>

            <dl class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <dt class="text-caption font-bold uppercase tracking-wider text-text-muted">
                  Horaires
                </dt>
                <dd class="mt-0.5 text-body-sm text-text-primary">
                  {{ w.openTime }} – {{ w.closeTime }}
                </dd>
              </div>
              <div>
                <dt class="text-caption font-bold uppercase tracking-wider text-text-muted">
                  Rayon
                </dt>
                <dd class="mt-0.5 text-body-sm text-text-primary">
                  {{ w.serviceRadius }} km
                </dd>
              </div>
              <div>
                <dt class="text-caption font-bold uppercase tracking-wider text-text-muted">
                  Coordonnées
                </dt>
                <dd class="mt-0.5 font-mono text-caption text-text-secondary">
                  {{ w.lat.toFixed(4) }}, {{ w.lng.toFixed(4) }}
                </dd>
              </div>
              <div>
                <dt class="text-caption font-bold uppercase tracking-wider text-text-muted">
                  Responsable
                </dt>
                <dd class="mt-0.5 truncate text-body-sm">
                  <span v-if="w.manager" class="text-text-primary">
                    {{ w.manager.name }}
                  </span>
                  <span v-else class="text-text-muted italic">Aucun responsable</span>
                </dd>
              </div>
            </dl>
          </div>

          <!-- Actions -->
          <div class="flex shrink-0 flex-wrap items-center gap-2">
            <button
              type="button"
              class="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-body-sm font-medium text-text-secondary transition hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700"
              :aria-expanded="selectedId === w.id"
              @click="selectWarehouse(w)"
            >
              <Icon name="ph:boxes" class="size-4" />
              {{ selectedId === w.id ? 'Masquer le stock' : 'Voir le stock' }}
            </button>
            <button
              type="button"
              class="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-body-sm font-medium text-text-secondary transition hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700"
              @click="openEdit(w)"
            >
              <Icon name="ph:pencil-simple" class="size-4" />
              Modifier
            </button>
            <button
              type="button"
              :disabled="toggling === w.id"
              class="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-body-sm font-medium transition disabled:opacity-40"
              :class="w.isActive
                ? 'text-text-secondary hover:border-error/30 hover:bg-error/5 hover:text-error'
                : 'text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50'"
              @click="toggleActive(w)"
            >
              <Icon
                v-if="toggling === w.id"
                name="ph:circle-notch"
                class="size-4 animate-spin"
              />
              <Icon v-else :name="w.isActive ? 'ph:power' : 'ph:check-circle'" class="size-4" />
              {{ w.isActive ? 'Désactiver' : 'Activer' }}
            </button>
          </div>
        </div>

        <!-- ═══ Panneau stock ═══ -->
        <div v-if="selectedId === w.id" class="border-t border-border bg-neutral-50 p-5">
          <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 class="text-body-sm font-semibold text-text-primary">
              Stock de l’entrepôt
            </h3>
            <p v-if="!stockLoading && !stockError && stock.length" class="text-caption text-text-muted">
              {{ stock.length }} référence{{ stock.length !== 1 ? 's' : '' }} ·
              {{ totalUnits }} unité{{ totalUnits !== 1 ? 's' : '' }} ·
              {{ lowStockCount }} en stock bas
            </p>
          </div>

          <!-- Chargement stock -->
          <div v-if="stockLoading" class="space-y-2">
            <div v-for="i in 3" :key="i" class="h-12 animate-pulse rounded-xl bg-white" />
          </div>

          <!-- Erreur stock -->
          <div
            v-else-if="stockError"
            class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-error/20 bg-error/10 px-4 py-3 text-body-sm text-error"
          >
            <span>{{ stockError }}</span>
            <button
              type="button"
              class="rounded-lg border border-error/30 px-3 py-1 text-caption font-medium transition hover:bg-error/10"
              @click="loadStock(w.id)"
            >
              Réessayer
            </button>
          </div>

          <!-- Stock vide -->
          <p
            v-else-if="stock.length === 0"
            class="rounded-xl border border-dashed border-border bg-white px-4 py-6 text-center text-body-sm text-text-muted"
          >
            Aucun produit en stock dans cet entrepôt.
          </p>

          <!-- Tableau stock -->
          <div v-else class="overflow-hidden rounded-xl border border-border bg-white">
            <div class="overflow-x-auto">
              <table class="w-full min-w-[36rem] text-left">
                <thead class="border-b border-border bg-white">
                  <tr class="text-caption font-bold uppercase tracking-wider text-text-muted">
                    <th scope="col" class="px-4 py-2.5">
                      Produit
                    </th>
                    <th scope="col" class="px-4 py-2.5">
                      Catégorie
                    </th>
                    <th scope="col" class="px-4 py-2.5 text-right">
                      Quantité
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-border">
                  <tr
                    v-for="line in stock"
                    :key="line.id"
                    :class="line.quantity <= LOW_STOCK_THRESHOLD ? 'bg-amber-50/60' : ''"
                  >
                    <td class="px-4 py-2.5">
                      <div class="flex items-center gap-3">
                        <img
                          v-if="line.product.imageUrl"
                          :src="line.product.imageUrl"
                          :alt="line.product.name"
                          class="size-9 shrink-0 rounded-lg border border-border object-cover"
                          loading="lazy"
                        >
                        <span
                          v-else
                          class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-400"
                        >
                          <Icon name="ph:package" class="size-4" />
                        </span>
                        <span class="text-body-sm font-medium text-text-primary">
                          {{ line.product.name }}
                        </span>
                      </div>
                    </td>
                    <td class="px-4 py-2.5 text-body-sm text-text-muted">
                      {{ line.product.category?.name ?? '—' }}
                    </td>
                    <td class="px-4 py-2.5 text-right">
                      <span
                        class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-caption font-semibold"
                        :class="line.quantity === 0
                          ? 'bg-error/10 text-error'
                          : line.quantity <= LOW_STOCK_THRESHOLD
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-50 text-emerald-700'"
                      >
                        <Icon
                          v-if="line.quantity <= LOW_STOCK_THRESHOLD"
                          name="ph:warning"
                          class="size-3.5"
                        />
                        {{ line.quantity }}
                        <span class="font-normal">
                          {{ line.quantity === 0 ? '· rupture' : line.quantity <= LOW_STOCK_THRESHOLD ? '· stock bas' : '' }}
                        </span>
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </article>
    </div>

    <!-- ═══ Modale création / édition ═══ -->
    <UiModal
      :open="showModal"
      :title="editing ? 'Modifier l’entrepôt' : 'Nouvel entrepôt'"
      size="2xl"
      @close="closeModal"
    >
      <div class="space-y-5">
        <!-- Nom -->
        <div>
          <label
            for="wh-name"
            class="mb-1.5 flex items-center gap-1 text-body-sm font-medium text-text-primary"
          >
            Nom
            <span class="text-error">*</span>
          </label>
          <input
            id="wh-name"
            v-model="form.name"
            type="text"
            placeholder="EzTech Châtelet"
            class="w-full rounded-xl border px-4 py-2.5 text-body-sm focus:outline-none focus:ring-2"
            :class="err('name')
              ? 'border-error/60 bg-error/5 focus:border-error focus:ring-error/20'
              : 'border-border focus:border-primary-400 focus:ring-primary-100'"
            @blur="touch('name')"
          >
          <p v-if="err('name')" class="mt-1 flex items-center gap-1 text-caption text-error">
            <Icon name="ph:warning-circle" class="size-3.5 shrink-0" />
            {{ err('name') }}
          </p>
        </div>

        <!-- Adresse -->
        <div>
          <label
            for="wh-address"
            class="mb-1.5 flex items-center gap-1 text-body-sm font-medium text-text-primary"
          >
            Adresse
            <span class="text-error">*</span>
          </label>
          <input
            id="wh-address"
            v-model="form.address"
            type="text"
            placeholder="4 Place du Châtelet, 75001 Paris"
            class="w-full rounded-xl border px-4 py-2.5 text-body-sm focus:outline-none focus:ring-2"
            :class="err('address')
              ? 'border-error/60 bg-error/5 focus:border-error focus:ring-error/20'
              : 'border-border focus:border-primary-400 focus:ring-primary-100'"
            @blur="touch('address')"
          >
          <p v-if="err('address')" class="mt-1 flex items-center gap-1 text-caption text-error">
            <Icon name="ph:warning-circle" class="size-3.5 shrink-0" />
            {{ err('address') }}
          </p>
        </div>

        <!-- Coordonnées -->
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label
              for="wh-lat"
              class="mb-1.5 flex items-center gap-1 text-body-sm font-medium text-text-primary"
            >
              Latitude
              <span class="text-error">*</span>
            </label>
            <input
              id="wh-lat"
              v-model="form.lat"
              type="number"
              step="any"
              inputmode="decimal"
              placeholder="48.8566"
              class="w-full rounded-xl border px-4 py-2.5 font-mono text-body-sm focus:outline-none focus:ring-2"
              :class="err('lat')
                ? 'border-error/60 bg-error/5 focus:border-error focus:ring-error/20'
                : 'border-border focus:border-primary-400 focus:ring-primary-100'"
              @blur="touch('lat')"
            >
            <p v-if="err('lat')" class="mt-1 flex items-center gap-1 text-caption text-error">
              <Icon name="ph:warning-circle" class="size-3.5 shrink-0" />
              {{ err('lat') }}
            </p>
          </div>

          <div>
            <label
              for="wh-lng"
              class="mb-1.5 flex items-center gap-1 text-body-sm font-medium text-text-primary"
            >
              Longitude
              <span class="text-error">*</span>
            </label>
            <input
              id="wh-lng"
              v-model="form.lng"
              type="number"
              step="any"
              inputmode="decimal"
              placeholder="2.3522"
              class="w-full rounded-xl border px-4 py-2.5 font-mono text-body-sm focus:outline-none focus:ring-2"
              :class="err('lng')
                ? 'border-error/60 bg-error/5 focus:border-error focus:ring-error/20'
                : 'border-border focus:border-primary-400 focus:ring-primary-100'"
              @blur="touch('lng')"
            >
            <p v-if="err('lng')" class="mt-1 flex items-center gap-1 text-caption text-error">
              <Icon name="ph:warning-circle" class="size-3.5 shrink-0" />
              {{ err('lng') }}
            </p>
          </div>

          <div>
            <label for="wh-radius" class="mb-1.5 block text-body-sm font-medium text-text-primary">
              Rayon de service (km)
            </label>
            <input
              id="wh-radius"
              v-model="form.serviceRadius"
              type="number"
              min="1"
              step="1"
              inputmode="numeric"
              placeholder="5"
              class="w-full rounded-xl border px-4 py-2.5 text-body-sm focus:outline-none focus:ring-2"
              :class="err('serviceRadius')
                ? 'border-error/60 bg-error/5 focus:border-error focus:ring-error/20'
                : 'border-border focus:border-primary-400 focus:ring-primary-100'"
              @blur="touch('serviceRadius')"
            >
            <p
              v-if="err('serviceRadius')"
              class="mt-1 flex items-center gap-1 text-caption text-error"
            >
              <Icon name="ph:warning-circle" class="size-3.5 shrink-0" />
              {{ err('serviceRadius') }}
            </p>
          </div>
        </div>

        <!-- Horaires -->
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label for="wh-open" class="mb-1.5 block text-body-sm font-medium text-text-primary">
              Heure d’ouverture
            </label>
            <input
              id="wh-open"
              v-model="form.openTime"
              type="time"
              class="w-full rounded-xl border px-4 py-2.5 text-body-sm focus:outline-none focus:ring-2"
              :class="err('openTime')
                ? 'border-error/60 bg-error/5 focus:border-error focus:ring-error/20'
                : 'border-border focus:border-primary-400 focus:ring-primary-100'"
              @blur="touch('openTime')"
            >
            <p v-if="err('openTime')" class="mt-1 flex items-center gap-1 text-caption text-error">
              <Icon name="ph:warning-circle" class="size-3.5 shrink-0" />
              {{ err('openTime') }}
            </p>
          </div>

          <div>
            <label for="wh-close" class="mb-1.5 block text-body-sm font-medium text-text-primary">
              Heure de fermeture
            </label>
            <input
              id="wh-close"
              v-model="form.closeTime"
              type="time"
              class="w-full rounded-xl border px-4 py-2.5 text-body-sm focus:outline-none focus:ring-2"
              :class="err('closeTime')
                ? 'border-error/60 bg-error/5 focus:border-error focus:ring-error/20'
                : 'border-border focus:border-primary-400 focus:ring-primary-100'"
              @blur="touch('closeTime')"
            >
            <p v-if="err('closeTime')" class="mt-1 flex items-center gap-1 text-caption text-error">
              <Icon name="ph:warning-circle" class="size-3.5 shrink-0" />
              {{ err('closeTime') }}
            </p>
          </div>
        </div>

        <!-- Responsable -->
        <div>
          <label for="wh-manager" class="mb-1.5 block text-body-sm font-medium text-text-primary">
            Responsable
          </label>
          <select
            id="wh-manager"
            v-model="form.managerId"
            class="w-full rounded-xl border border-border bg-white px-4 py-2.5 text-body-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
          >
            <option value="">
              Aucun responsable
            </option>
            <option v-for="m in managers" :key="m.id" :value="m.id">
              {{ m.name }} — {{ m.email }}
            </option>
          </select>
          <p v-if="managersError" class="mt-1 flex items-center gap-1 text-caption text-error">
            <Icon name="ph:warning-circle" class="size-3.5 shrink-0" />
            {{ managersError }}
          </p>
          <p v-else-if="managers.length === 0" class="mt-1 text-caption text-text-muted">
            Aucun compte « responsable d’entrepôt » n’existe pour l’instant. Changez le rôle d’un
            utilisateur depuis la page Utilisateurs pour pouvoir l’assigner ici.
          </p>
          <p v-else class="mt-1 text-caption text-text-muted">
            Seuls les comptes ayant le rôle « responsable d’entrepôt » peuvent être assignés.
          </p>
        </div>

        <!-- Statut -->
        <label
          for="wh-active"
          class="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-4"
        >
          <input
            id="wh-active"
            v-model="form.isActive"
            type="checkbox"
            class="mt-0.5 size-4 rounded border-border text-primary-600 focus:ring-primary-400"
          >
          <span>
            <span class="block text-body-sm font-medium text-text-primary">Entrepôt actif</span>
            <span class="mt-0.5 block text-caption text-text-muted">
              Un entrepôt inactif reste consultable mais n’est plus proposé pour de nouvelles
              commandes.
            </span>
          </span>
        </label>

        <!-- Erreur serveur -->
        <div
          v-if="saveError"
          class="rounded-xl border border-error/20 bg-error/10 px-4 py-3 text-body-sm text-error"
        >
          {{ saveError }}
        </div>
      </div>

      <template #footer>
        <div class="space-y-3">
          <p v-if="missingSummary" class="text-caption text-text-muted">
            Champs à corriger : {{ missingSummary }}
          </p>
          <div class="flex items-center gap-3">
            <button
              type="button"
              :disabled="saving || !formValid"
              :title="!formValid ? 'Renseignez les champs obligatoires' : ''"
              class="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary-600 py-2.5 text-body-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-40"
              @click="save"
            >
              <Icon v-if="saving" name="ph:circle-notch" class="size-4 animate-spin" />
              <Icon v-else name="ph:floppy-disk" class="size-4" />
              {{ saving ? 'Sauvegarde...' : editing ? 'Enregistrer' : 'Créer l’entrepôt' }}
            </button>
            <button
              type="button"
              class="rounded-xl border border-border px-5 py-2.5 text-body-sm font-medium text-text-secondary transition hover:bg-neutral-50"
              @click="closeModal"
            >
              Annuler
            </button>
          </div>
        </div>
      </template>
    </UiModal>
  </div>
</template>
