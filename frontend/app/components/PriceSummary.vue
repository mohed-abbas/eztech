<script setup lang="ts">
defineProps<{
  title?: string
  subtotal: number
  deliveryFee: number
  total: number
}>()
</script>

<template>
  <div class="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6">
    <h2 class="font-semibold text-text-primary mb-5">
      {{ title ?? 'Récapitulatif' }}
    </h2>

    <div class="space-y-2 text-sm">
      <div class="flex justify-between text-text-secondary">
        <span>Sous-total</span>
        <span>{{ subtotal.toFixed(2) }} €</span>
      </div>
      <div class="flex justify-between text-text-secondary">
        <span>Frais de livraison</span>
        <span>{{ deliveryFee.toFixed(2) }} €</span>
      </div>
      <div class="flex justify-between font-bold text-text-primary pt-3 mt-3 border-t border-neutral-100 text-base">
        <span>Total</span>
        <span>{{ total.toFixed(2) }} €</span>
      </div>
    </div>

    <div v-if="$slots.actions" class="mt-6">
      <slot name="actions" />
    </div>

    <div v-if="$slots.footer" class="mt-3 text-xs text-text-muted text-center">
      <slot name="footer" />
    </div>
  </div>
</template>
