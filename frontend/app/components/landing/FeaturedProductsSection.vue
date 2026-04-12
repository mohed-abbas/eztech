<script setup lang="ts">
// Featured equipment grid. Reuses LandingProductCard with the "featured"
// variant — same data source as the hero cards, different visual treatment.
const { featuredProducts } = useLandingContent()
const { fadeUp } = useMotionPresets()
</script>

<template>
  <section id="pricing" class="bg-white py-20 lg:py-28">
    <div class="mx-auto max-w-7xl px-6 lg:px-8">
      <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-12">
        <div>
          <h2 v-motion="fadeUp()" class="text-h1 font-medium leading-heading capitalize text-text-primary">
            Featured Equipment
          </h2>
          <p v-motion="fadeUp(100)" class="mt-3 text-body-lg text-neutral-500/70 leading-body max-w-lg">
            Premium tech from top brands, available for daily or weekly rentals.
          </p>
        </div>
        <NuxtLink
          v-motion="fadeUp(200)"
          class="btn-glass bg-white rounded-full px-5 py-2.5 text-body-sm font-medium text-text-primary capitalize hover:bg-neutral-50 transition-colors shrink-0"
          to="/products"
        >
          View All Products
        </NuxtLink>
      </div>

      <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <LandingProductCard
          v-for="(product, idx) in featuredProducts"
          :key="product.name"
          v-motion="fadeUp(idx * 80)"
          :product="product"
          variant="featured"
        />
      </div>
    </div>
  </section>
</template>
