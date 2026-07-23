<script setup lang="ts">
import { estimateEtaSeconds, formatEta } from '~/lib/eta'
import type { BackendOrderStatus } from '~/lib/orderStatus'
// '~~' (not '~') resolves to the frontend project root — '~' points at app/, which has no
// server/ subtree — so this is the only alias that reaches the Nitro route's exported type.
import type { TrackingOrder } from '~~/server/api/orders/[id].get'

const route = useRoute()

definePageMeta({ layout: 'default', middleware: 'auth' })

const orderId = computed(() => {
  const id = String(route.params.id)
  if (!/^[\w-]{1,50}$/.test(id)) return 'invalide'
  return id
})

useHead({ title: computed(() => `Commande #${orderId.value} - EzTech`) })

// ─── LIVE owner-scoped order via the BFF (Pitfall A) ───────────────────────
// We read the LIVE order (raw Prisma OrderStatus) through GET /api/orders/:id, NOT the
// mock Pinia store — so the status vocabulary matches the backend enum and no display
// lookup ever throws. The auth token is forwarded so the backend scopes the order.
const auth = useAuthStore()
// useRequestFetch forwards the incoming request's cookies to the BFF on SSR (Phase 7), so a
// cookie-only session authenticates during server render — no more "introuvable" on first paint.
// The Authorization header still carries the header-path token when present (native/tests).
const { data: order, pending, error } = await useFetch<TrackingOrder>(
  () => `/api/orders/${orderId.value}`,
  {
    // useRequestFetch() is typed as `H3Event$Fetch | typeof $fetch`; useFetch's `$fetch` option only
    // accepts the latter half of that union — the two are runtime-identical (ofetch instances), so
    // this narrows a real type-only mismatch rather than papering over a behavioral difference.
    $fetch: useRequestFetch() as typeof globalThis.$fetch,
    headers: computed<Record<string, string>>(() => {
      const headers: Record<string, string> = {}
      if (auth.token) headers.Authorization = `Bearer ${auth.token}`
      return headers
    }),
  },
)

// ─── Live tracking wiring (TRACK-01/04/06/07) ──────────────────────────────
// Seed from the live order; the composable keeps status current via order-status events
// and exposes the reactive rider position + the showMap gate (live picked_up/in_transit).
const tracking = useOrderTracking(orderId.value, order.value ? { id: order.value.id, status: order.value.status } : null)
const { riderPos, status: liveStatus, showMap, reconnecting, lastUpdate } = tracking

// the effective live status: the composable's status once it has seeded, else the fetched one
const currentStatus = computed<BackendOrderStatus>(() =>
  (liveStatus.value || order.value?.status || 'pending_assignment') as BackendOrderStatus,
)

// ─── Status display config keyed on the canonical Prisma vocabulary ────────
// Every BackendOrderStatus has an entry, so a live status never throws (Pitfall A).
interface StatusMeta { label: string, icon: string, color: string, bg: string }
const STATUS_CONFIG: Record<BackendOrderStatus, StatusMeta> = {
  awaiting_payment: { label: 'En attente de paiement', icon: 'ph:hourglass', color: 'text-amber-700', bg: 'bg-amber-50' },
  pending_assignment: { label: 'En recherche de livreur', icon: 'ph:magnifying-glass', color: 'text-blue-700', bg: 'bg-blue-50' },
  rider_assigned: { label: 'Livreur assigné', icon: 'ph:user-circle', color: 'text-primary-700', bg: 'bg-primary-50' },
  at_warehouse: { label: 'En préparation', icon: 'ph:package', color: 'text-amber-700', bg: 'bg-amber-50' },
  picked_up: { label: 'Récupérée', icon: 'ph:cube', color: 'text-primary-700', bg: 'bg-primary-50' },
  in_transit: { label: 'En route', icon: 'ph:motorcycle', color: 'text-primary-700', bg: 'bg-primary-50' },
  delivered: { label: 'Livrée', icon: 'ph:check-circle', color: 'text-emerald-700', bg: 'bg-emerald-50' },
  cancelled: { label: 'Annulée', icon: 'ph:x-circle', color: 'text-red-700', bg: 'bg-red-50' },
}

function statusMeta(s: BackendOrderStatus): StatusMeta {
  return STATUS_CONFIG[s] ?? STATUS_CONFIG.pending_assignment
}

// active = anything before a terminal state (delivered/cancelled)
const isActive = computed(() => currentStatus.value !== 'delivered' && currentStatus.value !== 'cancelled')

