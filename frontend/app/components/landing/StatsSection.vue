<script setup lang="ts">
// Stats row: four coloured tiles pulled from useLandingContent so the
// values live next to the other landing copy instead of inside markup.
const { statCards } = useLandingContent()
const { fadeUp } = useMotionPresets()
</script>

<template>
  <section class="bg-neutral-50 py-20 lg:py-24">
    <div class="mx-auto max-w-7xl px-6 lg:px-8">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div
          v-for="(stat, idx) in statCards"
          :key="stat.title"
          v-motion="fadeUp(idx * 100)"
          :class="['p-5', stat.bg, stat.corner]"
        >
          <p class="text-h2 font-medium leading-heading text-neutral-800">{{ stat.value }}</p>
          <div class="mt-3 flex flex-col gap-2">
            <p class="text-h4 font-medium text-neutral-800">{{ stat.title }}</p>
            <p class="text-body text-neutral-500 leading-body">{{ stat.desc }}</p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
