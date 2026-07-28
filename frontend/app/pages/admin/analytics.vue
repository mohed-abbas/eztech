<script setup lang="ts">
import type { Ref } from 'vue'

definePageMeta({ layout: 'admin', middleware: ['auth', 'role'], role: 'admin' })
useHead({ title: 'Analytics — Admin EzTech' })

// ── Dynamic chart import (client-only) ────────────────────────────────────────
// Top-level imports of chart.js / vue-chartjs break Vite SSR module resolution.
// We lazy-load everything inside onMounted so the server never touches these modules.
const LineChart = shallowRef<Component | null>(null)
const BarChart = shallowRef<Component | null>(null)
const chartsReady = ref(false)

onMounted(async () => {
  const [{ Line, Bar }, { Chart, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler }] = await Promise.all([
    import('vue-chartjs'),
    import('chart.js'),
  ])
  Chart.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler)
  LineChart.value = Line
  BarChart.value = Bar
  chartsReady.value = true
})

const { adminFetch, fmtMoney } = useAdminApi()
const auth = useAuthStore()

// ── Types — miroir exact du contrat /api/analytics/* ──────────────────────────
interface AnalyticsRange {
  from: string
  to: string
  timezone: string
}

interface OrdersPerDayPoint {
  date: string
  orders: number
  paidOrders: number
  delivered: number
  cancelled: number
}

interface OrdersPerDayResponse {
  range: AnalyticsRange
  points: OrdersPerDayPoint[]
  totals: { orders: number; paidOrders: number; delivered: number; cancelled: number }
}

interface RevenueBucket {
  date: string
  revenue: number
  orders: number
}

interface RevenueResponse {
  range: AnalyticsRange
  period: 'week' | 'month' | 'year'
  granularity: 'day' | 'month'
  currency: string
  revenueAnchor: string
  total: number
  paidOrders: number
  averageOrderValue: number
  ordersMissingTotal: number
  buckets: RevenueBucket[]
}

interface TopProduct {
  productId: string | null
  name: string
  imageUrl: string
  quantity: number
  orders: number
  revenue: number
}

interface TopProductsResponse {
  range: AnalyticsRange
  limit: number
  products: TopProduct[]
}

interface DeliveryTimeResponse {
  range: AnalyticsRange
  unit: string
  source: string
  averageMinutes: number | null
  medianMinutes: number | null
  p90Minutes: number | null
  fastestMinutes: number | null
  slowestMinutes: number | null
  sampleSize: number
  deliveredInPeriod: number
  excludedMissingPickupEvent: number
}

interface TopRider {
  riderId: string
  name: string
  deliveries: number
}

interface ActiveRidersResponse {
  range: AnalyticsRange
  onlineNow: number
  onlineNowIsPointInTime: boolean
  activeInPeriod: number
  approvedRiders: number
  topRiders: TopRider[]
}

// ── State ─────────────────────────────────────────────────────────────────────
const period = ref<30 | 7 | 90>(30)
const rangeFrom = ref('')
const rangeTo = ref('')
const pageError = ref<string | null>(null)

const ordersPerDay = ref<OrdersPerDayResponse | null>(null)
const ordersLoading = ref(true)
const ordersError = ref<string | null>(null)

const revenue = ref<RevenueResponse | null>(null)
const revenueLoading = ref(true)
const revenueError = ref<string | null>(null)

const topProducts = ref<TopProductsResponse | null>(null)
const topProductsLoading = ref(true)
const topProductsError = ref<string | null>(null)

const deliveryTime = ref<DeliveryTimeResponse | null>(null)
const deliveryTimeLoading = ref(true)
const deliveryTimeError = ref<string | null>(null)

const riders = ref<ActiveRidersResponse | null>(null)
const ridersLoading = ref(true)
const ridersError = ref<string | null>(null)

// ── Dates Europe/Paris ────────────────────────────────────────────────────────
// L'API attend des dates calendaires PARIS ("YYYY-MM-DD"), pas des instants ISO.
// 'en-CA' produit directement le format YYYY-MM-DD.
function parisToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' })
}

// Décalage de jours sur un Date positionné à midi UTC : aucun changement d'heure
// (DST) ne peut faire basculer la date d'un jour.
function shiftDays(day: string, delta: number): string {
  const [y, m, d] = day.split('-').map(Number)
  const dt = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12))
  dt.setUTCDate(dt.getUTCDate() + delta)
  return dt.toISOString().slice(0, 10)
}

