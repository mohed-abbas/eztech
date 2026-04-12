<script setup lang="ts">
import type { TimelineStep } from '~/components/DeliveryTimeline.vue'
import { STEP_CONFIG } from '~/components/DeliveryTimeline.vue'

const route = useRoute()
const orderId = route.params.id as string

definePageMeta({ layout: 'default' })

const order = {
  id: orderId,
  date: '23 mars 2026 · 14:18',
  address: '15 avenue de la Bourdonnais, 75007 Paris',
  items: [
    { name: 'iPhone 15 Pro 256Go', qty: 1, price: 1199, emoji: '📱' },
    { name: 'Coque MagSafe', qty: 2, price: 29, emoji: '🛡️' },
  ],
}

const timelineSteps: TimelineStep[] = [
  { key: 'passee',          timestamp: '14:18' },
  { key: 'en_preparation',  timestamp: '14:26' },
  { key: 'livreur_assigne', timestamp: '14:41' },
  { key: 'recuperee',       timestamp: '14:55' },
  { key: 'en_route',        timestamp: '15:03' },
  { key: 'livree' },
]

const STEP_EN_ROUTE = 4
const STEP_LIVREE   = 5

const currentStep = ref(1)
const currentStepLabel = computed(() => STEP_CONFIG[currentStep.value]?.label ?? '')

const leafletMap = ref<{ startAnimation: () => void } | null>(null)

watch(currentStep, (step) => {
  if (step === STEP_EN_ROUTE) {
    nextTick(() => leafletMap.value?.startAnimation())
  }
})

const rider = {
  name: 'Thomas Moreau',
  emoji: '🧑',
  vehicle: 'Vélo cargo',
  rating: 4.8,
  deliveries: 312,
  phone: '+33 6 12 34 56 78',
}

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
const INITIAL_ETA = 18 * 60

const etaMinutes = ref(18)
const stepTimeoutIds: ReturnType<typeof setTimeout>[] = []

onMounted(() => {
  ;[2, 3, 4].forEach((step, i) => {
    stepTimeoutIds.push(setTimeout(() => { currentStep.value = step }, (i + 1) * 5_000))
  })

  const iv = setInterval(() => {
    if (etaMinutes.value > 0) etaMinutes.value--
    else clearInterval(iv)
  }, 60_000)
})

onUnmounted(() => {
  stepTimeoutIds.forEach(clearTimeout)
})

function onDeliveryComplete() {
  currentStep.value = STEP_LIVREE
  etaMinutes.value = 0
}

const calling = ref(false)
function callRider() {
  calling.value = true
  setTimeout(() => { calling.value = false }, 2500)
}

const mapOpen = ref(true)
</script>

