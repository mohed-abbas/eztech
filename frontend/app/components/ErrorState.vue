<script setup lang="ts">
/**
 * Pendant d'erreur de `EmptyState.vue`.
 * - `inline` : bandeau compact `role="alert"` (erreur de mutation / de chargement partiel)
 * - `block`  : carte pleine largeur reprenant la coque de EmptyState (echec de chargement total)
 * Utilise uniquement les tokens `--color-error`, jamais `red-*`.
 */
withDefaults(defineProps<{
  title: string
  description?: string
  variant?: 'inline' | 'block'
  icon?: string
}>(), {
  description: undefined,
  variant: 'block',
  icon: 'ph:warning-circle',
})
</script>

<template>
  <div
    v-if="variant === 'inline'"
    class="flex items-center gap-2 rounded-xl border border-error/20 bg-error/5 px-4 py-3 text-body-sm text-error"
    role="alert"
  >
    <Icon :name="icon" class="size-5 shrink-0" />
    <div class="min-w-0 flex-1">
      <p>{{ title }}</p>
      <p v-if="description" class="text-error/80">
        {{ description }}
      </p>
    </div>
    <div v-if="$slots.actions" class="shrink-0">
      <slot name="actions" />
    </div>
  </div>

  <div
    v-else
    class="bg-white rounded-2xl shadow-sm border border-neutral-200 p-12 text-center"
    role="alert"
  >
    <div class="w-20 h-20 rounded-full bg-error/10 flex items-center justify-center mx-auto mb-6">
      <slot name="icon">
        <Icon :name="icon" class="size-10 text-error" />
      </slot>
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