// ── Erreurs ───────────────────────────────────────────────────────────────────
function errMsg(e: unknown): string {
  const err = e as { data?: { error?: string }; statusCode?: number; status?: number }
  const code = err?.data?.error
  const status = err?.statusCode ?? err?.status
  if (code === 'range_too_large') return 'Période trop longue (366 jours maximum)'
  if (code === 'invalid_range') return 'Période invalide'
  if (code === 'validation_failed') return 'Paramètres de période invalides'
  if (code === 'forbidden' || status === 403) return 'Accès refusé'
  if (status === 401) return 'Session expirée — reconnectez-vous'
  return 'Erreur de chargement'
}

// ── Fetch ─────────────────────────────────────────────────────────────────────
// Garde anti-course : chaque appel de loadAll() incrémente runId. Les cinq
// requêtes d'un run portent son numéro et n'écrivent dans les refs que si elles
// sont encore le run courant. Sans cela, changer 30j → 7j → 90j rapidement laisse
// une réponse périmée écraser la fraîche, endpoint par endpoint : la page affiche
// alors des périodes mélangées, sans erreur ni indicateur de chargement.
let runId = 0

async function loadOne<T>(
  run: number,
  path: string,
  target: Ref<T | null>,
  errorRef: Ref<string | null>,
  loadingRef: Ref<boolean>,
): Promise<void> {
  loadingRef.value = true
  errorRef.value = null
  try {
    const data = await adminFetch<T>(path)
    if (run !== runId) return // réponse périmée : on ignore
    target.value = data
  }
  catch (e) {
    if (run !== runId) return // réponse périmée : ni erreur ni rejet
    target.value = null
    errorRef.value = errMsg(e)
    throw e
  }
  finally {
    // Ne jamais éteindre le skeleton d'un run plus récent encore en vol.
    if (run === runId) loadingRef.value = false
  }
}

async function loadAll() {
  const run = ++runId
  auth.hydrate()
  pageError.value = null

  const to = parisToday()
  const from = shiftDays(to, -(period.value - 1))
  rangeFrom.value = from
  rangeTo.value = to
  const qs = `from=${from}&to=${to}`

  const results = await Promise.allSettled([
    loadOne<OrdersPerDayResponse>(run, `/analytics/orders-per-day?${qs}`, ordersPerDay, ordersError, ordersLoading),
    loadOne<RevenueResponse>(run, `/analytics/revenue?period=month&${qs}`, revenue, revenueError, revenueLoading),
    loadOne<TopProductsResponse>(run, `/analytics/top-products?limit=5&${qs}`, topProducts, topProductsError, topProductsLoading),
    loadOne<DeliveryTimeResponse>(run, `/analytics/delivery-time?${qs}`, deliveryTime, deliveryTimeError, deliveryTimeLoading),
    loadOne<ActiveRidersResponse>(run, `/analytics/active-riders?${qs}`, riders, ridersError, ridersLoading),
  ])

  if (run !== runId) return

  // Une seule carte en échec = carte dégradée. Les cinq en échec = page en échec.
  if (results.every(r => r.status === 'rejected')) {
    pageError.value = ordersError.value ?? 'Erreur de chargement'
  }
}

onMounted(loadAll)
watch(period, loadAll)

// ── Formatters ────────────────────────────────────────────────────────────────
// new Date('2026-07-28') est parsé comme minuit UTC et peut afficher la veille :
// on reconstruit une date locale à partir des composants.
function dayParts(day: string): Date {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1)
}

