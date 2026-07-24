<script setup lang="ts">
import { STATUS_CONFIG } from '~/stores/orders'

definePageMeta({
  layout: 'default',
  middleware: ['auth', 'role'],
  role: 'admin',
})

useHead({ title: 'Commandes — Admin EzTech' })

// ── Types ────────────────────────────────────────────────────────────────────
interface OrderEvent {
  id: string
  status: string
  note: string | null
  createdAt: string
}

interface OrderItem {
  id: string
  name: string
  quantity: number
  unitPrice: string | number
  lineTotal: string | number
  durationUnit: string
  durationValue: number
}

interface AdminOrder {
  id: string
  reference: string
  status: string
  paymentStatus: string
  customerId: string | null
  riderId: string | null
  total: string | number
  subtotal: string | number
  deliveryFee: string | number
  pickupAddress: string | null
  dropoffAddress: string | null
  createdAt: string
  deliveredAt: string | null
  items: OrderItem[]
  events?: OrderEvent[]
}

// ── Composable ───────────────────────────────────────────────────────────────
const { adminFetch, fmtMoney } = useAdminApi()

// ── State ────────────────────────────────────────────────────────────────────
const config = useRuntimeConfig()
const auth = useAuthStore()

const orders = ref<AdminOrder[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

// Filters
const searchQuery = ref('')
const statusFilter = ref<string>('all')
const dateFrom = ref('')
const dateTo = ref('')

// Detail modal
const selectedOrder = ref<AdminOrder | null>(null)
const loadingDetail = ref(false)
const showModal = ref(false)

// Cancel
const cancelling = ref(false)
const cancelError = ref<string | null>(null)

// ── Fetch all orders ─────────────────────────────────────────────────────────
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
  finally {
    loading.value = false
  }
}

onMounted(fetchOrders)

// ── Computed filters ──────────────────────────────────────────────────────────
const STATUS_OPTIONS = [
  { value: 'all', label: 'Tous les statuts' },
  { value: 'awaiting_payment', label: 'En attente de paiement' },
  { value: 'pending_assignment', label: 'En attente de livreur' },
  { value: 'rider_assigned', label: 'Livreur assigné' },
  { value: 'picked_up', label: 'Récupérée' },
  { value: 'in_transit', label: 'En route' },
  { value: 'delivered', label: 'Livrée' },
  { value: 'cancelled', label: 'Annulée' },
]

const filteredOrders = computed(() => {
  let result = orders.value

  if (statusFilter.value !== 'all') {
    result = result.filter(o => o.status === statusFilter.value)
  }

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase()
    result = result.filter(o =>
      o.reference.toLowerCase().includes(q)
      || o.id.toLowerCase().includes(q)
      || (o.customerId ?? '').toLowerCase().includes(q)
      || (o.dropoffAddress ?? '').toLowerCase().includes(q),
    )
  }

  if (dateFrom.value) {
    const from = new Date(dateFrom.value)
    result = result.filter(o => new Date(o.createdAt) >= from)
  }
  if (dateTo.value) {
    const to = new Date(dateTo.value)
    to.setHours(23, 59, 59)
    result = result.filter(o => new Date(o.createdAt) <= to)
  }

  return result
})

// Stats
const stats = computed(() => ({
  total: orders.value.length,
  active: orders.value.filter(o => ['pending_assignment', 'rider_assigned', 'picked_up', 'in_transit'].includes(o.status)).length,
  delivered: orders.value.filter(o => o.status === 'delivered').length,
  revenue: orders.value
    .filter(o => o.paymentStatus === 'paid')
    .reduce((s, o) => s + Number(o.total), 0),
}))

// ── Open detail ───────────────────────────────────────────────────────────────
async function openDetail(order: AdminOrder) {
  showModal.value = true
  cancelError.value = null
  selectedOrder.value = order

  loadingDetail.value = true
  try {
    const data = await adminFetch<{ order: AdminOrder }>(`/orders/${order.id}`)
    selectedOrder.value = data.order
  }
  catch { /* keep the list-level data */ }
  finally {
    loadingDetail.value = false
  }
}

