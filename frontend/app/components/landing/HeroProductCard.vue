<script setup lang="ts">
import type { FeaturedProduct } from '~/composables/useLandingContent'

// Landing-hero product card. Pixel-exact to the Figma mockup — hardcoded
// sizes, Urbanist font, and specific greys. Kept separate from the
// generic ProductCard because nothing here uses design tokens.
defineProps<{
  product: FeaturedProduct
}>()
</script>

<template>
  <div class="hero-product-card flex flex-col w-[290px] shrink-0 bg-[#f9fafb] border-[0.74px] border-[#e5e7eb] rounded-[9px] p-[15px] shadow-[0_0_50px_0_rgba(0,0,0,0.1)] transition-all duration-300">
    <div class="leading-[1.4]">
      <p class="font-urbanist font-semibold text-[17.8px] text-[#1f2937]">{{ product.name }}</p>
      <p class="font-urbanist font-medium text-[11.87px] text-[#6b7280]">{{ product.type }}</p>
    </div>

    <div class="w-full h-[111px] my-[9px] bg-neutral-100 rounded-md flex items-center justify-center overflow-hidden">
      <Icon :name="product.heroIcon" class="size-16 text-neutral-300" />
    </div>

    <div class="flex items-center justify-between mb-3">
      <div
        v-for="spec in [
          { icon: product.icon1, value: product.spec1 },
          { icon: product.icon2, value: product.spec2 },
          { icon: product.icon3, value: product.spec3 },
        ]"
        :key="spec.value"
        class="flex items-center gap-1"
      >
        <Icon :name="spec.icon" class="size-[18px] text-[#6b7280]" />
        <span class="font-urbanist font-medium text-[11.87px] leading-[1.4] text-[#6b7280]">{{ spec.value }}</span>
      </div>
    </div>

    <hr class="border-[#e5e7eb]">

    <div class="flex items-center justify-between mt-3">
      <div class="flex items-end leading-[1.4]">
        <span class="font-urbanist font-semibold text-[23.74px] text-[#1f2937]">{{ product.price }}/</span>
        <span class="font-urbanist font-medium text-[11.87px] text-[#6b7280]">Day</span>
      </div>
      <NuxtLink
        to="/products"
        class="bg-[#1f2937] hover:bg-[#111827] rounded-full text-white px-[15px] py-[9px] font-urbanist font-medium text-[14.84px] leading-[1.4] transition-colors"
      >
        Rent Now
      </NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.font-urbanist { font-family: 'Urbanist', sans-serif; }
</style>
