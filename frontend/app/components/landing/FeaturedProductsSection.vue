<script setup lang="ts">
// Featured equipment grid. Uses the generic ProductCard so the same
// component can be reused by the catalog, search, and cart views.
const { featuredProducts } = useLandingContent()
const { fadeUp } = useMotionPresets()
</script>

<template>
  <section id="pricing" class="bg-white py-20 lg:py-28">
    <div class="mx-auto max-w-7xl px-6 lg:px-8">
      <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-12">
        <div>
          <h2 v-motion="fadeUp()" class="text-h1 font-medium leading-heading capitalize text-text-primary">
            Équipements à la une
          </h2>
          <p v-motion="fadeUp(100)" class="mt-3 text-body-lg text-neutral-500/70 leading-body max-w-lg">
            Matériel haut de gamme des meilleures marques, disponible à la journée ou à la semaine.
          </p>
        </div>
        <NuxtLink
          v-motion="fadeUp(200)"
          class="btn-glass bg-white rounded-full px-5 py-2.5 text-body-sm font-medium text-text-primary capitalize hover:bg-neutral-50 transition-colors shrink-0"
          to="/products"
        >
          Voir tous les produits
        </NuxtLink>
      </div>

      <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <ProductCard
          v-for="(product, idx) in featuredProducts"
          :key="product.name"
          v-motion="fadeUp(idx * 80)"
          :product="product"
        />
      </div>
    </div>
  </section>
</template>
