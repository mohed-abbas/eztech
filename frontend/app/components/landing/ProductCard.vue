<script setup lang="ts">
import type { FeaturedProduct } from '~/composables/useLandingContent'

// Reusable product card used in two places on the landing page: the
// hero composite (tighter, Figma-exact pixel values) and the featured
// grid lower down (design-system tokens). Same data, two looks.
const props = defineProps<{
  product: FeaturedProduct
  variant?: 'hero' | 'featured'
}>()

const variant = computed(() => props.variant ?? 'featured')
</script>

<template>
  <div
    :class="[
      'flex flex-col transition-all duration-300',
      variant === 'hero'
        ? 'hero-product-card w-[290px] shrink-0 bg-[#f9fafb] border-[0.74px] border-[#e5e7eb] rounded-[9px] p-[15px] shadow-[0_0_50px_0_rgba(0,0,0,0.1)]'
        : 'bg-neutral-50 border border-neutral-200 rounded-xl p-4 shadow-[0_0_50px_0_rgba(0,0,0,0.1)] hover:border-primary-300 hover:shadow-[0_0_50px_0_rgba(139,92,246,0.12)]',
    ]"
  >
    <div class="leading-[1.4]">
      <p
        :class="variant === 'hero'
          ? 'font-urbanist font-semibold text-[17.8px] text-[#1f2937]'
          : 'text-[18px] font-semibold text-neutral-800'"
      >
        {{ product.name }}
      </p>
      <p
        :class="variant === 'hero'
          ? 'font-urbanist font-medium text-[11.87px] text-[#6b7280]'
          : 'text-caption font-medium text-neutral-500'"
      >
        {{ product.type }}
      </p>
    </div>

    <div
      :class="[
        'w-full bg-neutral-100 rounded-md flex items-center justify-center overflow-hidden',
        variant === 'hero' ? 'h-[111px] my-[9px]' : 'h-28 my-3',
      ]"
    >
      <Icon
        :name="product.heroIcon"
        :class="variant === 'hero' ? 'size-16 text-neutral-300' : 'size-12 text-neutral-300'"
      />
    </div>

    <div class="flex items-center justify-between mb-3">
      <div v-for="spec in [
        { icon: product.icon1, value: product.spec1 },
        { icon: product.icon2, value: product.spec2 },
        { icon: product.icon3, value: product.spec3 },
      ]" :key="spec.value" class="flex items-center gap-1">
        <Icon
          :name="spec.icon"
          :class="variant === 'hero' ? 'size-[18px] text-[#6b7280]' : 'size-4.5 text-neutral-500'"
        />
        <span
          :class="variant === 'hero'
            ? 'font-urbanist font-medium text-[11.87px] leading-[1.4] text-[#6b7280]'
            : 'text-caption font-medium text-neutral-500'"
        >
          {{ spec.value }}
        </span>
      </div>
    </div>

    <hr :class="variant === 'hero' ? 'border-[#e5e7eb]' : 'border-neutral-200'">

    <div class="flex items-center justify-between mt-3">
      <div class="flex items-end leading-[1.4]">
        <span
          :class="variant === 'hero'
            ? 'font-urbanist font-semibold text-[23.74px] text-[#1f2937]'
            : 'text-h3 font-semibold text-neutral-800'"
        >
          {{ product.price }}/
        </span>
        <span
          :class="variant === 'hero'
            ? 'font-urbanist font-medium text-[11.87px] text-[#6b7280]'
            : 'text-caption font-medium text-neutral-500'"
        >
          Day
        </span>
      </div>
      <NuxtLink
        to="/products"
        :class="[
          'rounded-full text-white transition-colors',
          variant === 'hero'
            ? 'bg-[#1f2937] hover:bg-[#111827] px-[15px] py-[9px] font-urbanist font-medium text-[14.84px] leading-[1.4]'
            : 'bg-neutral-800 hover:bg-neutral-900 px-4 py-2 text-body-sm font-medium',
        ]"
      >
        Rent Now
      </NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.font-urbanist { font-family: 'Urbanist', sans-serif; }
</style>