function fmtDayShort(day: string): string {
  return dayParts(day).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function fmtMonthShort(day: string): string {
  return dayParts(day).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
}

function fmtDayLong(day: string): string {
  return dayParts(day).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
}

// Les statistiques de délai sont number | null : null ⇒ '—', jamais '0 min'.
function fmtMinutes(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—'
  if (v < 60) return `${Math.round(v)} min`
  return `${(v / 60).toFixed(1).replace('.', ',')} h`
}

function plural(n: number, singular: string, pluralForm: string): string {
  return n > 1 ? pluralForm : singular
}

// ── Dérivés ───────────────────────────────────────────────────────────────────
const periodLabel = computed(() =>
  rangeFrom.value && rangeTo.value
    ? `du ${fmtDayLong(rangeFrom.value)} au ${fmtDayLong(rangeTo.value)}`
    : `${period.value} derniers jours`,
)

const totals = computed(() => ordersPerDay.value?.totals ?? null)

const deliveryRate = computed(() => {
  const t = totals.value
  if (!t || t.orders === 0) return 0
  return Math.round((t.delivered / t.orders) * 100)
})

const inProgress = computed(() => {
  const t = totals.value
  if (!t) return 0
  return Math.max(0, t.orders - t.delivered - t.cancelled)
})

const topProductsList = computed(() => topProducts.value?.products ?? [])
const topProductsMax = computed(() => topProductsList.value[0]?.quantity ?? 1)

const isEmpty = computed(() =>
  !ordersLoading.value
  && !revenueLoading.value
  && !ordersError.value
  && !revenueError.value
  && (ordersPerDay.value?.totals.orders ?? 0) === 0
  && (revenue.value?.paidOrders ?? 0) === 0,
)

// ── Chart data ────────────────────────────────────────────────────────────────
const ordersLineData = computed(() => {
  // Le serveur garantit des points contigus et zéro-remplis : aucun remplissage client.
  const points = ordersPerDay.value?.points ?? []
  return {
    labels: points.map(p => fmtDayShort(p.date)),
    datasets: [{
      label: 'Commandes',
      data: points.map(p => p.orders),
      borderColor: '#8B5CF6',
      backgroundColor: 'rgba(139,92,246,0.1)',
      tension: 0.4,
      fill: true,
      pointBackgroundColor: '#8B5CF6',
      pointHoverBackgroundColor: '#fff',
      pointRadius: 4,
      pointHoverRadius: 6,
    }],
  }
})

const revenueBarData = computed(() => {
  const buckets = revenue.value?.buckets ?? []
  const monthly = revenue.value?.granularity === 'month'
  return {
    labels: buckets.map(b => (monthly ? fmtMonthShort(b.date) : fmtDayShort(b.date))),
    datasets: [{
      label: 'Revenus (€)',
      data: buckets.map(b => b.revenue),
      backgroundColor: 'rgba(16,185,129,0.75)',
      borderColor: '#10B981',
      borderWidth: 1.5,
      borderRadius: 6,
      borderSkipped: false,
    }],
  }
})

// ── Chart options ─────────────────────────────────────────────────────────────
const chartDefaults = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index' as const, intersect: false },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#1E1B2E',
      titleColor: '#C4B5FD',
      bodyColor: '#E5E7EB',
      padding: 10,
      cornerRadius: 8,
    },
  },
  scales: {
    x: {
      grid: { color: 'rgba(0,0,0,0.04)' },
      ticks: { color: '#9CA3AF', font: { size: 11 }, maxTicksLimit: period.value > 30 ? 15 : period.value > 7 ? 10 : 7 },
    },
    y: {
      grid: { color: 'rgba(0,0,0,0.04)' },
      ticks: { color: '#9CA3AF', font: { size: 11 } },
      beginAtZero: true,
    },
  },
}))

const lineOptions = computed(() => ({
  ...chartDefaults.value,
  scales: {
    ...chartDefaults.value.scales,
    y: {
      ...chartDefaults.value.scales.y,
      ticks: { ...chartDefaults.value.scales.y.ticks, precision: 0 },
    },
  },
}))

const barOptions = computed(() => ({
  ...chartDefaults.value,
  plugins: {
    ...chartDefaults.value.plugins,
    tooltip: {
      ...chartDefaults.value.plugins.tooltip,
      callbacks: { label: (ctx: { raw: unknown }) => ` ${Number(ctx.raw).toFixed(2)} €` },
    },
  },
}))
</script>

