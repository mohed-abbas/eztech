<script setup lang="ts">

definePageMeta({ layout: 'default', middleware: ['auth', 'role'], role: 'admin' })
useHead({ title: 'Analytics — Admin EzTech' })

// ── Dynamic chart import (client-only) ────────────────────────────────────────
// Top-level imports of chart.js / vue-chartjs break Vite SSR module resolution.
// We lazy-load everything inside onMounted so the server never touches these modules.
const LineChart = shallowRef(null)
const BarChart = shallowRef(null)
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

// ── Types ─────────────────────────────────────────────────────────────────────
interface OrderItem {
  id: string
  name: string
  quantity: number
  lineTotal: string | number
}

interface AdminOrder {
  id: string
  reference: string
  status: string
  paymentStatus: string
  customerId: string | null
  riderId: string | null
  total: string | number
  createdAt: string
  deliveredAt: string | null
  items: OrderItem[]
}

// ── State ─────────────────────────────────────────────────────────────────────
const orders = ref<AdminOrder[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const period = ref<30 | 7 | 90>(30)

// ── Fetch ─────────────────────────────────────────────────────────────────────
async function fetchOrders() {
  loading.value = true
  error.value = null
  auth.hydrate()
  try {
    const data = await adminFetch<{ orders: AdminOrder[] }>('/orders')
    orders.value = data.orders
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : 'Erreur de chargement'
  }
  finally { loading.value = false }
}

onMounted(fetchOrders)

// ── Period filter ─────────────────────────────────────────────────────────────
const periodStart = computed(() => {
  const d = new Date()
  d.setDate(d.getDate() - period.value)
  d.setHours(0, 0, 0, 0)
  return d
})

const periodOrders = computed(() =>
  orders.value.filter(o => new Date(o.createdAt) >= periodStart.value),
)

// ── KPIs ──────────────────────────────────────────────────────────────────────
const stats = computed(() => {
  const os = periodOrders.value

  const revenue = os
    .filter(o => o.paymentStatus === 'paid')
    .reduce((s, o) => s + Number(o.total), 0)

  const activeRiders = new Set(
    os.filter(o => o.riderId).map(o => o.riderId!),
  ).size

  const delivered = os.filter(o => o.status === 'delivered' && o.deliveredAt)
  const avgDeliveryHours = delivered.length
    ? delivered.reduce((acc, o) => {
        return acc + (new Date(o.deliveredAt!).getTime() - new Date(o.createdAt).getTime()) / 3_600_000
      }, 0) / delivered.length
    : null

  return {
    totalOrders: os.length,
    revenue,
    activeRiders,
    avgDeliveryHours,
    delivered: delivered.length,
    cancelled: os.filter(o => o.status === 'cancelled').length,
    conversionRate: os.length ? Math.round((delivered.length / os.length) * 100) : 0,
  }
})

// ── Day helpers ───────────────────────────────────────────────────────────────
function dayLabel(date: Date): string {
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function buildDayLabels(): string[] {
  return Array.from({ length: period.value }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (period.value - 1 - i))
    return dayLabel(d)
  })
}

function orderDayLabel(iso: string): string {
  return dayLabel(new Date(iso))
}

