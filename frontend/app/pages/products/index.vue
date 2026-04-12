<script setup lang="ts">
useHead({
  title: "Catalogue - EzTech",
});

type Product = {
  id: string;
  name: string;
  description: string;
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
        <article
          v-for="product in products"
          :key="product.id"
          class="relative rounded-xl border border-border bg-card p-4 shadow-sm transition-shadow duration-200"
          :class="product.stock > 0 ? 'cursor-pointer hover:shadow-md' : 'opacity-75'"
          @click="product.stock > 0 && $router.push(`/products/${product.id}`)"
        >
          <span
            v-if="product.stock === 0"
            class="absolute top-3 right-3 inline-flex items-center rounded-full bg-error/10 px-2.5 py-1 text-xs font-semibold text-error"
          >
            Rupture de stock
          </span>
          <span
            v-else-if="product.stock <= 3"
            class="absolute top-3 right-3 inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700"
          >
            Plus que {{ product.stock }} en stock
          </span>

          <h2 class="text-lg font-semibold text-text-primary pr-28">
            {{ product.name }}
          </h2>
          <p class="mt-2 line-clamp-3 text-sm text-text-muted">
            {{ product.description }}
          </p>
          <div class="mt-4 flex items-center justify-between">
            <p class="text-base font-bold text-text-primary">
              {{ Number(product.price).toFixed(2) }} €
            </p>
            <p v-if="product.rating" class="text-sm text-text-muted">
              ⭐ {{ product.rating }}
            </p>
          </div>
        </article>
      </section>
    </div>
  </main>
</template>
