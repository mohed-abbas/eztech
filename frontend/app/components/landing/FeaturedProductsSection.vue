<script setup lang="ts">
// Featured equipment grid. Uses the generic ProductCard so the same
// component can be reused by the catalog, search, and cart views.
// The products are the real catalog rows flagged `featured` (see useLandingContent).
const { featuredProducts, featuredPending } = useLandingContent()
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

      <div v-if="featuredPending" class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div v-for="n in 4" :key="n" class="animate-pulse rounded-xl border border-neutral-200 bg-neutral-50 p-4">
          <div class="mb-3 h-5 w-2/3 rounded bg-neutral-100" />
          <div class="mb-3 h-3 w-1/3 rounded bg-neutral-100" />
          <div class="mb-3 h-28 rounded-md bg-neutral-100" />
          <hr class="my-3 border-neutral-100">
          <div class="flex items-center justify-between">
            <div class="h-7 w-20 rounded bg-neutral-100" />
            <div class="h-9 w-24 rounded-full bg-neutral-100" />
          </div>
        </div>
      </div>

      <div v-else-if="featuredProducts.length" class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <ProductCard
          v-for="(product, idx) in featuredProducts"
          :key="product.name"
          v-motion="fadeUp(idx * 80)"
          :product="product"
          :to="product.to"
        />
      </div>

      <p v-else class="text-body text-neutral-500">
        Aucun équipement à la une pour le moment.
        <NuxtLink to="/products" class="font-medium text-primary-600 hover:underline">Voir tout le catalogue</NuxtLink>
      </p>
    </div>
  </section>
</template>
