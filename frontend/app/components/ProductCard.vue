<script setup lang="ts">
import type { FeaturedProduct } from '~/composables/useLandingContent'

// Generic product card built on design-system tokens. Used by the
// featured section on the landing page and intended for reuse on the
// catalog, search, and cart-recommendations views.
const props = defineProps<{
  product: FeaturedProduct
  to?: string
  ctaLabel?: string
}>()

// A product carrying its own destination wins; the explicit `to` prop stays as an
// override for callers that build the link themselves (catalog grid).
const target = computed(() => props.product.to ?? props.to ?? '/products')
</script>

<template>
  <div class="flex flex-col bg-neutral-50 border border-neutral-200 rounded-xl p-4 shadow-[0_0_50px_0_rgba(0,0,0,0.1)] hover:border-primary-300 hover:shadow-[0_0_50px_0_rgba(139,92,246,0.12)] focus-within:border-primary-300 focus-within:shadow-[0_0_50px_0_rgba(139,92,246,0.12)] transition-all duration-300">
    <div class="leading-[1.4]">
      <p class="text-[18px] font-semibold text-neutral-800">{{ product.name }}</p>
      <p class="text-caption font-medium text-neutral-500">{{ product.type }}</p>
    </div>

    <div class="w-full h-28 my-3 bg-neutral-100 rounded-md flex items-center justify-center overflow-hidden">
      <ProductImage
        :src="product.imageUrl"
        :alt="product.name"
        :fallback-icon="product.heroIcon"
        img-class="size-full object-cover"
        icon-class="size-12 text-neutral-300"
      />
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
        <Icon :name="spec.icon" class="size-4.5 text-neutral-500" />
        <span class="text-caption font-medium text-neutral-500">{{ spec.value }}</span>
      </div>
    </div>

    <hr class="border-neutral-200">

    <div class="flex items-center justify-between mt-3">
      <div class="flex items-end leading-[1.4]">
        <span class="text-h3 font-semibold text-neutral-800">{{ product.price }}/</span>
        <span class="text-caption font-medium text-neutral-500">Jour</span>
      </div>
      <NuxtLink
        :to="target"
        class="bg-neutral-800 hover:bg-neutral-900 active:bg-black rounded-full text-white px-4 py-2 text-body-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
      >
        {{ ctaLabel ?? 'Louer' }}
      </NuxtLink>
    </div>
  </div>
</template>
