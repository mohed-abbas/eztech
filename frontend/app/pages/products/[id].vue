<script setup lang="ts">
const route = useRoute()
const productId = route.params.id as string
const cart = useCartStore()
const added = ref(false)

type Product = {
  id: string
  slug?: string
  name: string
  description: string
  categoryId: string
  image: string
  price: number
  pricingType?: string
  rating?: number
  reviewCount?: number
  stock: number
  compatibilityTags?: string[]
  warehouseIds?: string[]
}

const { data: product, status, error } = await useFetch<Product>(`/api/products/${productId}`)

useHead({
  title: computed(() => product.value ? `${product.value.name} - EzTech` : 'Produit - EzTech'),
})

const isOutOfStock = computed(() => product.value?.stock === 0)

function addToCart() {
  if (!product.value || isOutOfStock.value) return
  const p = product.value
  cart.addItem({
    productId: p.id,
    name: p.name,
    image: p.image,
    pricingType: (p.pricingType as 'flat' | 'tiered') ?? 'flat',
    price: p.pricingType === 'tiered'
      ? { hourly: p.price, daily: p.price, weekly: p.price }
      : { flat: p.price },
    stock: p.stock,
    warehouseIds: p.warehouseIds ?? [],
  })
  added.value = true
  setTimeout(() => { added.value = false }, 2000)
}
</script>

<template>
  <main class="min-h-screen px-4 py-10 sm:px-6 md:px-10">
    <div class="mx-auto max-w-4xl">
      <NuxtLink
        to="/products"
        class="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors mb-6"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
        Retour au catalogue
      </NuxtLink>

      <div v-if="status === 'pending'" class="text-text-muted py-20 text-center">
        Chargement...
      </div>

      <div
        v-else-if="error"
        class="rounded-xl border border-red-300 bg-red-50 p-6 text-red-700 text-center"
      >
        Produit introuvable.
        <NuxtLink to="/products" class="ml-2 underline">
          Retour au catalogue
        </NuxtLink>
      </div>

      <div v-else-if="product" class="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div class="aspect-square rounded-2xl bg-neutral-100 flex items-center justify-center overflow-hidden">
          <img
            v-if="product.image"
            :src="product.image"
            :alt="product.name"
            class="w-full h-full object-cover"
            @error="($event.target as HTMLImageElement).style.display = 'none'"
          >
          <svg v-else class="w-20 h-20 text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
          </svg>
        </div>

        <div class="flex flex-col">
          <div class="flex items-start gap-3 flex-wrap">
            <h1 class="text-2xl font-bold text-text-primary sm:text-3xl">
              {{ product.name }}
            </h1>
            <span
              v-if="isOutOfStock"
              class="inline-flex items-center rounded-full bg-error/10 px-3 py-1 text-sm font-semibold text-error mt-1"
            >
              Rupture de stock
            </span>
          </div>

          <p class="mt-4 text-text-muted leading-relaxed">
            {{ product.description }}
          </p>

          <div v-if="product.compatibilityTags?.length" class="mt-4 flex flex-wrap gap-2">
            <span
              v-for="tag in product.compatibilityTags"
              :key="tag"
              class="rounded-full bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700"
            >
              {{ tag }}
            </span>
          </div>

          <div class="mt-6 flex items-end gap-2">
            <span class="text-3xl font-bold text-text-primary">{{ Number(product.price).toFixed(2) }} €</span>
            <span v-if="product.pricingType === 'tiered'" class="text-text-muted mb-1">/jour</span>
            <span v-else class="text-text-muted mb-1">/location</span>
          </div>

          <div class="mt-2 flex items-center gap-3 text-sm text-text-muted">
            <span v-if="product.rating">⭐ {{ product.rating }} ({{ product.reviewCount }} avis)</span>
            <span v-if="!isOutOfStock" class="text-success font-medium">{{ product.stock }} en stock</span>
          </div>

          <div class="mt-8">
            <button
              v-if="!isOutOfStock"
              class="w-full sm:w-auto rounded-xl px-8 py-3.5 font-semibold text-white transition-all flex items-center justify-center gap-2"
              :class="added ? 'bg-success' : 'bg-primary-600 hover:bg-primary-700 active:scale-[.99]'"
              @click="addToCart"
            >
              <svg v-if="added" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
              </svg>
              <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              {{ added ? 'Ajouté au panier !' : 'Ajouter au panier' }}
            </button>
            <div
              v-else
              class="w-full sm:w-auto rounded-xl px-8 py-3.5 font-semibold text-center bg-neutral-100 text-text-muted cursor-not-allowed"
            >
              Indisponible
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>
