<script setup lang="ts">
const route = useRoute()
const orderId = route.params.id

definePageMeta({ layout: 'default' })

type StepKey = 'passee' | 'en_preparation' | 'livreur_assigne' | 'recuperee' | 'en_route' | 'livree'

interface Step {
  key: StepKey
  label: string
  description: string
  icon: string
  color: string
  bgColor: string
}

const STEPS: Step[] = [
  {
    key: 'passee',
    label: 'Commande passée',
    description: 'Votre commande a été confirmée',
    icon: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z',
    color: 'text-success',
    bgColor: 'bg-success'
  },
  {
    key: 'en_preparation',
    label: 'En préparation',
    description: 'Vos produits sont préparés dans l\'entrepôt',
    icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
    color: 'text-info',
    bgColor: 'bg-info'
  },
  {
    key: 'livreur_assigne',
    label: 'Livreur assigné',
    description: 'Un livreur a pris en charge votre commande',
    icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
    color: 'text-primary-500',
    bgColor: 'bg-primary-500'
  },
  {
    key: 'recuperee',
    label: 'Récupérée',
    description: 'Le livreur a récupéré votre commande',
    icon: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4',
    color: 'text-warning',
    bgColor: 'bg-warning'
  },
  {
    key: 'en_route',
    label: 'En route',
    description: 'Votre commande est en chemin vers vous',
    icon: 'M13 10V3L4 14h7v7l9-11h-7z',
    color: 'text-primary-600',
    bgColor: 'bg-primary-600'
  },
  {
    key: 'livree',
    label: 'Livrée',
    description: 'Commande livrée avec succès',
    icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
    color: 'text-success',
    bgColor: 'bg-success'
  }
]

// État mock : livreur en route (étape 5)
const currentStepIndex = ref(4) // 'en_route'

function getStepStatus(index: number): 'completed' | 'active' | 'pending' {
  if (index < currentStepIndex.value) return 'completed'
  if (index === currentStepIndex.value) return 'active'
  return 'pending'
}

const timestamps: Record<StepKey, string> = {
  passee: '14:23',
  en_preparation: '14:31',
  livreur_assigne: '14:45',
  recuperee: '15:02',
  en_route: '15:08',
  livree: ''
}

// Infos livreur mock
const rider = {
  name: 'Thomas Moreau',
  photo: '🧑',
  vehicle: 'Vélo cargo',
  rating: 4.8,
  deliveries: 312
}

// Route de livraison mock Paris
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
onMounted(() => {
  const interval = setInterval(() => {
    if (etaMinutes.value > 0) etaMinutes.value--
    else clearInterval(interval)
  }, 60000)
})
</script>

<template>
  <div class="min-h-screen bg-bg-muted py-8 px-4">
    <div class="max-w-4xl mx-auto space-y-6">

      <!-- Header -->
      <div class="flex items-center gap-3">
        <NuxtLink to="/orders" class="text-text-muted hover:text-text-primary transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
        </NuxtLink>
        <div>
          <h1 class="text-h3 font-bold text-text-primary">Suivi de commande</h1>
          <p class="text-sm text-text-muted">Commande #{{ orderId }}</p>
        </div>
        <div class="ml-auto flex items-center gap-2 rounded-full bg-primary-50 border border-primary-100 px-4 py-2">
          <span class="w-2 h-2 rounded-full bg-primary-500 animate-pulse" />
          <span class="text-sm font-medium text-primary-700">En route · {{ etaMinutes }} min</span>
        </div>
      </div>

      <!-- Timeline statut (stepper) -->
      <div class="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6">
        <h2 class="font-semibold text-text-primary mb-6">Statut de la livraison</h2>

        <div class="relative">
          <!-- Ligne de progression -->
          <div class="absolute left-5 top-5 bottom-5 w-0.5 bg-neutral-100" />
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
              <!-- Icône de statut -->
              <div
                class="relative z-10 w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-2 transition-all duration-500"
                :class="{
                  'bg-success border-success': getStepStatus(index) === 'completed',
                  'bg-primary-600 border-primary-600 shadow-lg shadow-primary-200': getStepStatus(index) === 'active',
                  'bg-white border-neutral-200': getStepStatus(index) === 'pending'
                }"
              >
                <!-- Checkmark si complété -->
                <svg
                  v-if="getStepStatus(index) === 'completed'"
                  class="w-5 h-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
                </svg>
                <!-- Pulse si actif -->
                <div v-else-if="getStepStatus(index) === 'active'" class="w-3 h-3 rounded-full bg-white" />
                <!-- Cercle vide si en attente -->
                <div v-else class="w-3 h-3 rounded-full bg-neutral-200" />
              </div>

              <!-- Contenu de l'étape -->
              <div class="flex-1 pt-1.5">
                <div class="flex items-center gap-2 flex-wrap">
                  <span
                    class="font-medium transition-colors"
                    :class="{
                      'text-text-primary': getStepStatus(index) !== 'pending',
                      'text-text-muted': getStepStatus(index) === 'pending'
                    }"
                  >
                    {{ step.label }}
                  </span>

                  <!-- Badge actif -->
                  <span
                    v-if="getStepStatus(index) === 'active'"
                    class="inline-flex items-center gap-1 rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700"
                  >
                    <span class="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse" />
                    En cours
                  </span>

                  <!-- Horodatage -->
                  <span
                    v-if="timestamps[step.key]"
                    class="ml-auto text-xs text-text-muted"
                  >
                    {{ timestamps[step.key] }}
                  </span>
                </div>

                <p
                  class="text-sm mt-0.5"
                  :class="getStepStatus(index) === 'pending' ? 'text-neutral-300' : 'text-text-muted'"
                >
                  {{ step.description }}
                </p>

                <!-- Infos livreur sous "Livreur assigné" -->
                <div
                  v-if="step.key === 'livreur_assigne' && getStepStatus(index) !== 'pending'"
                  class="mt-2 flex items-center gap-2 rounded-lg bg-neutral-50 border border-neutral-100 px-3 py-2 w-fit"
                >
                  <span class="text-xl">{{ rider.photo }}</span>
                  <div>
                    <p class="text-sm font-medium text-text-primary">{{ rider.name }}</p>
                    <p class="text-xs text-text-muted">{{ rider.vehicle }} · ⭐ {{ rider.rating }}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Carte de localisation live -->
      <div class="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
        <div class="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
          <div>
            <h2 class="font-semibold text-text-primary">Localisation en direct</h2>
            <p class="text-sm text-text-muted mt-0.5">Mise à jour en temps réel</p>
          </div>
          <div class="text-right">
            <p class="text-sm font-semibold text-text-primary">ETA : {{ etaMinutes }} min</p>
            <p class="text-xs text-text-muted">Arrivée estimée</p>
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

        <!-- Infos livreur sous la carte -->
        <div class="px-6 py-4 bg-neutral-50 flex items-center gap-4">
          <span class="text-3xl">{{ rider.photo }}</span>
          <div class="flex-1">
            <p class="font-medium text-text-primary">{{ rider.name }}</p>
            <p class="text-sm text-text-muted">{{ rider.vehicle }} · ⭐ {{ rider.rating }} · {{ rider.deliveries }} livraisons</p>
          </div>
          <button class="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-text-secondary hover:bg-neutral-50 transition-colors">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
            </svg>
            Contacter
          </button>
        </div>
      </div>

    </div>
  </div>
</template>
