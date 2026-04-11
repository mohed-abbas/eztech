<script setup lang="ts">
export interface TimelineStep {
  key: string
  label: string
  description: string
  timestamp?: string
}

interface Props {
  currentStep: number // 0 = passée … 5 = livrée
  steps?: TimelineStep[]
}

const props = withDefaults(defineProps<Props>(), {
  currentStep: 0,
})

// ─── Configuration visuelle de chaque étape ───────────────────────
const STEP_CONFIG = [
  {
    color: '#10B981',      // emerald
    bg: '#ECFDF5',
    ring: 'rgba(16,185,129,.25)',
    label: 'Commande passée',
    description: 'Votre commande a été confirmée et enregistrée',
    svgPath: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
    number: '01',
  },
  {
    color: '#F59E0B',      // amber
    bg: '#FFFBEB',
    ring: 'rgba(245,158,11,.25)',
    label: 'En préparation',
    description: 'Vos articles sont préparés dans l\'entrepôt',
    svgPath: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
    number: '02',
  },
  {
    color: '#6366F1',      // indigo
    bg: '#EEF2FF',
    ring: 'rgba(99,102,241,.25)',
    label: 'Livreur assigné',
    description: 'Un livreur a pris en charge votre commande',
    svgPath: 'M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z',
    number: '03',
  },
  {
    color: '#3B82F6',      // blue
    bg: '#EFF6FF',
    ring: 'rgba(59,130,246,.25)',
    label: 'Commande récupérée',
    description: 'Le livreur a récupéré le colis à l\'entrepôt',
    svgPath: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4',
    number: '04',
  },
  {
    color: '#7C3AED',      // violet brand
    bg: '#F5F3FF',
    ring: 'rgba(124,58,237,.35)',
    label: 'En route',
    description: 'Votre commande file vers vous à toute vitesse',
    svgPath: 'M13 10V3L4 14h7v7l9-11h-7z',
    number: '05',
  },
  {
    color: '#10B981',      // emerald
    bg: '#ECFDF5',
    ring: 'rgba(16,185,129,.25)',
    label: 'Livrée',
    description: 'Commande livrée avec succès. Profitez-en !',
    svgPath: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
    number: '06',
  },
]

const TOTAL = STEP_CONFIG.length

function status(i: number): 'completed' | 'active' | 'pending' {
  if (i < props.currentStep) return 'completed'
  if (i === props.currentStep) return 'active'
  return 'pending'
}

// Hauteur de la ligne de progression (rail)
const railFill = computed(() => {
  if (props.currentStep === 0) return '0%'
  if (props.currentStep >= TOTAL - 1) return '100%'
  // Position entre deux steps (icône centres à 20px du top de chaque row, rows ~88px)
  return `${(props.currentStep / (TOTAL - 1)) * 100}%`
})

// Steps résolus (props ou config par défaut)
const resolvedSteps = computed(() =>
  STEP_CONFIG.map((cfg, i) => ({
    ...cfg,
    timestamp: props.steps?.[i]?.timestamp ?? undefined,
  }))
)
</script>

<template>
  <div class="relative">
    <!-- Rail vertical -->
    <div class="absolute left-[27px] top-[27px] w-0.5 bg-neutral-100"
      :style="{ bottom: '27px' }" />
    <!-- Remplissage progressif du rail -->
    <div
      class="absolute left-[27px] top-[27px] w-0.5 bg-gradient-to-b from-success via-primary-500 to-primary-600 transition-all duration-700 ease-out origin-top"
      :style="{ height: railFill }"
    />

    <!-- Steps -->
    <div class="space-y-0">
      <div
        v-for="(step, i) in resolvedSteps"
        :key="step.number"
        class="relative flex items-start gap-4 py-3 group"
      >

        <!-- Nœud icône -->
        <div class="relative z-10 shrink-0">
          <!-- Halo animé (actif seulement) -->
          <div
            v-if="status(i) === 'active'"
            class="absolute inset-0 rounded-full animate-ping"
            :style="{ background: step.ring, transform: 'scale(1.6)' }"
          />
          <div
            class="relative w-14 h-14 rounded-full flex items-center justify-center transition-all duration-500 shadow-sm"
            :style="{
              background: status(i) === 'pending' ? '#F3F4F6' : step.bg,
              border: status(i) === 'active' ? `2px solid ${step.color}` : '2px solid transparent',
              boxShadow: status(i) === 'active' ? `0 0 0 4px ${step.ring}` : undefined,
            }"
          >
            <!-- Checkmark si complété -->
            <svg
              v-if="status(i) === 'completed'"
              class="w-6 h-6 transition-all duration-300"
              :style="{ color: step.color }"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <!-- Icône spécifique si actif ou en attente -->
            <svg
              v-else
              class="w-6 h-6 transition-all duration-300"
              :style="{ color: status(i) === 'pending' ? '#D1D5DB' : step.color }"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" :d="step.svgPath" />
            </svg>
          </div>
          <!-- Numéro d'étape -->
          <span
            class="absolute -bottom-1 -right-1 text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none transition-all"
            :style="{
              background: status(i) === 'pending' ? '#E5E7EB' : step.color,
              color: status(i) === 'pending' ? '#9CA3AF' : '#fff',
            }"
          >{{ i + 1 }}</span>
        </div>

        <!-- Contenu texte -->
        <div class="flex-1 min-w-0 pt-2">
          <div class="flex items-center gap-2 flex-wrap mb-0.5">
            <span
              class="font-semibold text-sm transition-colors duration-300"
              :style="{ color: status(i) === 'pending' ? '#9CA3AF' : '#262730' }"
            >
              {{ step.label }}
            </span>

            <!-- Badge actif -->
            <span
              v-if="status(i) === 'active'"
              class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
              :style="{ background: step.bg, color: step.color }"
            >
              <span
                class="w-1.5 h-1.5 rounded-full animate-pulse"
                :style="{ background: step.color }"
              />
              En cours
            </span>

            <!-- Horodatage -->
            <span
              v-if="step.timestamp && status(i) !== 'pending'"
              class="ml-auto text-[11px] font-mono text-text-muted tabular-nums"
            >
              {{ step.timestamp }}
            </span>
          </div>

          <p
            class="text-[13px] leading-relaxed transition-colors duration-300"
            :class="status(i) === 'pending' ? 'text-neutral-300' : 'text-text-muted'"
          >
            {{ step.description }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
