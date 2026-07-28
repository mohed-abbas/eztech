<script setup lang="ts">
import { STATUS_CONFIG } from '~/stores/orders'

definePageMeta({
  layout: 'admin',
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
  // présent sur GET /admin/orders et /admin/orders/:id (la route ne fait pas de `select`) ; sert à
  // distinguer « annulée sans encaissement » de « réellement remboursée chez Stripe ».
  stripePaymentIntentId?: string | null
  total: string | number
  subtotal: string | number
  deliveryFee: string | number
  pickupAddress: string | null
  dropoffAddress: string | null
  createdAt: string
  preparedAt?: string | null
  deliveredAt: string | null
  items: OrderItem[]
  events?: OrderEvent[]
}

// ── Composable ───────────────────────────────────────────────────────────────
const { adminFetch, fmtMoney } = useAdminApi()

// ── State ────────────────────────────────────────────────────────────────────
const auth = useAuthStore()
const route = useRoute()

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

// Refund — geste irréversible (l'argent repart chez Stripe), d'où la confirmation saisie
// au clavier plutôt qu'un simple confirm().
const REFUND_CONFIRM_WORD = 'REMBOURSER'
const refunding = ref(false)
const refundError = ref<string | null>(null)
const showRefundConfirm = ref(false)
const refundConfirmText = ref('')

function resetRefundConfirm() {
  showRefundConfirm.value = false
  refundConfirmText.value = ''
}

// ── Response-shape guards ────────────────────────────────────────────────────
// In production nginx path-splits /api/orders to the Nuxt BFF (server/api/orders.ts), which
// answers with a storefront-shaped FLAT ARRAY (no reference, no paymentStatus, no events) and
// has no handler at all for POST /orders/:id/cancel. Reading `.orders` off that gave `undefined`
// and blanked the page on the next render, with nothing thrown for the try/catch to catch. The
// admin API is therefore called on /admin/orders (Express, unshadowed) and the envelope is
// validated, so a wrong shape surfaces as an error instead of an empty screen.
function unwrapOrders(data: unknown): AdminOrder[] {
  const list = (data as { orders?: unknown } | null | undefined)?.orders
  if (!Array.isArray(list)) throw new Error('Réponse inattendue de l\'API : « orders » manquant.')
  return list as AdminOrder[]
}

function unwrapOrder(data: unknown): AdminOrder {
  const order = (data as { order?: AdminOrder } | null | undefined)?.order
  if (!order || typeof order.id !== 'string') throw new Error('Réponse inattendue de l\'API : commande manquante.')
  return order
}

// ── Fetch all orders ─────────────────────────────────────────────────────────
async function fetchOrders() {
  loading.value = true
  error.value = null
  auth.hydrate()
  try {
    orders.value = unwrapOrders(await adminFetch<unknown>('/admin/orders'))
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : 'Erreur de chargement'
  }
  finally {
    loading.value = false
  }
}

// ── Computed filters ──────────────────────────────────────────────────────────
const STATUS_OPTIONS = [
  { value: 'all', label: 'Tous les statuts' },
  { value: 'awaiting_payment', label: 'En attente de paiement' },
  { value: 'pending_assignment', label: 'En attente de livreur' },
  { value: 'rider_assigned', label: 'Livreur assigné' },
  { value: 'at_warehouse', label: 'Livreur à l’entrepôt' },
  { value: 'picked_up', label: 'Récupérée' },
  { value: 'in_transit', label: 'En route' },
  { value: 'delivered', label: 'Livrée' },
  { value: 'cancelled', label: 'Annulée' },
]

onMounted(() => {
  // Le raccourci « En attente de livreur » du tableau de bord (/admin/orders?status=…) était
  // inerte : la query n'était jamais lue. On la valide contre STATUS_OPTIONS pour qu'une valeur
  // inconnue ne vide pas silencieusement le tableau.
  const wanted = Array.isArray(route.query.status) ? route.query.status[0] : route.query.status
  if (typeof wanted === 'string' && STATUS_OPTIONS.some(o => o.value === wanted)) {
    statusFilter.value = wanted
  }
  fetchOrders()
})

// `<input type="date">` renvoie toujours 'YYYY-MM-DD' — on découpe plutôt que de laisser
// Date() choisir le fuseau (ISO date-only ⇒ UTC).
function parseDayParts(v: string): [number, number, number] | null {
  const [y, m, d] = v.split('-').map(Number)
  if (!y || !m || !d || Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return null
  return [y, m, d]
}

function startOfLocalDay(v: string): Date | null {
  const p = parseDayParts(v)
  return p ? new Date(p[0], p[1] - 1, p[2], 0, 0, 0, 0) : null
}

function endOfLocalDay(v: string): Date | null {
  const p = parseDayParts(v)
  return p ? new Date(p[0], p[1] - 1, p[2], 23, 59, 59, 999) : null
}

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

  // `new Date('2026-07-21')` est interprété comme minuit UTC : en France (UTC+2 l'été) cela
  // correspond à 02:00 locales, et les commandes passées entre 00:00 et 02:00 le jour choisi
  // disparaissaient du filtre. On construit donc les bornes en heure locale.
  const from = dateFrom.value ? startOfLocalDay(dateFrom.value) : null
  if (from) result = result.filter(o => new Date(o.createdAt) >= from)

  const to = dateTo.value ? endOfLocalDay(dateTo.value) : null
  if (to) result = result.filter(o => new Date(o.createdAt) <= to)

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
  refundError.value = null
  resetRefundConfirm()
  selectedOrder.value = order

  loadingDetail.value = true
  try {
    selectedOrder.value = unwrapOrder(await adminFetch<unknown>(`/admin/orders/${order.id}`))
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
  refundError.value = null
  resetRefundConfirm()
}

// ── Messages d'erreur ─────────────────────────────────────────────────────────
// Le backend renvoie un code machine (`{ error: 'not_refundable' }`) : affiché tel quel, il ne
// dit rien à un administrateur. On le traduit, avec repli sur le statut HTTP puis le message.
function toFrench(e: unknown, fallback: string): string {
  const apiErr = e as { data?: { error?: string }, statusCode?: number, message?: string }
  const code = apiErr?.data?.error
  const map: Record<string, string> = {
    not_cancellable: 'Annulation impossible : le colis est déjà pris en charge par le livreur. Utilisez « Rembourser » pour rendre l’argent.',
    already_cancelled: 'Cette commande est déjà annulée ou remboursée. Actualisez la liste.',
    not_refundable: 'Remboursement impossible : le paiement de cette commande n’est pas au statut « payée ».',
    no_payment_intent: 'Aucun paiement Stripe n’est rattaché à cette commande : le remboursement doit être effectué manuellement.',
    order_not_found: 'Cette commande n’existe plus. Actualisez la liste.',
    forbidden: 'Action réservée aux administrateurs.',
    missing_token: 'Session expirée, veuillez vous reconnecter.',
    invalid_token: 'Session expirée, veuillez vous reconnecter.',
  }
  if (code && map[code]) return map[code]
  if (apiErr?.statusCode === 403) return 'Action réservée aux administrateurs.'
  if (apiErr?.statusCode === 404) return 'Cette commande n’existe plus. Actualisez la liste.'
  return apiErr?.message ?? fallback
}

// ── Rafraîchissement après mutation ───────────────────────────────────────────
// /cancel et /refund répondent avec `include: { items: true }` UNIQUEMENT (orders.ts:310,
// payments.ts:90) : leur payload n'a pas d'`events`. Fusionner cette réponse dans la modale
// ouverte laissait donc la frise sur l'état d'avant, sans l'événement « cancelled » qui vient
// d'être écrit. On relit le détail complet ; si cette relecture échoue on retombe sur la
// réponse partielle plutôt que de vider une modale ouverte.
async function refreshAfterMutation(orderId: string, partial: AdminOrder) {
  let fresh: AdminOrder = partial
  try {
    fresh = unwrapOrder(await adminFetch<unknown>(`/admin/orders/${orderId}`))
  }
  catch { /* on garde la réponse partielle */ }

  const idx = orders.value.findIndex(o => o.id === orderId)
  if (idx !== -1) orders.value[idx] = { ...orders.value[idx]!, ...fresh }
  if (selectedOrder.value?.id === orderId) selectedOrder.value = { ...selectedOrder.value, ...fresh }
}

// ── Cancel order ──────────────────────────────────────────────────────────────
// POST /api/admin/orders/:id/cancel (Express, préfixe non détourné par nginx). Ce handler
// rembourse déjà Stripe lui-même quand la commande était payée — d'où le gating exclusif avec
// le bouton « Rembourser » plus bas.
async function cancelOrder(orderId: string) {
  if (!confirm('Confirmer l\'annulation de cette commande ?')) return
  cancelling.value = true
  cancelError.value = null
  refundError.value = null
  try {
    const cancelled = unwrapOrder(await adminFetch<unknown>(`/admin/orders/${orderId}/cancel`, { method: 'POST' }))
    await refreshAfterMutation(orderId, cancelled)
  }
  catch (e) {
    cancelError.value = toFrench(e, 'Impossible d\'annuler la commande')
  }
  finally {
    cancelling.value = false
  }
}

// ── Refund order ──────────────────────────────────────────────────────────────
// POST /api/payments/:id/refund — ATTENTION : `:id` est l'id de la COMMANDE, pas celui d'un
// paiement (payments.ts:64). /api/payments ne fait pas partie de l'allowlist nginx renvoyée au
// BFF Nuxt (products, orders, zones, config, geocode), l'appel atteint donc bien Express en
// production. Le handler est idempotent (idempotencyKey `refund_<orderId>`), bascule la commande
// en paymentStatus=refunded + status=cancelled et écrit un OrderEvent « refunded by admin ».
async function refundOrder(orderId: string) {
  if (refundConfirmText.value.trim().toUpperCase() !== REFUND_CONFIRM_WORD) return
  refunding.value = true
  refundError.value = null
  cancelError.value = null
  try {
    const refunded = unwrapOrder(await adminFetch<unknown>(`/payments/${orderId}/refund`, { method: 'POST' }))
    await refreshAfterMutation(orderId, refunded)
    resetRefundConfirm()
  }
  catch (e) {
    refundError.value = toFrench(e, 'Impossible de rembourser la commande')
  }
  finally {
    refunding.value = false
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// STATUS_CONFIG (~/stores/orders) décrit le cycle de vie côté client et ne contient ni
// awaiting_payment, ni pending_assignment, ni at_warehouse, qui existent pourtant dans l'enum
// OrderStatus de Prisma. Ils sont complétés ici — le store est partagé, on n'y touche pas.
const EXTRA_STATUS_CONFIG: Record<string, { label: string, icon: string, color: string, bg: string, border: string }> = {
  awaiting_payment: { label: 'Attente paiement', icon: 'ph:credit-card', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  pending_assignment: { label: 'Attente livreur', icon: 'ph:hourglass', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  at_warehouse: { label: 'Livreur à l’entrepôt', icon: 'ph:warehouse', color: 'text-primary-700', bg: 'bg-primary-50', border: 'border-primary-200' },
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

// Annuler rembourse déjà Stripe (orders.ts:316) : n'exposer « Rembourser » que lorsque
// l'annulation n'est plus possible, sinon deux boutons rendraient le même argent.
function canRefund(order: AdminOrder) {
  return order.paymentStatus === 'paid' && !isCancellable(order)
}

// ── Frise de livraison (DeliveryTimeline) ─────────────────────────────────────
// DeliveryTimeline expose 6 étapes FIXES et positionnelles :
//   0 Commande passée · 1 En préparation · 2 Livreur assigné · 3 Commande récupérée
//   4 En route · 5 Livrée
// La table ci-dessous projette l'enum OrderStatus dessus. `at_warehouse` vaut 2 et non 1 : dans
// le cycle Prisma il arrive APRÈS rider_assigned (le livreur est à l'entrepôt), le ramener à
// « En préparation » ferait reculer la frise. L'étape 1 est portée par `preparedAt`.
const TIMELINE_KEYS = ['placed', 'preparing', 'rider_assigned', 'picked_up', 'in_transit', 'delivered']

const STATUS_STEP: Record<string, number> = {
  awaiting_payment: 0,
  pending_assignment: 0,
  rider_assigned: 2,
  at_warehouse: 2,
  picked_up: 3,
  in_transit: 4,
  delivered: 5,
}

// L'étape courante est le MAXIMUM des jalons réellement atteints (statut courant + historique +
// preparedAt), jamais une simple lecture du statut : une commande annulée après avoir été
// récupérée doit rester affichée à l'étape 3, pas retomber à 0.
function timelineStep(order: AdminOrder | null): number {
  if (!order) return 0
  let step = 0
  const bump = (n: number) => { if (n > step) step = n }

  if (order.preparedAt) bump(1)
  for (const ev of order.events ?? []) {
    const s = STATUS_STEP[ev.status]
    if (s !== undefined) bump(s)
  }
  // 'cancelled' n'a pas de position sur la frise : le statut courant n'est pris en compte que
  // s'il fait partie du cycle nominal.
  const current = STATUS_STEP[order.status]
  if (current !== undefined) bump(current)

  return step
}

// Tableau POSITIONNEL de longueur 6 : DeliveryTimeline indexe `steps[i]`, pas `steps.find(...)`.
// Passer seulement les événements survenus décalerait tous les horodatages.
function timelineStamps(order: AdminOrder | null): { key: string, timestamp?: string }[] {
  const slots: (string | undefined)[] = [undefined, undefined, undefined, undefined, undefined, undefined]
  if (order) {
    slots[0] = fmt(order.createdAt)
    if (order.preparedAt) slots[1] = fmt(order.preparedAt)

    // les events arrivent triés par createdAt asc (orders.ts:241) : le premier passage fait foi
    for (const ev of order.events ?? []) {
      if (ev.status === 'at_warehouse' && !slots[1]) slots[1] = fmt(ev.createdAt)
      const i = STATUS_STEP[ev.status]
      if (i === undefined || i === 0) continue
      if (!slots[i]) slots[i] = fmt(ev.createdAt)
    }
    if (!slots[5] && order.deliveredAt) slots[5] = fmt(order.deliveredAt)
  }
  return TIMELINE_KEYS.map((key, i) => {
    const timestamp = slots[i]
    return timestamp ? { key, timestamp } : { key }
  })
}

// ── Bandeau annulation / remboursement ────────────────────────────────────────
// DeliveryTimeline n'a aucun état « annulée » : sans ce bandeau une commande annulée s'affiche
// comme si elle progressait encore.
const cancelBanner = computed(() => {
  const order = selectedOrder.value
  if (!order) return null
  const refunded = order.paymentStatus === 'refunded'
  if (order.status !== 'cancelled' && !refunded) return null

  // /orders/:id/cancel force paymentStatus=refunded MÊME sur une commande jamais payée (orders.ts:301)
  // alors qu'aucun euro n'a bougé. On n'annonce donc un remboursement que si un PaymentIntent
  // Stripe existait réellement.
  const moneyReturned = refunded && !!order.stripePaymentIntentId
  const ev = [...(order.events ?? [])].reverse().find(e => e.status === 'cancelled')
  const when = ev ? fmt(ev.createdAt) : null
  const title = moneyReturned ? 'Commande annulée — remboursement émis' : 'Commande annulée'
  return {
    title: when ? `${title} le ${when}` : title,
    detail: moneyReturned
      ? 'Le montant total a été renvoyé au client via Stripe. La progression ci-dessous s’arrête à la dernière étape atteinte.'
      : 'Aucun paiement n’avait été encaissé : rien n’a été remboursé. La progression ci-dessous s’arrête à la dernière étape atteinte.',
  }
})
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

              <!-- Bandeau annulation / remboursement (DeliveryTimeline n'a pas d'état annulé) -->
              <div
                v-if="cancelBanner"
                class="rounded-xl border border-red-200 bg-red-50 px-4 py-3"
              >
                <p class="flex items-center gap-2 text-body-sm font-semibold text-red-700">
                  <Icon name="ph:x-circle" class="size-4 shrink-0" />
                  {{ cancelBanner.title }}
                </p>
                <p class="mt-1 text-caption text-red-600">
                  {{ cancelBanner.detail }}
                </p>
              </div>

              <!-- Progression de la livraison -->
              <div>
                <p class="mb-3 text-body-sm font-semibold text-text-primary">
                  Progression
                </p>
                <DeliveryTimeline
                  :current-step="timelineStep(selectedOrder)"
                  :steps="timelineStamps(selectedOrder)"
                />
              </div>

              <!-- Journal brut des événements — DeliveryTimeline ne sait pas afficher `note`
                   (« refunded by admin », « refunded »…), qui est justement la trace d'audit. -->
              <div v-if="selectedOrder.events?.length">
                <p class="mb-3 text-body-sm font-semibold text-text-primary">
                  Historique ({{ selectedOrder.events.length }})
                </p>
                <div class="divide-y divide-neutral-100 rounded-xl border border-neutral-100">
                  <div
                    v-for="ev in selectedOrder.events"
                    :key="ev.id"
                    class="flex items-start justify-between gap-3 px-4 py-2.5"
                  >
                    <div class="min-w-0">
                      <p class="text-body-sm font-medium text-text-primary">
                        {{ getStatusCfg(ev.status).label }}
                      </p>
                      <p v-if="ev.note" class="truncate text-caption text-text-muted">
                        {{ ev.note }}
                      </p>
                    </div>
                    <p class="shrink-0 text-caption text-text-muted">
                      {{ fmt(ev.createdAt) }}
                    </p>
                  </div>
                </div>
              </div>

              <!-- Erreurs d'action -->
              <div v-if="cancelError" class="rounded-xl border border-error/20 bg-error/10 px-4 py-3 text-body-sm text-error">
                {{ cancelError }}
              </div>
              <div v-if="refundError" class="rounded-xl border border-error/20 bg-error/10 px-4 py-3 text-body-sm text-error">
                {{ refundError }}
              </div>

              <!-- Confirmation de remboursement (saisie explicite : geste irréversible) -->
              <div
                v-if="showRefundConfirm && canRefund(selectedOrder)"
                class="rounded-xl border border-amber-200 bg-amber-50 p-4"
              >
                <p class="text-body-sm font-semibold text-amber-800">
                  Rembourser {{ fmtMoney(selectedOrder.total) }} € au client ?
                </p>
                <p class="mt-1 text-caption text-amber-700">
                  L’intégralité du paiement sera renvoyée via Stripe et la commande passera en
                  « Annulée ». Cette opération est irréversible. Saisissez
                  <strong>{{ REFUND_CONFIRM_WORD }}</strong> pour confirmer.
                </p>
                <div class="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input
                    v-model="refundConfirmText"
                    type="text"
                    :placeholder="REFUND_CONFIRM_WORD"
                    autocomplete="off"
                    class="flex-1 rounded-xl border border-amber-300 bg-white px-4 py-2 text-body-sm text-text-primary placeholder:text-neutral-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100"
                  >
                  <button
                    class="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-body-sm font-medium text-text-secondary transition hover:bg-neutral-50"
                    @click="resetRefundConfirm()"
                  >
                    Annuler
                  </button>
                  <button
                    :disabled="refunding || refundConfirmText.trim().toUpperCase() !== REFUND_CONFIRM_WORD"
                    class="rounded-xl bg-error px-4 py-2 text-body-sm font-semibold text-white transition hover:bg-error/90 disabled:cursor-not-allowed disabled:opacity-50"
                    @click="refundOrder(selectedOrder.id)"
                  >
                    {{ refunding ? 'Remboursement...' : 'Confirmer le remboursement' }}
                  </button>
                </div>
              </div>

              <!-- Actions -->
              <div class="flex items-center justify-between gap-3 border-t border-neutral-100 pt-4">
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

                <!-- Annuler rembourse déjà Stripe : les deux boutons sont mutuellement exclusifs -->
                <button
                  v-else-if="canRefund(selectedOrder)"
                  :disabled="refunding || showRefundConfirm"
                  class="flex items-center gap-2 rounded-xl bg-error px-5 py-2.5 text-body-sm font-semibold text-white transition hover:bg-error/90 disabled:opacity-50"
                  @click="showRefundConfirm = true"
                >
                  <Icon name="ph:arrow-u-up-left" class="size-4" />
                  Rembourser
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