function closeModal() {
  showModal.value = false
  selectedOrder.value = null
  cancelError.value = null
}

// ── Cancel order ──────────────────────────────────────────────────────────────
async function cancelOrder(orderId: string) {
  if (!confirm('Confirmer l\'annulation de cette commande ?')) return
  cancelling.value = true
  cancelError.value = null
  try {
    const data = await adminFetch<{ order: AdminOrder }>(`/orders/${orderId}/cancel`, { method: 'POST' })
    // update both the list and the modal
    const idx = orders.value.findIndex(o => o.id === orderId)
    if (idx !== -1) orders.value[idx] = { ...orders.value[idx]!, ...data.order }
    if (selectedOrder.value?.id === orderId) selectedOrder.value = { ...selectedOrder.value, ...data.order }
  }
  catch (e) {
    const err = e as { data?: { error?: string }; message?: string }
    cancelError.value = err?.data?.error ?? err?.message ?? 'Impossible d\'annuler la commande'
  }
  finally {
    cancelling.value = false
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const EXTRA_STATUS_CONFIG: Record<string, { label: string, icon: string, color: string, bg: string, border: string }> = {
  awaiting_payment: { label: 'Attente paiement', icon: 'ph:credit-card', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  pending_assignment: { label: 'Attente livreur', icon: 'ph:hourglass', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
}

function getStatusCfg(status: string) {
  return (STATUS_CONFIG as Record<string, typeof STATUS_CONFIG['delivered']>)[status]
    ?? EXTRA_STATUS_CONFIG[status]
    ?? { label: status, icon: 'ph:circle', color: 'text-neutral-600', bg: 'bg-neutral-50', border: 'border-neutral-200' }
}

function isCancellable(order: AdminOrder) {
  return !['picked_up', 'in_transit', 'delivered', 'cancelled'].includes(order.status)
    && order.paymentStatus !== 'refunded'
}

function timelineStep(status: string): number {
  const steps = ['pending_assignment', 'rider_assigned', 'picked_up', 'in_transit', 'delivered']
  const idx = steps.indexOf(status)
  return idx >= 0 ? idx : 0
}
</script>

<template>
  <div class="min-h-screen bg-neutral-50">
    <!-- ═══ Hero Header ═══ -->
    <div class="relative overflow-hidden bg-section-dark px-6 py-12 sm:px-10">
      <div class="pointer-events-none absolute -right-20 -top-20 size-80 rounded-full bg-primary-500/15 blur-3xl" />
      <div class="pointer-events-none absolute -bottom-10 -left-10 size-64 rounded-full bg-primary-400/10 blur-2xl" />

      <div class="relative mx-auto max-w-7xl">
        <div class="mb-6 flex items-center gap-3">
          <NuxtLink
            to="/admin"
            class="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-body-sm font-medium text-neutral-300 backdrop-blur-sm transition hover:bg-white/15 hover:text-white"
          >
            <Icon name="ph:arrow-left" class="size-4" />
            Admin
          </NuxtLink>
        </div>

        <div class="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 class="text-h1 font-semibold text-white">
              Commandes
            </h1>
            <p class="mt-1 text-body text-neutral-400">
              Supervision et gestion de toutes les commandes
            </p>
          </div>

          <!-- Stats -->
          <div class="flex flex-wrap items-center gap-4">
            <div class="flex items-center gap-3">
              <div class="flex size-11 items-center justify-center rounded-xl bg-white/10">
                <Icon name="ph:receipt" class="size-5 text-primary-300" />
              </div>
              <div>
                <p class="text-caption font-medium text-neutral-500 leading-tight">
                  Total
                </p>
                <p class="text-body-lg font-semibold text-white leading-tight">
                  {{ stats.total }}
                </p>
              </div>
            </div>
            <div class="h-8 w-px bg-white/10" />
            <div class="flex items-center gap-3">
              <div class="flex size-11 items-center justify-center rounded-xl bg-white/10">
                <Icon name="ph:clock" class="size-5 text-primary-300" />
              </div>
              <div>
                <p class="text-caption font-medium text-neutral-500 leading-tight">
                  En cours
                </p>
                <p class="text-body-lg font-semibold text-white leading-tight">
                  {{ stats.active }}
                </p>
              </div>
            </div>
            <div class="h-8 w-px bg-white/10" />
            <div class="flex items-center gap-3">
              <div class="flex size-11 items-center justify-center rounded-xl bg-primary-500/25 border border-primary-400/20">
                <Icon name="ph:wallet" class="size-5 text-primary-300" />
              </div>
              <div>
                <p class="text-caption font-medium text-primary-400 leading-tight">
                  Revenus
                </p>
                <p class="text-body-lg font-semibold text-white leading-tight">
                  {{ fmtMoney(stats.revenue) }} €
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══ Main Content ═══ -->
    <div class="mx-auto max-w-7xl px-6 py-8 sm:px-10">
      <!-- Filters bar -->
      <div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <!-- Search -->
        <div class="relative flex-1">
          <Icon name="ph:magnifying-glass" class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
          <input
            v-model="searchQuery"
            type="search"
            placeholder="Référence, client, adresse..."
            class="w-full rounded-xl border border-neutral-200 bg-white py-2.5 pl-9 pr-4 text-body-sm text-text-primary placeholder:text-neutral-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
          >
        </div>

        <!-- Status -->
        <select
          v-model="statusFilter"
          class="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-body-sm text-text-primary focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
        >
          <option v-for="s in STATUS_OPTIONS" :key="s.value" :value="s.value">
            {{ s.label }}
          </option>
        </select>

        <!-- Date range -->
        <input
          v-model="dateFrom"
          type="date"
          class="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-body-sm text-text-primary focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
        >
        <input
          v-model="dateTo"
          type="date"
          class="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-body-sm text-text-primary focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
        >

        <button
          class="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-body-sm font-medium text-text-secondary transition hover:bg-neutral-50"
          @click="fetchOrders"
        >
          <Icon name="ph:arrows-clockwise" class="size-4" />
          Actualiser
        </button>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="space-y-3">
        <div v-for="i in 5" :key="i" class="h-20 animate-pulse rounded-2xl bg-white" />
      </div>

      <!-- Error -->
      <div v-else-if="error" class="rounded-2xl border border-error/20 bg-error/5 p-8 text-center">
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

      <!-- Empty -->
      <EmptyState
        v-else-if="filteredOrders.length === 0"
        title="Aucune commande"
        description="Aucune commande ne correspond à vos filtres."
      >
        <template #icon>
          <Icon name="ph:receipt" class="size-10 text-primary-500" />
        </template>
      </EmptyState>

      <!-- Orders table -->
      <div v-else class="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <!-- Table header -->
        <div class="grid grid-cols-[1fr_1fr_140px_120px_100px_80px] gap-4 border-b border-neutral-100 bg-neutral-50 px-6 py-3 text-caption font-semibold uppercase tracking-wide text-text-muted">
          <span>Référence</span>
          <span>Adresse</span>
          <span>Statut</span>
          <span>Date</span>
          <span class="text-right">Total</span>
          <span />
        </div>

        <!-- Rows -->
        <div
          v-for="order in filteredOrders"
          :key="order.id"
          class="grid grid-cols-[1fr_1fr_140px_120px_100px_80px] cursor-pointer items-center gap-4 border-b border-neutral-50 px-6 py-4 transition hover:bg-neutral-50 last:border-0"
          @click="openDetail(order)"
        >
          <!-- Ref + customer -->
          <div>
            <p class="text-body-sm font-semibold text-text-primary">
              {{ order.reference }}
            </p>
            <p class="mt-0.5 truncate text-caption text-text-muted">
              {{ order.customerId ? `Client ${order.customerId.slice(-6)}` : '—' }}
            </p>
          </div>

          <!-- Address -->
          <p class="truncate text-body-sm text-text-secondary">
            {{ order.dropoffAddress ?? '—' }}
          </p>

          <!-- Status badge -->
          <div>
            <span
              class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-caption font-medium"
              :class="[getStatusCfg(order.status).color, getStatusCfg(order.status).bg, getStatusCfg(order.status).border]"
            >
              <Icon :name="getStatusCfg(order.status).icon" class="size-3.5" />
              {{ getStatusCfg(order.status).label }}
            </span>
          </div>

          <!-- Date -->
          <p class="text-caption text-text-muted">
            {{ new Date(order.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) }}
          </p>

          <!-- Total -->
          <p class="text-right text-body-sm font-semibold text-text-primary">
            {{ fmtMoney(order.total) }} €
          </p>

          <!-- Arrow -->
          <div class="flex justify-end">
            <Icon name="ph:arrow-right" class="size-4 text-neutral-300 transition group-hover:text-primary-500" />
          </div>
        </div>
      </div>

      <!-- Count -->
      <p v-if="!loading && !error && filteredOrders.length > 0" class="mt-3 text-right text-caption text-text-muted">
        {{ filteredOrders.length }} commande{{ filteredOrders.length > 1 ? 's' : '' }} affichée{{ filteredOrders.length > 1 ? 's' : '' }}
      </p>
    </div>

    <!-- ═══ Detail Modal ═══ -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showModal"
          class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-10 backdrop-blur-sm"
          @click.self="closeModal"
        >
          <div class="w-full max-w-2xl rounded-3xl bg-white shadow-2xl">
            <!-- Modal header -->
            <div class="flex items-center justify-between border-b border-neutral-100 px-6 py-5">
              <div>
                <h2 class="text-h4 font-semibold text-text-primary">
                  {{ selectedOrder?.reference ?? '...' }}
                </h2>
                <p class="mt-0.5 text-body-sm text-text-muted">
                  Créée le {{ selectedOrder ? fmt(selectedOrder.createdAt) : '' }}
                </p>
              </div>
              <button
                class="flex size-9 items-center justify-center rounded-xl text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-600"
                @click="closeModal"
              >
                <Icon name="ph:x" class="size-5" />
              </button>
            </div>

            <!-- Loading skeleton -->
            <div v-if="loadingDetail" class="space-y-4 p-6">
              <div v-for="i in 4" :key="i" class="h-12 animate-pulse rounded-xl bg-neutral-100" />
            </div>

            <div v-else-if="selectedOrder" class="p-6 space-y-6">
              <!-- Status + payment -->
              <div class="flex flex-wrap gap-3">
                <span
                  class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-body-sm font-semibold"
                  :class="[getStatusCfg(selectedOrder.status).color, getStatusCfg(selectedOrder.status).bg, getStatusCfg(selectedOrder.status).border]"
                >
                  <Icon :name="getStatusCfg(selectedOrder.status).icon" class="size-4" />
                  {{ getStatusCfg(selectedOrder.status).label }}
                </span>
                <span
                  class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-body-sm font-semibold"
                  :class="selectedOrder.paymentStatus === 'paid' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : selectedOrder.paymentStatus === 'refunded' ? 'text-red-700 bg-red-50 border-red-200' : 'text-amber-700 bg-amber-50 border-amber-200'"
                >
                  <Icon name="ph:credit-card" class="size-4" />
                  {{ selectedOrder.paymentStatus === 'paid' ? 'Payée' : selectedOrder.paymentStatus === 'refunded' ? 'Remboursée' : 'En attente de paiement' }}
                </span>
              </div>

              <!-- Addresses -->
              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div class="rounded-xl bg-surface-purple p-4">
                  <p class="mb-1 text-caption font-semibold text-text-muted">
                    Enlèvement
                  </p>
                  <p class="text-body-sm text-text-primary">
                    {{ selectedOrder.pickupAddress ?? '—' }}
                  </p>
                </div>
                <div class="rounded-xl bg-surface-purple p-4">
                  <p class="mb-1 text-caption font-semibold text-text-muted">
                    Livraison
                  </p>
                  <p class="text-body-sm text-text-primary">
                    {{ selectedOrder.dropoffAddress ?? '—' }}
                  </p>
                </div>
              </div>

              <!-- Items -->
              <div v-if="selectedOrder.items?.length">
                <p class="mb-3 text-body-sm font-semibold text-text-primary">
                  Articles ({{ selectedOrder.items.length }})
                </p>
                <div class="divide-y divide-neutral-100 rounded-xl border border-neutral-100">
                  <div
                    v-for="item in selectedOrder.items"
                    :key="item.id"
                    class="flex items-center justify-between px-4 py-3"
                  >
                    <div>
                      <p class="text-body-sm font-medium text-text-primary">
                        {{ item.name }}
                      </p>
                      <p class="text-caption text-text-muted">
                        Qté {{ item.quantity }} ·
                        {{ item.durationValue }} {{ item.durationUnit === 'flat' ? 'forfait' : item.durationUnit === 'daily' ? 'jour(s)' : item.durationUnit === 'weekly' ? 'semaine(s)' : 'heure(s)' }}
                      </p>
                    </div>
                    <p class="text-body-sm font-semibold text-text-primary">
                      {{ fmtMoney(item.lineTotal) }} €
                    </p>
                  </div>
                </div>
              </div>

              <!-- Totals -->
              <div class="rounded-xl bg-neutral-50 p-4 space-y-2">
                <div class="flex justify-between text-body-sm text-text-muted">
                  <span>Sous-total</span>
                  <span>{{ fmtMoney(selectedOrder.subtotal) }} €</span>
                </div>
                <div class="flex justify-between text-body-sm text-text-muted">
                  <span>Livraison</span>
                  <span>{{ fmtMoney(selectedOrder.deliveryFee) }} €</span>
                </div>
                <div class="flex justify-between border-t border-neutral-200 pt-2 text-body font-bold text-text-primary">
                  <span>Total</span>
                  <span>{{ fmtMoney(selectedOrder.total) }} €</span>
                </div>
              </div>

              <!-- Timeline (events) -->
              <div v-if="selectedOrder.events?.length">
                <p class="mb-3 text-body-sm font-semibold text-text-primary">
                  Historique
                </p>
                <ol class="space-y-3">
                  <li
                    v-for="ev in selectedOrder.events"
                    :key="ev.id"
                    class="flex items-start gap-3"
                  >
                    <div class="mt-1 size-2.5 shrink-0 rounded-full bg-primary-400" />
                    <div>
                      <p class="text-body-sm font-medium text-text-primary">
                        {{ getStatusCfg(ev.status).label }}
                      </p>
                      <p class="text-caption text-text-muted">
                        {{ fmt(ev.createdAt) }}{{ ev.note ? ` — ${ev.note}` : '' }}
                      </p>
                    </div>
                  </li>
                </ol>
              </div>

              <!-- Cancel error -->
              <div v-if="cancelError" class="rounded-xl border border-error/20 bg-error/10 px-4 py-3 text-body-sm text-error">
                {{ cancelError }}
              </div>

              <!-- Actions -->
              <div class="flex items-center justify-between border-t border-neutral-100 pt-4">
                <NuxtLink
                  :to="`/orders/${selectedOrder.id}`"
                  class="text-body-sm font-medium text-primary-600 underline-offset-2 hover:underline"
                >
                  Voir page client →
                </NuxtLink>

                <button
                  v-if="isCancellable(selectedOrder)"
                  :disabled="cancelling"
                  class="flex items-center gap-2 rounded-xl bg-error px-5 py-2.5 text-body-sm font-semibold text-white transition hover:bg-error/90 disabled:opacity-50"
                  @click="cancelOrder(selectedOrder.id)"
                >
                  <Icon name="ph:x-circle" class="size-4" />
                  {{ cancelling ? 'Annulation...' : 'Annuler la commande' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-active .rounded-3xl,
.modal-leave-active .rounded-3xl {
  transition: transform 0.2s ease;
}
.modal-enter-from .rounded-3xl,
.modal-leave-to .rounded-3xl {
  transform: scale(0.96) translateY(-8px);
}
</style>
