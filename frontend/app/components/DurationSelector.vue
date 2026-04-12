<script setup lang="ts">
import type { DurationUnit } from '~/stores/cart'

defineProps<{
  availableUnits: DurationUnit[]
}>()

const value = defineModel<number>('value', { required: true })
const unit = defineModel<DurationUnit>('unit', { required: true })

const UNIT_LABEL: Record<DurationUnit, string> = {
  flat: 'location',
  hourly: 'heure',
  daily: 'jour',
  weekly: 'semaine',
}

function onValueInput(e: Event) {
  const raw = Number((e.target as HTMLInputElement).value)
  if (!Number.isFinite(raw)) return
  value.value = Math.max(1, raw)
}

function onUnitChange(e: Event) {
  unit.value = (e.target as HTMLSelectElement).value as DurationUnit
}
</script>

<template>
  <div class="flex items-center gap-2">
    <input
      :value="value"
      type="number"
      min="1"
      class="w-16 h-9 px-2 text-center border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
      aria-label="Valeur de durée"
      @input="onValueInput"
    >
    <select
      :value="unit"
      class="h-9 px-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
      aria-label="Unité de durée"
      @change="onUnitChange"
    >
      <option v-for="u in availableUnits" :key="u" :value="u">
        {{ UNIT_LABEL[u] }}{{ value > 1 ? 's' : '' }}
      </option>
    </select>
  </div>
</template>
