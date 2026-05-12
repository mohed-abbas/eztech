<script setup lang="ts">
import type { CartItem, DurationUnit } from '~/stores/cart'
import QuantityStepper from './QuantityStepper.vue'
import DurationSelector from './DurationSelector.vue'

const props = defineProps<{
  item: CartItem
  linePrice: number
}>()

const emit = defineEmits<{
  remove: [productId: string]
  updateQuantity: [productId: string, qty: number]
  updateDuration: [productId: string, unit: DurationUnit, value: number]
}>()

const qty = computed<number>({
  get: () => props.item.quantity,
  set: v => emit('updateQuantity', props.item.productId, v),
})

const durationValue = computed<number>({
  get: () => props.item.durationValue,
  set: v => emit('updateDuration', props.item.productId, props.item.durationUnit, v),
})

const durationUnit = computed<DurationUnit>({
  get: () => props.item.durationUnit,
  set: u => emit('updateDuration', props.item.productId, u, props.item.durationValue),
})

const availableUnits: DurationUnit[] = ['hourly', 'daily', 'weekly']

const hasRealImage = computed(() =>
  props.item.image && (props.item.image.startsWith('http') || !props.item.image.startsWith('/assets/')),
)
</script>

<template>
  <div class="bg-white rounded-2xl shadow-sm border border-neutral-200 p-5">
    <div class="flex gap-4">
      <img
        v-if="hasRealImage"
        :src="item.image"
        :alt="item.name"
        class="w-20 h-20 rounded-xl object-cover bg-neutral-100"
        @error="($event.target as HTMLImageElement).style.display = 'none'"
      >
      <div v-else class="w-20 h-20 rounded-xl bg-primary-50 flex items-center justify-center shrink-0">
        <svg class="w-8 h-8 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
        </svg>
      </div>

      <div class="flex-1 min-w-0">
        <div class="flex items-start gap-3">
          <div class="flex-1 min-w-0">
            <h3 class="font-semibold text-text-primary truncate">
              {{ item.name }}
            </h3>
            <p class="text-xs text-text-muted mt-0.5">
              Stock disponible : {{ item.stock }}
            </p>
          </div>
          <button
            class="text-text-muted hover:text-error transition-colors shrink-0"
            aria-label="Supprimer"
            @click="emit('remove', item.productId)"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M10 7V4a1 1 0 011-1h2a1 1 0 011 1v3" />
            </svg>
          </button>
        </div>

        <div class="mt-4 flex flex-wrap items-end gap-4">
          <div>
            <label class="block text-xs font-medium text-text-secondary mb-1">Quantité</label>
            <QuantityStepper v-model="qty" :min="1" :max="item.stock" />
          </div>

          <div v-if="item.pricingType === 'tiered'">
            <label class="block text-xs font-medium text-text-secondary mb-1">Durée</label>
            <DurationSelector
              v-model:value="durationValue"
              v-model:unit="durationUnit"
              :available-units="availableUnits"
            />
          </div>

          <div v-else class="text-xs text-text-muted">
            Prix fixe par location
          </div>

          <div class="ml-auto text-right">
            <p class="text-xs text-text-muted">
              Sous-total
            </p>
            <p class="text-lg font-bold text-text-primary">
              {{ linePrice.toFixed(2) }} €
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