// ─── Delivery timeline driven by the Prisma vocabulary ─────────────────────
interface StepDisplay {
  key: BackendOrderStatus
  label: string
  description: string
  icon: string
}

const STEPS: StepDisplay[] = [
  { key: 'awaiting_payment', label: 'Commande passée', description: 'Votre commande a été enregistrée', icon: 'ph:seal-check' },
  { key: 'pending_assignment', label: 'Recherche de livreur', description: 'Nous cherchons un livreur disponible', icon: 'ph:magnifying-glass' },
  { key: 'rider_assigned', label: 'Livreur assigné', description: 'Un livreur a pris en charge votre commande', icon: 'ph:user-circle' },
  { key: 'at_warehouse', label: 'En préparation', description: 'Vos produits sont préparés à l\'entrepôt', icon: 'ph:package' },
  { key: 'picked_up', label: 'Récupérée', description: 'Le livreur a récupéré votre commande', icon: 'ph:cube' },
  { key: 'in_transit', label: 'En route', description: 'Votre commande est en chemin vers vous', icon: 'ph:motorcycle' },
  { key: 'delivered', label: 'Livrée', description: 'Commande livrée avec succès', icon: 'ph:house' },
]

const STEP_ORDER: BackendOrderStatus[] = STEPS.map(s => s.key)

const currentStepIndex = computed(() => {
  const idx = STEP_ORDER.indexOf(currentStatus.value)
  return idx >= 0 ? idx : 0
})

function getStepStatus(index: number): 'completed' | 'active' | 'pending' {
  if (index < currentStepIndex.value) return 'completed'
  if (index === currentStepIndex.value) return 'active'
  return 'pending'
}

// last-known position freshness for the reconnecting hint (D-05)
const lastUpdateLabel = computed(() => {
  if (lastUpdate.value === null) return null
  const d = new Date(lastUpdate.value)
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
})

// the warehouse/destination markers come from the live order's coordinates when present
const warehousePos = computed<[number, number] | undefined>(() =>
  order.value?.pickup ? [order.value.pickup.lat, order.value.pickup.lng] : undefined,
)
const destinationPos = computed<[number, number] | undefined>(() =>
  order.value?.dropoff ? [order.value.dropoff.lat, order.value.dropoff.lng] : undefined,
)
const mapCenter = computed<[number, number]>(() => {
  if (riderPos.value) return [riderPos.value.lat, riderPos.value.lng]
  if (order.value?.dropoff) return [order.value.dropoff.lat, order.value.dropoff.lng]
  return [48.8566, 2.3522]
})

// ─── État final « Livré » : carte figée + marqueur vert ─────────────────────
const isDelivered = computed(() => currentStatus.value === 'delivered')
const showMapCard = computed(() => showMap.value || isDelivered.value)
const mapCollapsed = ref(false)
// Position figée une fois livré : dernière position connue, sinon la destination
const frozenPos = computed<{ lat: number, lng: number } | null>(() => {
  if (riderPos.value) return riderPos.value
  if (order.value?.dropoff) return { lat: order.value.dropoff.lat, lng: order.value.dropoff.lng }
  return null
})

// ETA live : itinéraire routier réel (livreur → destination) via /api/directions, avec repli sur
// l'heuristique distance/vitesse moyenne tant que la route n'est pas encore chargée (D4).
const dropoffPos = computed<{ lat: number, lng: number } | null>(() =>
  order.value?.dropoff ? { lat: order.value.dropoff.lat, lng: order.value.dropoff.lng } : null,
)
const { etaSeconds: routedEtaSeconds } = useRouteEta(riderPos, dropoffPos)

const etaLabel = computed<string | null>(() => {
  if (isDelivered.value || !riderPos.value || !order.value?.dropoff) return null
  // prefer the real routed duration; fall back to the straight-line estimate until it arrives
  const secs = routedEtaSeconds.value
    ?? estimateEtaSeconds(riderPos.value, { lat: order.value.dropoff.lat, lng: order.value.dropoff.lng })
  return formatEta(secs)
})
</script>