// ── Line chart: commandes/jour ─────────────────────────────────────────────────
const ordersLineData = computed(() => {
  const labels = buildDayLabels()
  const counts: Record<string, number> = Object.fromEntries(labels.map(l => [l, 0]))
  periodOrders.value.forEach(o => {
    const k = orderDayLabel(o.createdAt)
    if (k in counts) counts[k]++
  })
  return {
    labels,
    datasets: [{
      label: 'Commandes',
      data: labels.map(l => counts[l]),
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

// ── Bar chart: revenus/jour ────────────────────────────────────────────────────
const revenueBarData = computed(() => {
  const labels = buildDayLabels()
  const rev: Record<string, number> = Object.fromEntries(labels.map(l => [l, 0]))
  periodOrders.value
    .filter(o => o.paymentStatus === 'paid')
    .forEach(o => {
      const k = orderDayLabel(o.createdAt)
      if (k in rev) rev[k] += Number(o.total)
    })
  return {
    labels,
    datasets: [{
      label: 'Revenus (€)',
      data: labels.map(l => rev[l]),
      backgroundColor: 'rgba(16,185,129,0.75)',
      borderColor: '#10B981',
      borderWidth: 1.5,
      borderRadius: 6,
      borderSkipped: false,
    }],
  }
})

// ── Top 5 produits ─────────────────────────────────────────────────────────────
const topProducts = computed(() => {
  const counts: Record<string, { name: string; qty: number; revenue: number }> = {}
  periodOrders.value.forEach(o => {
    o.items?.forEach(item => {
      if (!counts[item.name]) counts[item.name] = { name: item.name, qty: 0, revenue: 0 }
      counts[item.name]!.qty += item.quantity
      counts[item.name]!.revenue += Number(item.lineTotal)
    })
  })
  return Object.values(counts)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5)
})

const topProductsMax = computed(() => topProducts.value[0]?.qty ?? 1)

// ── Chart options ─────────────────────────────────────────────────────────────
const chartDefaults = {
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
}

const lineOptions = {
  ...chartDefaults,
  scales: {
    ...chartDefaults.scales,
    y: { ...chartDefaults.scales.y, ticks: { ...chartDefaults.scales.y.ticks, precision: 0 } },
  },
}

const barOptions = {
  ...chartDefaults,
  plugins: {
    ...chartDefaults.plugins,
    tooltip: {
      ...chartDefaults.plugins.tooltip,
      callbacks: { label: (ctx: { raw: unknown }) => ` ${Number(ctx.raw).toFixed(2)} €` },
    },
  },
}

// ── Formatters ────────────────────────────────────────────────────────────────
function fmtHours(h: number | null): string {
  if (h === null) return '—'
  if (h < 1) return `${Math.round(h * 60)} min`
  return `${h.toFixed(1)} h`
}

const hasData = computed(() => periodOrders.value.length > 0)
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
              Vue d'ensemble de l'activité EzTech
            </p>
          </div>

          <!-- Period selector -->
          <div class="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/8 p-1 backdrop-blur-sm">
            <button
              v-for="p in [7, 30, 90] as const"
              :key="p"
              class="rounded-xl px-4 py-2 text-body-sm font-medium transition"
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
      <!-- Error -->
      <div v-if="error" class="rounded-2xl border border-error/20 bg-error/5 p-8 text-center">
        <Icon name="ph:warning-circle" class="mx-auto mb-3 size-10 text-error" />
        <p class="text-body font-medium text-error">
          {{ error }}
        </p>
        <button
          class="mt-4 rounded-xl bg-primary-600 px-5 py-2 text-body-sm font-medium text-white transition hover:bg-primary-700"
          @click="fetchOrders"
        >
          Réessayer
        </button>
      </div>

      <template v-else>
        <!-- ── KPI Cards ── -->
        <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <!-- Commandes -->
          <div class="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <div v-if="loading" class="space-y-2">
              <div class="h-8 w-16 animate-pulse rounded-lg bg-neutral-100" />
              <div class="h-3 w-24 animate-pulse rounded bg-neutral-100" />
            </div>
            <template v-else>
              <div class="flex items-center justify-between">
                <div class="flex size-10 items-center justify-center rounded-xl bg-primary-100">
                  <Icon name="ph:receipt" class="size-5 text-primary-600" />
                </div>
                <span class="text-caption font-medium text-emerald-600">
                  {{ stats.conversionRate }}% livrées
                </span>
              </div>
              <p class="mt-3 text-h3 font-bold text-text-primary">
                {{ stats.totalOrders }}
              </p>
              <p class="text-caption text-text-muted">
                Commandes ({{ period }}j)
              </p>
            </template>
          </div>

          <!-- Revenus -->
          <div class="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <div v-if="loading" class="space-y-2">
              <div class="h-8 w-20 animate-pulse rounded-lg bg-neutral-100" />
              <div class="h-3 w-24 animate-pulse rounded bg-neutral-100" />
            </div>
            <template v-else>
              <div class="flex size-10 items-center justify-center rounded-xl bg-emerald-100">
                <Icon name="ph:wallet" class="size-5 text-emerald-600" />
              </div>
              <p class="mt-3 text-h3 font-bold text-text-primary">
                {{ fmtMoney(stats.revenue) }} €
              </p>
              <p class="text-caption text-text-muted">
                Revenus payés
              </p>
            </template>
          </div>

          <!-- Temps de livraison moyen -->
          <div class="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <div v-if="loading" class="space-y-2">
              <div class="h-8 w-16 animate-pulse rounded-lg bg-neutral-100" />
              <div class="h-3 w-28 animate-pulse rounded bg-neutral-100" />
            </div>
            <template v-else>
              <div class="flex size-10 items-center justify-center rounded-xl bg-amber-100">
                <Icon name="ph:clock" class="size-5 text-amber-600" />
              </div>
              <p class="mt-3 text-h3 font-bold text-text-primary">
                {{ fmtHours(stats.avgDeliveryHours) }}
              </p>
              <p class="text-caption text-text-muted">
                Délai moyen de livraison
              </p>
            </template>
          </div>

          <!-- Livreurs actifs -->
          <div class="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <div v-if="loading" class="space-y-2">
              <div class="h-8 w-12 animate-pulse rounded-lg bg-neutral-100" />
              <div class="h-3 w-24 animate-pulse rounded bg-neutral-100" />
            </div>
            <template v-else>
              <div class="flex size-10 items-center justify-center rounded-xl bg-violet-100">
                <Icon name="ph:motorcycle" class="size-5 text-violet-600" />
              </div>
              <p class="mt-3 text-h3 font-bold text-text-primary">
                {{ stats.activeRiders }}
              </p>
              <p class="text-caption text-text-muted">
                Livreurs actifs
              </p>
            </template>
          </div>
        </div>

        <!-- Empty state -->
        <div
          v-if="!loading && !hasData"
          class="rounded-2xl border border-neutral-200 bg-white p-16 text-center shadow-sm"
        >
          <Icon name="ph:chart-line-up" class="mx-auto mb-4 size-14 text-neutral-200" />
          <p class="text-body font-semibold text-text-primary">
            Aucune donnée sur cette période
          </p>
          <p class="mt-1 text-body-sm text-text-muted">
            Essayez d'élargir la fenêtre temporelle.
          </p>
          <button
            class="mt-4 rounded-xl border border-neutral-200 px-5 py-2 text-body-sm font-medium text-text-secondary transition hover:bg-neutral-50"
            @click="period = 90"
          >
            Voir les 90 derniers jours
          </button>
        </div>

        <template v-else-if="hasData || loading">
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
                    {{ period }} derniers jours
                  </p>
                </div>
                <div class="flex size-9 items-center justify-center rounded-xl bg-primary-100">
                  <Icon name="ph:chart-line-up" class="size-5 text-primary-600" />
                </div>
              </div>

              <div v-if="loading" class="h-56 animate-pulse rounded-xl bg-neutral-100" />
              <div v-else-if="chartsReady" class="h-56">
                <component :is="LineChart" :data="ordersLineData" :options="lineOptions" />
              </div>
              <div v-else class="h-56 animate-pulse rounded-xl bg-neutral-100" />
            </div>

            <!-- Bar: revenus/jour -->
            <div class="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
              <div class="mb-4 flex items-center justify-between">
                <div>
                  <h2 class="text-body font-semibold text-text-primary">
                    Revenus / jour
                  </h2>
                  <p class="text-caption text-text-muted">
                    Commandes payées uniquement
                  </p>
                </div>
                <div class="flex size-9 items-center justify-center rounded-xl bg-emerald-100">
                  <Icon name="ph:chart-bar" class="size-5 text-emerald-600" />
                </div>
              </div>

              <div v-if="loading" class="h-56 animate-pulse rounded-xl bg-neutral-100" />
              <div v-else-if="chartsReady" class="h-56">
                <component :is="BarChart" :data="revenueBarData" :options="barOptions" />
              </div>
              <div v-else class="h-56 animate-pulse rounded-xl bg-neutral-100" />
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
              <div v-if="loading" class="space-y-4">
                <div v-for="i in 5" :key="i" class="flex items-center gap-3">
                  <div class="h-4 w-6 shrink-0 animate-pulse rounded bg-neutral-100" />
                  <div class="h-3 flex-1 animate-pulse rounded-full bg-neutral-100" />
                  <div class="h-4 w-10 animate-pulse rounded bg-neutral-100" />
                </div>
              </div>

              <!-- Empty -->
              <div v-else-if="topProducts.length === 0" class="py-8 text-center">
                <Icon name="ph:package" class="mx-auto mb-2 size-8 text-neutral-200" />
                <p class="text-body-sm text-text-muted">
                  Aucune donnée produit
                </p>
              </div>

              <!-- List -->
              <ol v-else class="space-y-3">
                <li
                  v-for="(p, i) in topProducts"
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
                        ×{{ p.qty }}
                      </span>
                    </div>
                    <div class="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                      <div
                        class="h-full rounded-full bg-amber-400 transition-all duration-500"
                        :style="{ width: `${Math.round((p.qty / topProductsMax) * 100)}%` }"
                      />
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

                <div v-if="loading" class="space-y-3">
                  <div v-for="i in 3" :key="i" class="h-10 animate-pulse rounded-xl bg-neutral-100" />
                </div>

                <div v-else-if="!hasData" class="py-6 text-center text-body-sm text-text-muted">
                  Aucune donnée
                </div>

                <div v-else class="space-y-2.5">
                  <div
                    v-for="row in [
                      { label: 'Livrées', value: stats.delivered, color: 'bg-emerald-500', icon: 'ph:check-circle' },
                      { label: 'Annulées', value: stats.cancelled, color: 'bg-red-400', icon: 'ph:x-circle' },
                      { label: 'En cours', value: stats.totalOrders - stats.delivered - stats.cancelled, color: 'bg-primary-500', icon: 'ph:clock' },
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
                          :style="{ width: stats.totalOrders ? `${Math.round((row.value / stats.totalOrders) * 100)}%` : '0%' }"
                        />
                      </div>
                      <span class="w-6 text-right text-body-sm font-semibold text-text-primary">{{ row.value }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Revenue & orders totals recap -->
              <div class="grid grid-cols-2 gap-4">
                <div class="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm text-center">
                  <div v-if="loading" class="mx-auto h-8 w-16 animate-pulse rounded-lg bg-neutral-100" />
                  <template v-else>
                    <p class="text-h4 font-bold text-primary-600">
                      {{ stats.delivered }}
                    </p>
                    <p class="mt-1 text-caption text-text-muted">
                      Livraisons réussies
                    </p>
                  </template>
                </div>
                <div class="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm text-center">
                  <div v-if="loading" class="mx-auto h-8 w-16 animate-pulse rounded-lg bg-neutral-100" />
                  <template v-else>
                    <p class="text-h4 font-bold text-emerald-600">
                      {{ stats.conversionRate }}%
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
