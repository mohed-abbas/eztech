<script setup lang="ts">
type Product = {
  id: string
  name: string
  description: string
  image?: string
  price: number
  rating?: number
}

const {
  data: products,
  status,
  error,
  refresh,
} = await useFetch<Product[]>('/api/products', {
  default: () => [],
})
</script>

<template>
  <main class="min-h-screen px-6 py-10 md:px-10">
    <div class="mx-auto max-w-6xl">
      <header class="mb-8">
        <h1 class="text-3xl font-bold text-text-primary md:text-4xl">High-tech Products</h1>
        <p class="mt-2 text-text-muted">Available products from your catalog.</p>
      </header>

      <div v-if="status === 'pending'" class="text-text-muted">Loading products...</div>

      <div v-else-if="error" class="rounded-lg border border-red-300 bg-red-50 p-4 text-red-700">
        Failed to load products.
        <button class="ml-2 underline" type="button" @click="refresh()">Try again</button>
      </div>

      <div v-else-if="!products?.length" class="text-text-muted">No products found.</div>

      <section v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <article
          v-for="product in products"
          :key="product.id"
          class="rounded-xl border border-border bg-card p-4 shadow-sm"
        >
          <h2 class="text-lg font-semibold text-text-primary">{{ product.name }}</h2>
          <p class="mt-2 line-clamp-3 text-sm text-text-muted">{{ product.description }}</p>
          <div class="mt-4 flex items-center justify-between">
            <p class="text-base font-bold text-text-primary">${{ Number(product.price).toFixed(2) }}</p>
            <p v-if="product.rating" class="text-sm text-text-muted">⭐ {{ product.rating }}</p>
          </div>
        </article>
      </section>
    </div>
  </main>
</template>