<template>
  <div class="min-h-screen bg-background">
    <!-- Hero Header -->
    <div class="relative overflow-hidden bg-section-dark px-6 py-12 sm:px-10 sm:py-16">
      <div class="pointer-events-none absolute -right-20 -top-20 size-80 rounded-full bg-primary-500/15 blur-3xl" />
      <div class="pointer-events-none absolute -bottom-10 -left-10 size-64 rounded-full bg-primary-400/10 blur-2xl" />

      <div class="relative mx-auto max-w-5xl">
        <NuxtLink
          to="/orders"
          class="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-body-sm font-medium text-neutral-300 backdrop-blur-sm transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400/50"
        >
          <Icon name="ph:arrow-left" class="size-4" />
          Mes commandes
        </NuxtLink>

        <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 class="text-h1 font-semibold text-white">Suivi de commande</h1>
            <p class="mt-2 text-body text-neutral-400">
              Commande #{{ orderId }}
            </p>
          </div>

          <!-- Live status badge (active orders) -->
          <div v-if="order && isActive" class="flex items-center gap-3 rounded-full bg-primary-500/20 border border-primary-400/30 px-5 py-2.5 backdrop-blur-sm">
            <span class="size-2.5 rounded-full bg-primary-400 animate-pulse" />
            <span class="text-body-sm font-semibold text-white">{{ statusMeta(currentStatus).label }}</span>
          </div>

          <!-- Delivered / Cancelled badge -->
          <div v-else-if="order" class="flex items-center gap-2 rounded-full px-5 py-2.5 backdrop-blur-sm" :class="statusMeta(currentStatus).bg">
            <Icon :name="statusMeta(currentStatus).icon" class="size-4" :class="statusMeta(currentStatus).color" />
            <span class="text-body-sm font-semibold" :class="statusMeta(currentStatus).color">{{ statusMeta(currentStatus).label }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="mx-auto max-w-5xl px-6 py-10 sm:px-10">
      <!-- Loading -->
      <div v-if="pending" class="py-20 text-center text-text-muted">
        Chargement...
      </div>

      <!-- Order not found -->
      <EmptyState
        v-else-if="error || !order"
        title="Commande introuvable"
        description="Cette commande n'existe pas ou vous n'y avez pas accès."
      >
        <template #icon>
          <Icon name="ph:warning-circle" class="size-10 text-amber-500" />
        </template>
        <template #actions>
          <NuxtLink to="/orders">
            <Button variant="gradient" size="pill" class="font-semibold">
              <Icon name="ph:arrow-left" class="size-4" />
              Retour aux commandes
            </Button>
          </NuxtLink>
        </template>
      </EmptyState>

      <div v-else class="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <!-- Left Column: Timeline -->
        <div class="lg:col-span-5">
          <Card class="p-6">
            <div class="mb-6 flex items-center justify-between">
              <h2 class="text-h4 font-semibold text-text-primary">Statut de la livraison</h2>
              <span class="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-3 py-1.5 text-caption font-medium text-primary-600">
                <Icon name="ph:path" class="size-3.5" />
                {{ currentStepIndex + 1 }}/{{ STEPS.length }}
              </span>
            </div>

            <div class="relative">
              <!-- Progress line background -->
              <div class="absolute left-5 top-5 bottom-5 w-0.5 bg-neutral-100" />
              <!-- Progress line filled -->
              <div
                class="absolute left-5 top-5 w-0.5 bg-primary-500 transition-all duration-700"
                :style="{ height: `${(currentStepIndex / (STEPS.length - 1)) * 100}%` }"
              />

              <div class="space-y-0">
                <div
                  v-for="(step, index) in STEPS"
                  :key="step.key"
                  class="relative flex items-start gap-4 pb-6 last:pb-0"
                >
                  <!-- Status icon -->
                  <div
                    class="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-500"
                    :class="{
                      'bg-success border-success': getStepStatus(index) === 'completed',
                      'bg-primary-600 border-primary-600 shadow-lg shadow-primary-200': getStepStatus(index) === 'active',
                      'bg-white border-neutral-200': getStepStatus(index) === 'pending',
                    }"
                  >
                    <Icon
                      v-if="getStepStatus(index) === 'completed'"
                      name="ph:check-bold"
                      class="size-5 text-white"
                    />
                    <div
                      v-else-if="getStepStatus(index) === 'active'"
                      class="size-3 rounded-full bg-white"
                    />
                    <div v-else class="size-3 rounded-full bg-neutral-200" />
                  </div>

                  <!-- Step content -->
                  <div class="flex-1 pt-1.5">
                    <div class="flex items-center gap-2 flex-wrap">
                      <span
                        class="font-medium transition-colors"
                        :class="getStepStatus(index) !== 'pending' ? 'text-text-primary' : 'text-text-muted'"
                      >
                        {{ step.label }}
                      </span>

                      <span
                        v-if="getStepStatus(index) === 'active'"
                        class="inline-flex items-center gap-1 rounded-full bg-primary-100 px-2 py-0.5 text-caption font-medium text-primary-700"
                      >
                        <span class="size-1.5 rounded-full bg-primary-500 animate-pulse" />
                        En cours
                      </span>
                    </div>

                    <p
                      class="mt-0.5 text-body-sm"
                      :class="getStepStatus(index) === 'pending' ? 'text-neutral-300' : 'text-text-muted'"
                    >
                      {{ step.description }}
                    </p>

                    <!-- Rider info under "Livreur assigné" -->
                    <div
                      v-if="step.key === 'rider_assigned' && getStepStatus(index) !== 'pending' && order && order.riderId"
                      class="mt-2 flex items-center gap-2 rounded-lg bg-surface-purple border border-primary-100 px-3 py-2 w-fit"
                    >
                      <div class="flex size-8 items-center justify-center rounded-full bg-primary-100">
                        <Icon name="ph:user" class="size-4 text-primary-600" />
                      </div>
                      <div>
                        <p class="text-body-sm font-medium text-text-primary">Livreur en route</p>
                        <p class="text-caption text-text-muted">Votre commande est prise en charge</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>

        </div>

        <!-- Right Column -->
        <div class="lg:col-span-7 space-y-4">
          <!-- Map Card (en transit : live · livrée : figée) -->
          <Card v-if="showMapCard" class="overflow-hidden">
            <div class="flex items-center justify-between border-b border-neutral-100 px-6 py-4">
              <div>
                <h2 class="text-h4 font-semibold text-text-primary">
                  {{ isDelivered ? 'Trajet de livraison' : 'Localisation en direct' }}
                </h2>
                <p class="mt-0.5 text-body-sm text-text-muted">
                  {{ isDelivered ? 'Commande livrée à destination' : 'Mise à jour en temps réel' }}
                </p>
              </div>

              <div class="flex items-center gap-2">
                <!-- ETA live (arrivée estimée) -->
                <div v-if="etaLabel" class="flex items-center gap-1.5 rounded-full bg-primary-50 px-3 py-1.5">
                  <Icon name="ph:clock-countdown" class="size-4 text-primary-600" />
                  <span class="text-caption font-medium text-primary-700">Arrivée ~{{ etaLabel }}</span>
                </div>

                <!-- Livré : chip vert · sinon indicateur de connexion (D-05) -->
                <div v-if="isDelivered" class="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5">
                  <Icon name="ph:check-circle-fill" class="size-4 text-emerald-600" />
                  <span class="text-caption font-medium text-emerald-700">Livré</span>
                </div>
                <div v-else class="flex items-center gap-2 rounded-full px-3 py-1.5" :class="reconnecting ? 'bg-amber-50' : 'bg-emerald-50'">
                  <span
                    class="size-2 rounded-full"
                    :class="reconnecting ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'"
                  />
                  <span class="text-caption font-medium" :class="reconnecting ? 'text-amber-700' : 'text-emerald-700'">
                    {{ reconnecting ? 'reconnexion…' : 'en direct' }}
                  </span>
                </div>

                <!-- Bouton replier/déplier (mobile) -->
                <button
                  type="button"
                  class="flex size-9 items-center justify-center rounded-full border border-neutral-200 text-text-muted transition-colors hover:bg-neutral-50 lg:hidden"
                  :aria-expanded="!mapCollapsed"
                  :aria-label="mapCollapsed ? 'Déplier la carte' : 'Replier la carte'"
                  @click="mapCollapsed = !mapCollapsed"
                >
                  <Icon :name="mapCollapsed ? 'ph:caret-down' : 'ph:caret-up'" class="size-4" />
                </button>
              </div>
            </div>

            <div v-show="!mapCollapsed">
              <!-- Bannière de confirmation (livré) -->
              <div v-if="isDelivered" class="flex items-center gap-2 border-b border-emerald-100 bg-emerald-50/60 px-6 py-3">
                <Icon name="ph:seal-check-fill" class="size-5 text-emerald-600" />
                <p class="text-body-sm font-medium text-text-primary">
                  Votre commande a été livrée avec succès. Merci d'avoir choisi EzTech !
                </p>
              </div>

              <LeafletMap
                :center="mapCenter"
                :zoom="14"
                :rider-pos="isDelivered ? frozenPos : riderPos"
                :warehouse-pos="warehousePos"
                :destination-pos="destinationPos"
                :delivered="isDelivered"
                height="380px"
              />

              <!-- Barre horodatage (jamais vide — last-known au chargement, D-05) -->
              <div class="flex items-center gap-3 border-t border-neutral-100 bg-neutral-50 px-6 py-3">
                <Icon name="ph:map-pin-line" class="size-4 text-primary-600" />
                <p class="text-body-sm text-text-muted">
                  <template v-if="isDelivered">Commande livrée à destination</template>
                  <template v-else-if="lastUpdateLabel">Dernière position à {{ lastUpdateLabel }}</template>
                  <template v-else>En attente de la position du livreur…</template>
                </p>
              </div>
            </div>
          </Card>

          <!-- Order Summary -->
          <Card class="p-5">
            <div class="flex items-center gap-3 mb-4">
              <div class="flex size-9 items-center justify-center rounded-full bg-primary-100">
                <Icon name="ph:receipt" class="size-4.5 text-primary-600" />
              </div>
              <h3 class="text-body font-semibold text-text-primary">Résumé de la commande</h3>
            </div>
            <div class="space-y-2.5 text-body-sm">
              <div v-for="(item, idx) in order.items" :key="item.productId || idx" class="flex items-center justify-between gap-4">
                <span class="text-text-secondary">{{ item.name }} <span v-if="item.quantity > 1" class="text-text-muted">×{{ item.quantity }}</span></span>
                <span class="shrink-0 font-medium text-text-primary">{{ item.total.toFixed(2) }} &euro;</span>
              </div>
              <div class="border-t border-neutral-100 pt-3 mt-3 space-y-1.5">
                <div class="flex justify-between text-text-muted">
                  <span>Sous-total</span>
                  <span>{{ order.subtotal.toFixed(2) }} &euro;</span>
                </div>
                <div class="flex justify-between text-text-muted">
                  <span>Livraison</span>
                  <span>{{ order.deliveryFee > 0 ? `${order.deliveryFee.toFixed(2)} €` : 'Gratuite' }}</span>
                </div>
                <div class="flex justify-between font-semibold text-text-primary pt-1.5 border-t border-neutral-100">
                  <span>Total</span>
                  <span class="text-h4">{{ order.total.toFixed(2) }} &euro;</span>
                </div>
              </div>
            </div>
          </Card>

          <!-- Delivery Address -->
          <Card class="p-5">
            <div class="flex items-center gap-3 mb-3">
              <div class="flex size-9 items-center justify-center rounded-full bg-primary-100">
                <Icon name="ph:map-pin" class="size-4.5 text-primary-600" />
              </div>
              <h3 class="text-body font-semibold text-text-primary">Adresse de livraison</h3>
            </div>
            <p class="text-body-sm text-text-secondary">{{ order.deliveryAddress.street }}</p>
            <p class="text-body-sm text-text-muted">{{ order.deliveryAddress.zipCode }} {{ order.deliveryAddress.city }}</p>
          </Card>

          <!-- Info Cards -->
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div class="rounded-xl rounded-tl-feature bg-surface-purple border border-primary-100 p-4 flex items-center gap-3">
              <div class="flex size-10 items-center justify-center rounded-full bg-primary-100">
                <Icon name="ph:clock-countdown" class="size-5 text-primary-600" />
              </div>
              <div>
                <p class="text-body-sm font-semibold text-text-primary">Livraison rapide</p>
                <p class="text-caption text-text-muted">30 min ou moins</p>
              </div>
            </div>
            <div class="rounded-xl rounded-tr-feature bg-surface-violet border border-accent-100 p-4 flex items-center gap-3">
              <div class="flex size-10 items-center justify-center rounded-full bg-accent-100">
                <Icon name="ph:shield-check" class="size-5 text-accent-600" />
              </div>
              <div>
                <p class="text-body-sm font-semibold text-text-primary">Produits assurés</p>
                <p class="text-caption text-text-muted">Couverture complète</p>
              </div>
            </div>
            <div class="rounded-xl rounded-bl-feature bg-surface-lavender border border-primary-100 p-4 flex items-center gap-3">
              <div class="flex size-10 items-center justify-center rounded-full bg-primary-100">
                <Icon name="ph:arrows-clockwise" class="size-5 text-primary-600" />
              </div>
              <div>
                <p class="text-body-sm font-semibold text-text-primary">Annulation gratuite</p>
                <p class="text-caption text-text-muted">Avant la livraison</p>
              </div>
            </div>
            <div class="rounded-xl rounded-br-feature bg-surface-lilac border border-primary-100 p-4 flex items-center gap-3">
              <div class="flex size-10 items-center justify-center rounded-full bg-primary-100">
                <Icon name="ph:headset" class="size-5 text-primary-600" />
              </div>
              <div>
                <p class="text-body-sm font-semibold text-text-primary">Support 7j/7</p>
                <p class="text-caption text-text-muted">Assistance dédiée</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
