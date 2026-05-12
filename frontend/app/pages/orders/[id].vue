<script setup lang="ts">
import { STATUS_CONFIG, ACTIVE_STATUSES, type OrderStatus } from '~/stores/orders'

const route = useRoute()

definePageMeta({ layout: 'default', middleware: 'auth' })

const orderId = computed(() => {
  const id = String(route.params.id)
  if (!/^[\w-]{1,50}$/.test(id)) return 'invalide'
  return id
})

useHead({ title: computed(() => `Commande #${orderId.value} - EzTech`) })

const store = useOrdersStore()
store.hydrate()

const order = computed(() => store.getOrder(orderId.value))
const rider = computed(() => order.value ? store.getRider(order.value.riderId) : undefined)

const currentStepIndex = computed(() => {
  if (!order.value) return 0
  return store.getStepIndex(order.value.status)
})

const isActive = computed(() => {
  if (!order.value) return false
  return ACTIVE_STATUSES.includes(order.value.status)
})

// Show live map only when rider is physically carrying the order
const TRANSIT_STATUSES: OrderStatus[] = ['picked_up', 'in_transit']
const showMap = computed(() => {
  if (!order.value) return false
  return TRANSIT_STATUSES.includes(order.value.status)
})

interface StepDisplay {
  key: OrderStatus
  label: string
  description: string
  icon: string
}

const STEPS: StepDisplay[] = [
  { key: 'pending', label: 'Commande passée', description: 'Votre commande a été confirmée', icon: 'ph:seal-check' },
  { key: 'confirmed', label: 'Confirmée', description: 'Commande validée et en attente de préparation', icon: 'ph:check-circle' },
  { key: 'preparing', label: 'En préparation', description: 'Vos produits sont préparés dans l\'entrepôt', icon: 'ph:package' },
  { key: 'rider_assigned', label: 'Livreur assigné', description: 'Un livreur a pris en charge votre commande', icon: 'ph:user-circle' },
  { key: 'picked_up', label: 'Récupérée', description: 'Le livreur a récupéré votre commande', icon: 'ph:cube' },
  { key: 'in_transit', label: 'En route', description: 'Votre commande est en chemin vers vous', icon: 'ph:motorcycle' },
  { key: 'delivered', label: 'Livrée', description: 'Commande livrée avec succès', icon: 'ph:house' },
]

function getStepStatus(index: number): 'completed' | 'active' | 'pending' {
  if (index < currentStepIndex.value) return 'completed'
  if (index === currentStepIndex.value) return 'active'
  return 'pending'
}

const vehicleLabels: Record<string, string> = {
  bicycle: 'Vélo cargo',
  scooter: 'Scooter',
  car: 'Voiture',
}

// Mock delivery route — coordinates must stay consistent with ROUTE endpoints
const WAREHOUSE: [number, number] = [48.8447, 2.3799]
const DESTINATION: [number, number] = [48.8584, 2.2945]
const ROUTE: [number, number][] = [
  [48.8447, 2.3799],
  [48.8461, 2.3712],
  [48.8480, 2.3640],
  [48.8500, 2.3560],
  [48.8520, 2.3490],
  [48.8538, 2.3400],
  [48.8551, 2.3320],
  [48.8563, 2.3220],
  [48.8575, 2.3110],
  [48.8584, 2.2945],
]
const MAP_CENTER: [number, number] = [48.8515, 2.3372]

// ETA countdown mock (18 minutes)
const etaMinutes = ref(18)
let etaInterval: ReturnType<typeof setInterval> | null = null

function clearEtaInterval() {
  if (etaInterval !== null) { clearInterval(etaInterval); etaInterval = null }
}

onMounted(() => {
  etaInterval = setInterval(() => {
    if (etaMinutes.value > 0) etaMinutes.value--
    else clearEtaInterval()
  }, 60000)
})

watch(isActive, (val) => {
  if (!val) clearEtaInterval()
})

