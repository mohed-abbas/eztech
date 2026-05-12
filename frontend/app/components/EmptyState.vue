<script setup lang="ts">
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <div class="bg-white rounded-2xl shadow-sm border border-neutral-200 p-12 text-center">
    <div v-if="$slots.icon" class="w-20 h-20 rounded-full bg-primary-50 flex items-center justify-center mx-auto mb-6">
      <slot name="icon" />
    </div>
    <h2 class="text-h4 font-semibold text-text-primary mb-2">
      {{ title }}
    </h2>
    <p v-if="description" class="text-text-muted mb-6">
      {{ description }}
    </p>
    <div v-if="$slots.actions" class="flex flex-col sm:flex-row gap-3 justify-center">
      <slot name="actions" />
    </div>
  </div>
</template>
