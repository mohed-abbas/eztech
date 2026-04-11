<script setup lang="ts">
import type { Address } from '~/stores/auth'

defineProps<{
  address: Address
  selected: boolean
}>()

defineEmits<{
  select: [addressId: string]
}>()
</script>

<template>
  <button
    type="button"
    class="w-full text-left rounded-xl border p-4 transition-all"
    :class="selected
      ? 'border-primary-500 bg-primary-50/30 ring-2 ring-primary-500/20'
      : 'border-neutral-200 hover:border-neutral-300 bg-white'"
    @click="$emit('select', address.id)"
  >
    <div class="flex items-start gap-3">
      <div
        class="mt-1 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center"
        :class="selected ? 'border-primary-600' : 'border-neutral-300'"
      >
        <div v-if="selected" class="w-2 h-2 rounded-full bg-primary-600" />
      </div>
      <div class="flex-1 min-w-0">
        <p class="font-semibold text-text-primary">
          {{ address.label }}
        </p>
        <p class="text-sm text-text-secondary">
          {{ address.street }}
        </p>
        <p class="text-sm text-text-muted">
          {{ address.zipCode }} {{ address.city }}
        </p>
      </div>
    </div>
  </button>
</template>
