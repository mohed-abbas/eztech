<script setup lang="ts">
const props = withDefaults(defineProps<{
  min?: number
  max?: number
  disabled?: boolean
}>(), {
  min: 1,
  max: 99,
  disabled: false,
})

const qty = defineModel<number>({ required: true })

function dec() {
  if (qty.value > props.min) qty.value = qty.value - 1
}

function inc() {
  if (qty.value < props.max) qty.value = qty.value + 1
}

function onInput(e: Event) {
  const raw = Number((e.target as HTMLInputElement).value)
  if (!Number.isFinite(raw)) return
  qty.value = Math.max(props.min, Math.min(raw, props.max))
}
</script>

<template>
  <div class="flex items-center border border-neutral-200 rounded-lg overflow-hidden">
    <button
      type="button"
      class="w-8 h-9 flex items-center justify-center text-text-secondary hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed"
      :disabled="disabled || qty <= min"
      aria-label="Diminuer la quantité"
      @click="dec"
    >
      −
    </button>
    <input
      :value="qty"
      type="number"
      :min="min"
      :max="max"
      :disabled="disabled"
      class="w-12 h-9 text-center font-medium text-text-primary bg-white focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
      aria-label="Quantité"
      @input="onInput"
    >
    <button
      type="button"
      class="w-8 h-9 flex items-center justify-center text-text-secondary hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed"
      :disabled="disabled || qty >= max"
      aria-label="Augmenter la quantité"
      @click="inc"
    >
      +
    </button>
  </div>
</template>
