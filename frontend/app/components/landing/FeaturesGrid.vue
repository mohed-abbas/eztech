<script setup lang="ts">
// The 2x2 "Why EzTech?" cards. Content comes from the landing composable
// so copy changes don't require template edits.
const { features } = useLandingContent()
const { fadeUp } = useMotionPresets()
</script>

<template>
  <section class="bg-neutral-50 py-20 lg:py-28">
    <div class="mx-auto max-w-7xl px-6 lg:px-8">
      <div class="text-center mb-14">
        <h2 v-motion="fadeUp()" class="text-h1 font-medium leading-heading capitalize text-text-primary">
          Pourquoi EzTech ?
        </h2>
        <p v-motion="fadeUp(100)" class="mt-4 text-body-lg text-neutral-500/70 leading-body max-w-2xl mx-auto">
          Tout ce qu'il faut pour une expérience de location tech sans accroc — de la livraison express à la protection complète.
        </p>
      </div>

      <div class="grid gap-6 sm:grid-cols-2">
        <div
          v-for="(feature, idx) in features"
          :key="feature.title"
          v-motion="fadeUp(idx * 100)"
          class="group rounded-2xl border border-border bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-md hover:border-primary-200"
        >
          <div :class="['mb-4 flex size-12 items-center justify-center rounded-xl transition-colors duration-300', feature.bg, feature.hoverBg, feature.iconColor]">
            <Icon :name="feature.icon" class="size-6" />
          </div>
          <h3 class="text-h4 font-semibold text-text-primary">{{ feature.title }}</h3>
          <p class="mt-2 text-body-sm text-text-secondary leading-body">{{ feature.desc }}</p>
        </div>
      </div>
    </div>
  </section>
</template>