<template>
  <div class="min-h-screen bg-neutral-50">
    <!-- ═══ Header ═══ -->
    <div class="relative overflow-hidden bg-section-dark px-6 py-12 sm:px-10">
      <div class="pointer-events-none absolute -right-20 -top-20 size-80 rounded-full bg-sky-500/15 blur-3xl" />
      <div class="pointer-events-none absolute -bottom-10 -left-10 size-64 rounded-full bg-primary-400/10 blur-2xl" />

      <div class="relative mx-auto max-w-7xl">
        <NuxtLink
          to="/admin"
          class="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-body-sm font-medium text-neutral-300 backdrop-blur-sm transition hover:bg-white/15 hover:text-white"
        >
          <Icon name="ph:arrow-left" class="size-4" /> Admin
        </NuxtLink>

        <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 class="text-h1 font-semibold text-white">
              Analytics
            </h1>
            <p class="mt-1 text-body text-neutral-400">
              Vue d'ensemble de l'activité EzTech — {{ periodLabel }} (heure de Paris)
            </p>
          </div>

          <!-- Period selector -->
          <div class="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/8 p-1 backdrop-blur-sm">
            <button
              v-for="p in [7, 30, 90] as const"
              :key="p"
              class="rounded-xl px-4 py-2 text-body-sm font-medium transition outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              :class="period === p
                ? 'bg-primary-500 text-white shadow-sm'
                : 'text-neutral-400 hover:text-white'"
              @click="period = p"
            >
              {{ p }}j
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══ Content ═══ -->
    <div class="mx-auto max-w-7xl px-6 py-8 sm:px-10 space-y-8">
      <!-- Erreur globale : les cinq requêtes ont échoué -->
      <div v-if="pageError" class="rounded-2xl border border-error/20 bg-error/5 p-8 text-center">
        <Icon name="ph:warning-circle" class="mx-auto mb-3 size-10 text-error" />
        <p class="text-body font-medium text-error">
          {{ pageError }}
        </p>
        <button
          class="mt-4 rounded-xl bg-primary-600 px-5 py-2 text-body-sm font-medium text-white transition hover:bg-primary-700 outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          @click="loadAll"
        >
          Réessayer
        </button>
      </div>

      <template v-else>
        <!-- ── KPI Cards ── -->
        <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <!-- Commandes -->
          <div class="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <div v-if="ordersLoading" class="space-y-2">
              <div class="h-8 w-16 animate-pulse rounded-lg bg-neutral-100" />
              <div class="h-3 w-24 animate-pulse rounded bg-neutral-100" />
            </div>
            <p v-else-if="ordersError" class="text-body-sm text-error">
              {{ ordersError }}
            </p>
            <template v-else>
              <div class="flex items-center justify-between">
                <div class="flex size-10 items-center justify-center rounded-xl bg-primary-100">
                  <Icon name="ph:receipt" class="size-5 text-primary-600" />
                </div>
                <span class="text-caption font-medium text-emerald-600">
                  {{ deliveryRate }}% livrées
                </span>
              </div>
              <p class="mt-3 text-h3 font-bold text-text-primary">
                {{ totals?.orders ?? 0 }}
              </p>
              <p class="text-caption text-text-muted">
                Commandes ({{ period }}j)
              </p>
            </template>
          </div>

          <!-- Revenus -->
          <div class="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <div v-if="revenueLoading" class="space-y-2">
              <div class="h-8 w-20 animate-pulse rounded-lg bg-neutral-100" />
              <div class="h-3 w-24 animate-pulse rounded bg-neutral-100" />
            </div>
            <p v-else-if="revenueError" class="text-body-sm text-error">
              {{ revenueError }}
            </p>
            <template v-else>
              <div class="flex size-10 items-center justify-center rounded-xl bg-emerald-100">
                <Icon name="ph:wallet" class="size-5 text-emerald-600" />
              </div>
              <p class="mt-3 text-h3 font-bold text-text-primary">
                {{ fmtMoney(revenue?.total ?? 0) }} €
              </p>
              <p class="text-caption text-text-muted">
                Revenus payés · {{ revenue?.paidOrders ?? 0 }} {{ plural(revenue?.paidOrders ?? 0, 'commande', 'commandes') }}
              </p>
              <p class="mt-1 text-caption text-text-muted">
                Panier moyen {{ fmtMoney(revenue?.averageOrderValue ?? 0) }} €
              </p>
            </template>
          </div>

          <!-- Délai moyen de livraison -->
          <div class="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <div v-if="deliveryTimeLoading" class="space-y-2">
              <div class="h-8 w-16 animate-pulse rounded-lg bg-neutral-100" />
              <div class="h-3 w-28 animate-pulse rounded bg-neutral-100" />
            </div>
            <p v-else-if="deliveryTimeError" class="text-body-sm text-error">
              {{ deliveryTimeError }}
            </p>
            <template v-else>
              <div class="flex size-10 items-center justify-center rounded-xl bg-amber-100">
                <Icon name="ph:clock" class="size-5 text-amber-600" />
              </div>
              <p class="mt-3 text-h3 font-bold text-text-primary">
                {{ fmtMinutes(deliveryTime?.averageMinutes) }}
              </p>
              <p class="text-caption text-text-muted">
                Délai moyen retrait → livraison
              </p>
              <p class="mt-1 text-caption text-text-muted">
                Médiane {{ fmtMinutes(deliveryTime?.medianMinutes) }} · {{ deliveryTime?.sampleSize ?? 0 }}
                {{ plural(deliveryTime?.sampleSize ?? 0, 'livraison mesurée', 'livraisons mesurées') }}
              </p>
              <p v-if="(deliveryTime?.excludedMissingPickupEvent ?? 0) > 0" class="mt-1 text-caption text-amber-600">
                {{ deliveryTime?.excludedMissingPickupEvent }}
                {{ plural(deliveryTime?.excludedMissingPickupEvent ?? 0, 'livraison sans événement de retrait, exclue', 'livraisons sans événement de retrait, exclues') }}
                de la moyenne
              </p>
            </template>
          </div>

          <!-- Livreurs -->
          <div class="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <div v-if="ridersLoading" class="space-y-2">
              <div class="h-8 w-12 animate-pulse rounded-lg bg-neutral-100" />
              <div class="h-3 w-24 animate-pulse rounded bg-neutral-100" />
            </div>
            <p v-else-if="ridersError" class="text-body-sm text-error">
              {{ ridersError }}
            </p>
            <template v-else>
              <div class="flex size-10 items-center justify-center rounded-xl bg-violet-100">
                <Icon name="ph:motorcycle" class="size-5 text-violet-600" />
              </div>
              <p class="mt-3 text-h3 font-bold text-text-primary">
                {{ riders?.activeInPeriod ?? 0 }}
              </p>
              <p class="text-caption text-text-muted">
                Livreurs actifs sur la période
              </p>
              <p class="mt-1 text-caption text-text-muted">
                {{ riders?.onlineNow ?? 0 }} en ligne maintenant · {{ riders?.approvedRiders ?? 0 }}
                {{ plural(riders?.approvedRiders ?? 0, 'approuvé', 'approuvés') }}
              </p>
            </template>
          </div>
        </div>

        <!-- Empty state -->
        <EmptyState
          v-if="isEmpty"
          title="Aucune donnée sur cette période"
          description="Aucune commande enregistrée entre ces deux dates. Essayez d'élargir la fenêtre temporelle."
        >
          <template #icon>
            <Icon name="ph:chart-line-up" class="size-9 text-primary-500" />
          </template>
          <template #actions>
            <button
              class="rounded-xl border border-neutral-200 px-5 py-2 text-body-sm font-medium text-text-secondary transition hover:bg-neutral-50 outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              @click="period = 90"
            >
              Voir les 90 derniers jours
            </button>
          </template>
        </EmptyState>

        <template v-else>
          <!-- ── Charts row ── -->
          <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <!-- Line: commandes/jour -->
            <div class="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
              <div class="mb-4 flex items-center justify-between">
                <div>
                  <h2 class="text-body font-semibold text-text-primary">
                    Commandes / jour
                  </h2>
                  <p class="text-caption text-text-muted">
                    {{ period }} derniers jours · {{ totals?.orders ?? 0 }} au total
                  </p>
                </div>
                <div class="flex size-9 items-center justify-center rounded-xl bg-primary-100">
                  <Icon name="ph:chart-line-up" class="size-5 text-primary-600" />
                </div>
              </div>

              <div v-if="ordersLoading" class="h-56 animate-pulse rounded-xl bg-neutral-100" />
              <div v-else-if="ordersError" class="flex h-56 flex-col items-center justify-center gap-3 rounded-xl bg-neutral-50">
                <p class="text-body-sm text-error">
                  {{ ordersError }}
                </p>
                <button
                  class="rounded-xl border border-neutral-200 bg-white px-4 py-1.5 text-body-sm font-medium text-text-secondary transition hover:bg-neutral-50 outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                  @click="loadAll"
                >
                  Réessayer
                </button>
              </div>
              <div v-else-if="chartsReady" class="h-56">
                <component :is="LineChart" :data="ordersLineData" :options="lineOptions" />
              </div>
              <div v-else class="h-56 animate-pulse rounded-xl bg-neutral-100" />
            </div>

            <!-- Bar: revenus -->
            <div class="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
              <div class="mb-4 flex items-center justify-between">
                <div>
                  <h2 class="text-body font-semibold text-text-primary">
                    Revenus
                  </h2>
                  <p class="text-caption text-text-muted">
                    {{ periodLabel }} · commandes payées uniquement
                  </p>
                </div>
                <div class="flex size-9 items-center justify-center rounded-xl bg-emerald-100">
                  <Icon name="ph:chart-bar" class="size-5 text-emerald-600" />
                </div>
              </div>

              <div v-if="revenueLoading" class="h-56 animate-pulse rounded-xl bg-neutral-100" />
              <div v-else-if="revenueError" class="flex h-56 flex-col items-center justify-center gap-3 rounded-xl bg-neutral-50">
                <p class="text-body-sm text-error">
                  {{ revenueError }}
                </p>
                <button
                  class="rounded-xl border border-neutral-200 bg-white px-4 py-1.5 text-body-sm font-medium text-text-secondary transition hover:bg-neutral-50 outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                  @click="loadAll"
                >
                  Réessayer
                </button>
              </div>
              <template v-else>
                <div class="mb-3 flex items-baseline gap-3">
                  <span class="text-h4 font-bold text-text-primary">{{ fmtMoney(revenue?.total ?? 0) }} €</span>
                  <span class="text-caption text-text-muted">panier moyen {{ fmtMoney(revenue?.averageOrderValue ?? 0) }} €</span>
                </div>
                <div v-if="chartsReady" class="h-56">
                  <component :is="BarChart" :data="revenueBarData" :options="barOptions" />
                </div>
                <div v-else class="h-56 animate-pulse rounded-xl bg-neutral-100" />
                <p v-if="(revenue?.ordersMissingTotal ?? 0) > 0" class="mt-3 text-caption text-amber-600">
                  {{ revenue?.ordersMissingTotal }}
                  {{ plural(revenue?.ordersMissingTotal ?? 0, 'commande payée sans montant enregistré, exclue', 'commandes payées sans montant enregistré, exclues') }}
                  du total.
                </p>
              </template>
            </div>
          </div>

          <!-- ── Bottom row ── -->
          <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <!-- Top 5 produits -->
            <div class="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
              <div class="mb-5 flex items-center justify-between">
                <div>
                  <h2 class="text-body font-semibold text-text-primary">
                    Top 5 produits loués
                  </h2>
                  <p class="text-caption text-text-muted">
                    Par quantité sur la période
                  </p>
                </div>
                <div class="flex size-9 items-center justify-center rounded-xl bg-amber-100">
                  <Icon name="ph:star" class="size-5 text-amber-600" />
                </div>
              </div>

              <!-- Skeleton -->
              <div v-if="topProductsLoading" class="space-y-4">
                <div v-for="i in 5" :key="i" class="flex items-center gap-3">
                  <div class="h-4 w-6 shrink-0 animate-pulse rounded bg-neutral-100" />
                  <div class="h-3 flex-1 animate-pulse rounded-full bg-neutral-100" />
                  <div class="h-4 w-10 animate-pulse rounded bg-neutral-100" />
                </div>
              </div>

              <!-- Erreur -->
              <div v-else-if="topProductsError" class="py-8 text-center">
                <p class="text-body-sm text-error">
                  {{ topProductsError }}
                </p>
              </div>

              <!-- Empty -->
              <div v-else-if="topProductsList.length === 0" class="py-8 text-center">
                <Icon name="ph:package" class="mx-auto mb-2 size-8 text-neutral-200" />
                <p class="text-body-sm text-text-muted">
                  Aucune donnée produit
                </p>
              </div>

              <!-- List -->
              <ol v-else class="space-y-3">
                <li
                  v-for="(p, i) in topProductsList"
                  :key="p.name"
                  class="flex items-center gap-3"
                >
                  <span
                    class="flex size-6 shrink-0 items-center justify-center rounded-full text-caption font-bold"
                    :class="i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-neutral-300 text-white' : i === 2 ? 'bg-amber-700 text-white' : 'bg-neutral-100 text-text-muted'"
                  >
                    {{ i + 1 }}
                  </span>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center justify-between gap-2">
                      <p class="truncate text-body-sm font-medium text-text-primary">
                        {{ p.name }}
                      </p>
                      <span class="shrink-0 text-body-sm font-semibold text-text-primary">
                        ×{{ p.quantity }}
                      </span>
                    </div>
                    <div class="mt-1.5 flex items-center gap-2">
                      <div class="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                        <div
                          class="h-full rounded-full bg-amber-400 transition-all duration-500"
                          :style="{ width: `${Math.round((p.quantity / topProductsMax) * 100)}%` }"
                        />
                      </div>
                      <span class="shrink-0 text-caption text-text-muted">{{ fmtMoney(p.revenue) }} €</span>
                    </div>
                  </div>
                </li>
              </ol>
            </div>

            <!-- Stats supplémentaires -->
            <div class="space-y-4">
              <!-- Statut breakdown -->
              <div class="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                <h2 class="mb-4 text-body font-semibold text-text-primary">
                  Répartition des statuts
                </h2>

                <div v-if="ordersLoading" class="space-y-3">
                  <div v-for="i in 3" :key="i" class="h-10 animate-pulse rounded-xl bg-neutral-100" />
                </div>

                <div v-else-if="ordersError" class="py-6 text-center text-body-sm text-error">
                  {{ ordersError }}
                </div>

                <div v-else-if="!totals || totals.orders === 0" class="py-6 text-center text-body-sm text-text-muted">
                  Aucune donnée
                </div>

                <div v-else class="space-y-2.5">
                  <div
                    v-for="row in [
                      { label: 'Livrées', value: totals.delivered, color: 'bg-emerald-500', icon: 'ph:check-circle' },
                      { label: 'Annulées', value: totals.cancelled, color: 'bg-red-400', icon: 'ph:x-circle' },
                      { label: 'En cours', value: inProgress, color: 'bg-primary-500', icon: 'ph:clock' },
                    ]"
                    :key="row.label"
                    class="flex items-center gap-3 rounded-xl border border-neutral-100 px-4 py-3"
                  >
                    <Icon :name="row.icon" class="size-4 text-text-muted" />
                    <span class="flex-1 text-body-sm text-text-secondary">{{ row.label }}</span>
                    <div class="flex items-center gap-2">
                      <div class="w-20 overflow-hidden rounded-full bg-neutral-100 h-1.5">
                        <div
                          class="h-full rounded-full transition-all duration-500"
                          :class="row.color"
                          :style="{ width: totals.orders ? `${Math.round((row.value / totals.orders) * 100)}%` : '0%' }"
                        />
                      </div>
                      <span class="w-6 text-right text-body-sm font-semibold text-text-primary">{{ row.value }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Top livreurs -->
              <div class="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                <h2 class="mb-4 text-body font-semibold text-text-primary">
                  Top livreurs
                </h2>

                <div v-if="ridersLoading" class="space-y-3">
                  <div v-for="i in 3" :key="i" class="h-6 animate-pulse rounded-lg bg-neutral-100" />
                </div>

                <div v-else-if="ridersError" class="py-4 text-center text-body-sm text-error">
                  {{ ridersError }}
                </div>

                <div v-else-if="(riders?.topRiders.length ?? 0) === 0" class="py-4 text-center text-body-sm text-text-muted">
                  Aucune livraison sur la période
                </div>

                <ul v-else class="space-y-2.5">
                  <li
                    v-for="r in riders?.topRiders ?? []"
                    :key="r.riderId"
                    class="flex items-center justify-between gap-3"
                  >
                    <span class="truncate text-body-sm text-text-secondary">{{ r.name }}</span>
                    <span class="shrink-0 text-body-sm font-semibold text-text-primary">
                      {{ r.deliveries }} {{ plural(r.deliveries, 'livraison', 'livraisons') }}
                    </span>
                  </li>
                </ul>
              </div>

              <!-- Recap -->
              <div class="grid grid-cols-2 gap-4">
                <div class="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm text-center">
                  <div v-if="ordersLoading" class="mx-auto h-8 w-16 animate-pulse rounded-lg bg-neutral-100" />
                  <template v-else>
                    <p class="text-h4 font-bold text-primary-600">
                      {{ totals?.delivered ?? 0 }}
                    </p>
                    <p class="mt-1 text-caption text-text-muted">
                      Livraisons réussies
                    </p>
                  </template>
                </div>
                <div class="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm text-center">
                  <div v-if="ordersLoading" class="mx-auto h-8 w-16 animate-pulse rounded-lg bg-neutral-100" />
                  <template v-else>
                    <p class="text-h4 font-bold text-emerald-600">
                      {{ deliveryRate }}%
                    </p>
                    <p class="mt-1 text-caption text-text-muted">
                      Taux de livraison
                    </p>
                  </template>
                </div>
              </div>
            </div>
          </div>
        </template>
      </template>
    </div>
  </div>
</template>