<template>
  <div class="min-h-screen bg-neutral-50">

    <header class="sticky top-0 z-30 flex items-center gap-3 border-b border-neutral-100 bg-white/90 backdrop-blur-md px-4 py-3">
      <NuxtLink
        to="/orders"
        class="flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-200 text-text-muted hover:bg-neutral-50 transition-colors"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </NuxtLink>

      <div class="flex-1 min-w-0">
        <h1 class="text-sm font-bold text-text-primary truncate">Commande #{{ orderId }}</h1>
        <p class="text-[11px] text-text-muted">{{ order.date }}</p>
      </div>

      <div
        class="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
        :class="currentStep === STEP_LIVREE
          ? 'bg-success/10 text-success'
          : 'bg-primary-50 text-primary-700'"
      >
        <span
          class="w-1.5 h-1.5 rounded-full"
          :class="currentStep === STEP_LIVREE ? 'bg-success' : 'bg-primary-500 animate-pulse'"
        />
        {{ currentStepLabel }}
      </div>
    </header>

    <div class="max-w-5xl mx-auto px-4 py-6 space-y-5">

      <div
        v-if="currentStep < STEP_LIVREE"
        class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-600 to-primary-800 p-5 text-white"
      >
        <div class="pointer-events-none absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/5" />
        <div class="pointer-events-none absolute -bottom-12 -right-4 w-56 h-56 rounded-full bg-white/5" />

        <div class="relative flex items-center gap-5">
          <div class="shrink-0 text-center">
            <p class="text-5xl font-black tabular-nums leading-none">{{ etaMinutes }}</p>
            <p class="text-xs font-medium text-white/60 uppercase tracking-widest mt-1">minutes</p>
          </div>

          <div class="w-px h-12 bg-white/20" />

          <div class="flex-1 min-w-0">
            <p class="text-xs font-semibold text-white/60 uppercase tracking-wider mb-1">Arrivée estimée</p>
            <p class="font-bold text-base leading-tight truncate">{{ order.address }}</p>
          </div>
        </div>
      </div>

      <div
        v-else
        class="flex items-center gap-4 rounded-2xl bg-success/10 border border-success/20 p-5"
      >
        <div class="w-12 h-12 rounded-full bg-success/20 flex items-center justify-center shrink-0">
          <svg class="w-7 h-7 text-success" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <p class="font-bold text-success">Commande livrée !</p>
          <p class="text-sm text-text-muted mt-0.5">Votre colis a été déposé. Profitez-en !</p>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-5 gap-5">

        <div class="lg:col-span-2">
          <div class="rounded-2xl bg-white border border-neutral-200 shadow-sm p-5">
            <div class="flex items-center justify-between mb-5">
              <h2 class="font-bold text-sm text-text-primary">Statut de la livraison</h2>
              <span class="text-[11px] text-text-muted font-mono tabular-nums">
                étape {{ currentStep + 1 }}/6
              </span>
            </div>

            <DeliveryTimeline
              :current-step="currentStep"
              :steps="timelineSteps"
            />
          </div>

          <div class="mt-4 rounded-2xl bg-white border border-neutral-200 shadow-sm p-5">
            <h2 class="font-bold text-sm text-text-primary mb-3">Récapitulatif</h2>
            <div class="space-y-2.5">
              <div
                v-for="item in order.items"
                :key="item.name"
                class="flex items-center gap-3"
              >
                <span class="text-xl shrink-0">{{ item.emoji }}</span>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-text-primary truncate">{{ item.name }}</p>
                  <p class="text-[11px] text-text-muted">Qté {{ item.qty }}</p>
                </div>
                <span class="text-sm font-semibold text-text-primary tabular-nums">
                  {{ (item.price * item.qty).toFixed(2) }} €
                </span>
              </div>
            </div>
          </div>
        </div>

        <div class="lg:col-span-3 space-y-4">

          <div class="rounded-2xl bg-white border border-neutral-200 shadow-sm overflow-hidden">
            <div class="flex items-center justify-between px-5 py-3.5 border-b border-neutral-100">
              <h2 class="font-bold text-sm text-text-primary">Localisation en direct</h2>
              <div class="flex items-center gap-3">
                <div class="flex items-center gap-1.5 text-[11px] text-success font-medium">
                  <span class="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                  Temps réel
                </div>
                <button
                  class="lg:hidden flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-[11px] font-semibold text-text-secondary hover:bg-neutral-100 transition-colors active:scale-95"
                  @click="mapOpen = !mapOpen"
                >
                  <svg
                    class="w-3.5 h-3.5 transition-transform duration-300"
                    :class="mapOpen ? 'rotate-180' : 'rotate-0'"
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                  {{ mapOpen ? 'Replier' : 'Voir la carte' }}
                </button>
              </div>
            </div>

            <div
              class="overflow-hidden transition-all duration-500 ease-in-out"
              :style="{ maxHeight: mapOpen ? '420px' : '0px' }"
            >
              <LeafletMap
                ref="leafletMap"
                :center="MAP_CENTER"
                :zoom="13"
                :route="ROUTE"
                :warehouse-pos="WAREHOUSE"
                :destination-pos="DESTINATION"
                :animate-rider="true"
                :auto-center="true"
                :initial-eta="INITIAL_ETA"
                height="380px"
                @delivery-complete="onDeliveryComplete"
              />
            </div>
          </div>

          <div class="rounded-2xl bg-white border border-neutral-200 shadow-sm p-4">
            <div class="flex items-center gap-4">
              <div class="w-14 h-14 rounded-xl bg-primary-50 flex items-center justify-center text-3xl shrink-0">
                {{ rider.emoji }}
              </div>

              <div class="flex-1 min-w-0">
                <p class="font-bold text-text-primary">{{ rider.name }}</p>
                <div class="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span class="text-[11px] text-text-muted">{{ rider.vehicle }}</span>
                  <span class="text-neutral-200">·</span>
                  <span class="flex items-center gap-0.5 text-[11px] text-warning font-semibold">
                    ★ {{ rider.rating }}
                  </span>
                  <span class="text-neutral-200">·</span>
                  <span class="text-[11px] text-text-muted">{{ rider.deliveries }} livraisons</span>
                </div>
              </div>

              <button
                class="flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all active:scale-[.97]"
                :class="calling
                  ? 'border-success/30 bg-success/5 text-success'
                  : 'border-neutral-200 bg-neutral-50 text-text-secondary hover:bg-neutral-100'"
                @click="callRider"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                {{ calling ? 'Appel…' : 'Appeler' }}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  </div>
</template>
