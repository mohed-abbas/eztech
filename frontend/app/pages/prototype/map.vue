<script setup lang="ts">
definePageMeta({ layout: 'default' })

// Itinéraire parisien prédéfini : Entrepôt (12e) → Destination (7e)
const WAREHOUSE: [number, number] = [48.8447, 2.3799]  // Gare de Lyon
const DESTINATION: [number, number] = [48.8584, 2.2945] // Tour Eiffel

// Points intermédiaires simulant une route parisienne
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

const CENTER: [number, number] = [48.8515, 2.3372]
</script>

<template>
  <div class="min-h-screen bg-bg-muted py-10 px-6">
    <div class="max-w-4xl mx-auto space-y-8">

      <!-- Header -->
      <div>
        <h1 class="text-h2 font-bold text-text-primary">Prototype — Carte Leaflet</h1>
        <p class="text-text-muted mt-1">
          Intégration manuelle Leaflet dans Nuxt 4 · Tuiles CartoDB Positron · Marqueurs custom · Polyline · Animation
        </p>
      </div>

      <!-- Badge décision d'intégration -->
      <div class="flex flex-wrap gap-3">
        <span class="inline-flex items-center gap-2 rounded-full bg-success/10 border border-success/30 px-4 py-1.5 text-sm font-medium text-success">
          ✓ Approche choisie : Intégration manuelle Leaflet
        </span>
        <span class="inline-flex items-center gap-2 rounded-full bg-neutral-100 border border-neutral-200 px-4 py-1.5 text-sm text-text-muted">
          ✗ Vue-Leaflet écarté (SSR instable en Nuxt 4)
        </span>
      </div>

      <!-- Carte principale avec animation -->
      <div class="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
        <div class="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
          <div>
            <h2 class="font-semibold text-text-primary">Carte de livraison en direct</h2>
            <p class="text-sm text-text-muted mt-0.5">Gare de Lyon → Tour Eiffel · Animation toutes les 2.5s</p>
          </div>
          <span class="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-xs font-medium text-success">
            <span class="w-2 h-2 rounded-full bg-success animate-pulse" />
            En route
          </span>
        </div>

        <LeafletMap
          :center="CENTER"
          :zoom="13"
          :route="ROUTE"
          :warehouse-pos="WAREHOUSE"
          :destination-pos="DESTINATION"
          :animate-rider="true"
          height="420px"
        />

        <div class="px-6 py-4 bg-neutral-50 flex items-center gap-6 text-sm">
          <div class="flex items-center gap-2">
            <span class="w-3 h-3 rounded-full bg-warning inline-block" />
            <span class="text-text-muted">Entrepôt EzTech</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="w-3 h-3 rounded-full bg-error inline-block" />
            <span class="text-text-muted">Adresse de livraison</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="w-3 h-3 rounded-full bg-primary-600 inline-block" />
            <span class="text-text-muted">Livreur (animé)</span>
          </div>
          <div class="flex items-center gap-2 ml-auto">
            <span class="text-text-muted">Tuiles :</span>
            <span class="font-medium text-text-primary">CartoDB Positron</span>
          </div>
        </div>
      </div>

      <!-- Carte statique (sans animation) -->
      <div class="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
        <div class="px-6 py-4 border-b border-neutral-100">
          <h2 class="font-semibold text-text-primary">Carte statique — marqueur + polyline</h2>
          <p class="text-sm text-text-muted mt-0.5">Route tracée, livreur positionné au départ</p>
        </div>
        <LeafletMap
          :center="WAREHOUSE"
          :zoom="12"
          :route="ROUTE"
          :warehouse-pos="WAREHOUSE"
          :destination-pos="DESTINATION"
          :animate-rider="false"
          height="300px"
        />
      </div>

      <!-- Résumé technique -->
      <div class="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6">
        <h2 class="font-semibold text-text-primary mb-4">Décision technique — Leaflet dans Nuxt 4</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="rounded-xl border border-success/30 bg-success/5 p-4">
            <h3 class="font-medium text-success mb-2">✓ Intégration manuelle (retenu)</h3>
            <ul class="space-y-1 text-sm text-text-secondary">
              <li>• Suffixe <code class="bg-neutral-100 px-1 rounded">.client.vue</code> → SSR safe automatique</li>
              <li>• Import Leaflet lazy dans <code class="bg-neutral-100 px-1 rounded">onMounted</code></li>
              <li>• Contrôle total sur les icônes et comportements</li>
              <li>• Zéro dépendance extra au-delà de <code class="bg-neutral-100 px-1 rounded">leaflet</code></li>
            </ul>
          </div>
          <div class="rounded-xl border border-error/20 bg-error/5 p-4">
            <h3 class="font-medium text-error mb-2">✗ @vue-leaflet/vue-leaflet (écarté)</h3>
            <ul class="space-y-1 text-sm text-text-secondary">
              <li>• Erreurs SSR fréquentes (<code class="bg-neutral-100 px-1 rounded">window is not defined</code>)</li>
              <li>• Wrapper Vue 3 encore peu maintenu</li>
              <li>• Moins de flexibilité pour les icônes custom</li>
              <li>• Dépendance supplémentaire non justifiée</li>
            </ul>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>
