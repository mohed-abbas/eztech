<script setup lang="ts">
import type { FeaturedProduct } from '~/composables/useLandingContent'

useHead({
  title: "Catalogue - EzTech",
});

type Product = {
  id: string;
  name: string;
  description: string;
  category?: string;
  image?: string;
  price: number;
  rating?: number;
  stock: number;
};

const {
  data: products,
  status,
  error,
  refresh,
} = await useFetch<Product[]>("/api/products", {
  default: () => [],
});

const categoryIcons: Record<string, string> = {
  laptop: 'ph:laptop',
  camera: 'ph:camera',
  drone: 'ph:drone',
  tablet: 'ph:device-tablet',
  phone: 'ph:device-mobile',
  audio: 'ph:headphones',
  gaming: 'ph:game-controller',
}

function toFeaturedProduct(p: Product): FeaturedProduct {
  const category = (p.category ?? 'laptop').toLowerCase()
  return {
    name: p.name,
    type: p.category ?? 'Tech',
    price: `€${Number(p.price).toFixed(2)}`,
    heroIcon: categoryIcons[category] ?? 'ph:package',
    icon1: 'ph:star',
    spec1: p.rating ? `${p.rating}` : '—',
    icon2: 'ph:cube',
    spec2: `${p.stock} left`,
    icon3: 'ph:tag',
    spec3: `€${Number(p.price).toFixed(0)}`,
  }
}
</script>

<template>
  <main class="min-h-screen px-4 py-10 sm:px-6 md:px-10">
    <div class="mx-auto max-w-6xl">
      <header class="mb-8">
        <h1 class="text-2xl font-bold text-text-primary sm:text-3xl md:text-4xl">
          Catalogue
        </h1>
        <p class="mt-2 text-text-muted">
          Tous nos produits disponibles à la location.
        </p>
      </header>

      <div v-if="status === 'pending'" class="text-text-muted">
        Chargement des produits...
      </div>

      <div
        v-else-if="error"
        class="rounded-lg border border-red-300 bg-red-50 p-4 text-red-700"
      >
        Impossible de charger les produits.
        <button class="ml-2 underline" type="button" @click="refresh()">
          Réessayer
        </button>
      </div>

      <div v-else-if="!products?.length" class="text-text-muted">
        Aucun produit trouvé.
      </div>

      <section v-else class="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <ProductCard
          v-for="product in products"
          :key="product.id"
          :product="toFeaturedProduct(product)"
          :to="`/products/${product.id}`"
          :cta-label="product.stock > 0 ? 'Rent Now' : 'Out of Stock'"
        />
      </section>
    </div>
  </main>
</template>
