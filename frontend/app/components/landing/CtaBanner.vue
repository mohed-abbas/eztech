<script setup lang="ts">
// Final CTA banner before the footer. Customisable via slot so other
// pages can reuse the same dark pill-shaped banner with different copy.
const { fadeScale } = useMotionPresets()

withDefaults(defineProps<{
  title?: string
  subtitle?: string
  ctaLabel?: string
  ctaTo?: string
}>(), {
  title: "Votre tech — livrée avec style.",
  subtitle: 'Rejoignez des milliers d\'utilisateurs qui font confiance à EzTech pour des locations haut de gamme, sans prise de tête.',
  ctaLabel: 'Commencer maintenant',
  ctaTo: '/register',
})
</script>

<template>
  <section class="px-6 lg:px-8 pb-20 lg:pb-28">
    <div
      v-motion="fadeScale()"
      class="mx-auto max-w-7xl bg-section-dark rounded-3xl py-16 flex flex-col items-center gap-6 text-center px-8 relative overflow-hidden"
    >
      <div class="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full bg-primary-500/15 blur-3xl" />
      <div class="pointer-events-none absolute -bottom-16 -left-16 size-64 rounded-full bg-primary-400/10 blur-2xl" />

      <div class="relative flex flex-col gap-3 items-center">
        <slot name="title">
          <h2 class="text-h1 sm:text-[3.5rem] font-medium leading-heading text-white max-w-md">
            {{ title }}
          </h2>
        </slot>
        <slot name="subtitle">
          <p class="text-body-lg font-light text-neutral-300 leading-body">
            {{ subtitle }}
          </p>
        </slot>
      </div>

      <NuxtLink
        :to="ctaTo"
        class="relative bg-white rounded-full px-5 py-2.5 flex items-center gap-2.5 text-body font-medium text-neutral-800 hover:bg-neutral-50 transition-colors"
      >
        {{ ctaLabel }}
        <Icon name="ph:arrow-right" class="size-5" />
      </NuxtLink>
    </div>
  </section>
</template>