onBeforeUnmount(() => {
  clearEtaInterval()
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

          <!-- ETA Badge (only for active orders) -->
          <div v-if="isActive" class="flex items-center gap-3 rounded-full bg-primary-500/20 border border-primary-400/30 px-5 py-2.5 backdrop-blur-sm">
            <span class="size-2.5 rounded-full bg-primary-400 animate-pulse" />
            <span class="text-body-sm font-semibold text-white">{{ order ? STATUS_CONFIG[order.status].label : '' }}</span>
            <div class="h-4 w-px bg-white/20" />
            <Icon name="ph:clock" class="size-4 text-primary-300" />
            <span class="text-body-sm font-medium text-primary-200">{{ etaMinutes }} min</span>
          </div>

          <!-- Delivered / Cancelled badge -->
          <div v-else-if="order" class="flex items-center gap-2 rounded-full px-5 py-2.5 backdrop-blur-sm" :class="STATUS_CONFIG[order.status].bg">
            <Icon :name="STATUS_CONFIG[order.status].icon" class="size-4" :class="STATUS_CONFIG[order.status].color" />
            <span class="text-body-sm font-semibold" :class="STATUS_CONFIG[order.status].color">{{ STATUS_CONFIG[order.status].label }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="mx-auto max-w-5xl px-6 py-10 sm:px-10">
      <!-- Loading -->
      <div v-if="store.loading" class="py-20 text-center text-text-muted">
        Chargement...
      </div>

      <!-- Order not found -->
      <EmptyState
        v-else-if="!order"
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
                      v-if="step.key === 'rider_assigned' && getStepStatus(index) !== 'pending' && rider"
                      class="mt-2 flex items-center gap-2 rounded-lg bg-surface-purple border border-primary-100 px-3 py-2 w-fit"
                    >
                      <div class="flex size-8 items-center justify-center rounded-full bg-primary-100">
                        <Icon name="ph:user" class="size-4 text-primary-600" />
                      </div>
                      <div>
                        <p class="text-body-sm font-medium text-text-primary">{{ rider.name }}</p>
                        <p class="text-caption text-text-muted">{{ vehicleLabels[rider.vehicleType] ?? rider.vehicleType }} · {{ rider.rating }} <Icon name="ph:star-fill" class="inline size-3 text-amber-400" /></p>
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
          <!-- Map Card (only when rider is physically in transit) -->
          <Card v-if="showMap" class="overflow-hidden">
            <div class="flex items-center justify-between border-b border-neutral-100 px-6 py-4">
              <div>
                <h2 class="text-h4 font-semibold text-text-primary">Localisation en direct</h2>
                <p class="mt-0.5 text-body-sm text-text-muted">Mise à jour en temps réel</p>
              </div>
              <div class="text-right">
                <p class="text-body font-semibold text-text-primary">{{ etaMinutes }} min</p>
                <p class="text-caption text-text-muted">Arrivée estimée</p>
              </div>
            </div>

            <LeafletMap
              :center="MAP_CENTER"
              :zoom="13"
              :route="ROUTE"
              :warehouse-pos="WAREHOUSE"
              :destination-pos="DESTINATION"
              :animate-rider="true"
              height="380px"
            />

            <!-- Rider bar under map -->
            <div v-if="rider" class="flex items-center gap-4 border-t border-neutral-100 bg-neutral-50 px-6 py-4">
              <div class="flex size-10 items-center justify-center rounded-full bg-primary-100">
                <Icon name="ph:user" class="size-5 text-primary-600" />
              </div>
              <div class="flex-1">
                <p class="text-body font-medium text-text-primary">{{ rider.name }}</p>
                <p class="text-body-sm text-text-muted">
                  {{ vehicleLabels[rider.vehicleType] ?? rider.vehicleType }} · {{ rider.rating }} <Icon name="ph:star-fill" class="inline size-3 text-amber-400" /> · {{ rider.totalDeliveries }} livraisons
                </p>
              </div>
              <Button variant="outline" size="sm">
                <Icon name="ph:phone" class="size-4" />
                Contacter
              </Button>
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
              <div v-for="item in order.items" :key="item.productId" class="flex items-center justify-between gap-4">
                <span class="text-text-secondary">{{ store.getProductName(item.productId) }} <span v-if="item.quantity > 1" class="text-text-muted">×{{ item.quantity }}</span></span>
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
