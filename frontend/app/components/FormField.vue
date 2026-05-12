<script setup lang="ts">
defineProps<{
  id: string
  label: string
  error?: string
  hint?: string
  required?: boolean
}>()
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <label :for="id" class="text-body-sm font-medium text-neutral-800">
      {{ label }}
      <span v-if="required" class="text-error">*</span>
    </label>
    <slot :id="id" :has-error="!!error" />
    <p
      v-if="error"
      :id="`${id}-error`"
      role="alert"
      class="text-caption text-error"
    >
      {{ error }}
    </p>
    <p
      v-else-if="hint"
      class="text-caption text-text-muted"
    >
      {{ hint }}
    </p>
  </div>
</template>
