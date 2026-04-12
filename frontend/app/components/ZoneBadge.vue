<script setup lang="ts">
defineProps<{
  inZone: boolean
  zoneName?: string | null
}>()
</script>

<template>
  <div
    class="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium"
    :class="inZone
      ? 'bg-success/10 text-success'
      : 'bg-error/10 text-error'"
    role="status"
  >
    <span
      class="w-1.5 h-1.5 rounded-full"
      :class="inZone ? 'bg-success' : 'bg-error'"
    />
    <span v-if="inZone">Zone desservie : {{ zoneName }}</span>
    <span v-else>Hors zone de livraison</span>
  </div>
</template>
