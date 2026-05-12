<script setup lang="ts">
import type { FeaturedProduct } from '~/composables/useLandingContent'
import categoriesData from '~/data/mock/categories.json'

useHead({ title: 'Catalogue - EzTech' })
useSeoMeta({
  description: 'Louez du matériel tech haut de gamme : ordinateurs, écrans, périphériques. Livraison express en 30 minutes.',
  ogTitle: 'Catalogue - EzTech',
  ogDescription: 'Louez du matériel tech haut de gamme, livré chez vous.',
})

type Product = {
  id: string
  name: string
  description: string
  categoryId: string
  image?: string
  price: number
  rating?: number
  stock: number
}

type Category = {
  id: string
  name: string
  slug: string
  description: string
  icon: string
}

const categories = categoriesData as Category[]
const categoryMap = new Map(categories.map(c => [c.id, c]))

const {
  data: products,
  status,
  error,
  refresh,
} = await useFetch<Product[]>('/api/products', {
  default: () => [],
})

const search = ref('')
const activeCategory = ref<string | null>(null)

const availableCategories = computed(() => {
  const usedIds = new Set((products.value ?? []).map(p => p.categoryId))
  return categories.filter(c => usedIds.has(c.id))
})

const filteredProducts = computed(() => {
  let list = products.value ?? []
  if (activeCategory.value) {
    list = list.filter(p => p.categoryId === activeCategory.value)
  }
  if (search.value.trim()) {
    const q = search.value.trim().toLowerCase()
    list = list.filter(p => p.name.toLowerCase().includes(q) || (p.description ?? '').toLowerCase().includes(q))
  }
  return list
})

const totalCount = computed(() => (products.value ?? []).length)
const hasActiveFilters = computed(() => !!activeCategory.value || !!search.value.trim())

function clearFilters() {
  search.value = ''
  activeCategory.value = null
}

function getCategoryName(categoryId: string): string {
  return categoryMap.get(categoryId)?.name ?? 'Tech'
}

function getCategoryIcon(categoryId: string): string {
  return categoryMap.get(categoryId)?.icon ?? 'ph:package'
}

function toFeaturedProduct(p: Product): FeaturedProduct {
  return {
    name: p.name,
    type: getCategoryName(p.categoryId),
    price: `€${Number(p.price).toFixed(2)}`,
    heroIcon: getCategoryIcon(p.categoryId),
    icon1: 'ph:star',
    spec1: p.rating ? `${p.rating}` : '—',
    icon2: 'ph:cube',
    spec2: `${p.stock} dispo`,
    icon3: 'ph:truck',
    spec3: 'Express',
  }
}
</script>

<template>
  <div class="min-h-screen bg-background">
    <!-- Hero Header -->
    <div class="relative overflow-hidden bg-section-dark px-6 py-12 sm:px-10 sm:py-16">
      <div class="pointer-events-none absolute -right-20 -top-20 size-80 rounded-full bg-primary-500/15 blur-3xl" />
      <div class="pointer-events-none absolute -bottom-10 -left-10 size-64 rounded-full bg-primary-400/10 blur-2xl" />
      <div class="pointer-events-none absolute left-1/2 top-0 size-96 -translate-x-1/2 rounded-full bg-accent-500/8 blur-3xl" />

      <div class="relative mx-auto max-w-7xl">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 class="text-h1 font-semibold text-white">Catalogue</h1>
            <p class="mt-2 text-body-lg text-neutral-400">
              Louez du matériel tech haut de gamme, livré chez vous.
            </p>
          </div>

          <!-- Mini Stats -->
          <div v-if="status !== 'pending' && !error" class="hidden items-center gap-5 sm:flex">
            <div class="flex items-center gap-3">
              <div class="flex size-11 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm">
                <Icon name="ph:package" class="size-5 text-primary-300" />
              </div>
              <div>
                <p class="text-caption font-medium text-neutral-500 leading-tight">Produits</p>
                <p class="text-body-lg font-semibold text-white leading-tight">{{ totalCount }}</p>
              </div>
            </div>

            <div class="h-8 w-px bg-white/10" />

            <div class="flex items-center gap-3">
              <div class="flex size-11 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm">
                <Icon name="ph:folders" class="size-5 text-primary-300" />
              </div>
              <div>
                <p class="text-caption font-medium text-neutral-500 leading-tight">Catégories</p>
                <p class="text-body-lg font-semibold text-white leading-tight">{{ availableCategories.length }}</p>
              </div>
            </div>

            <div class="h-8 w-px bg-white/10" />

            <div class="flex items-center gap-3">
              <div class="flex size-11 items-center justify-center rounded-xl bg-primary-500/25 border border-primary-400/20">
                <Icon name="ph:lightning" class="size-5 text-primary-300" />
              </div>
              <div>
                <p class="text-caption font-medium text-primary-400 leading-tight">Livraison</p>
                <p class="text-body-lg font-semibold text-white leading-tight">~30 min</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Search Bar -->
        <div v-if="status !== 'pending' && !error" class="mt-8">
          <div class="relative max-w-xl">
            <Icon name="ph:magnifying-glass" class="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-neutral-400" />
            <input
              v-model="search"
              type="text"
              aria-label="Rechercher un produit"
              placeholder="Rechercher un produit…"
              class="w-full rounded-full border border-white/15 bg-white/10 py-3 pl-12 pr-4 text-body text-white placeholder:text-neutral-500 backdrop-blur-sm outline-none transition focus:border-primary-400/50 focus:ring-2 focus:ring-primary-400/30"
            >
            <button
              v-if="search"
              type="button"
              aria-label="Effacer la recherche"
              class="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-neutral-400 transition-colors hover:bg-white/10 hover:text-white"
              @click="search = ''"
            >
              <Icon name="ph:x" class="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="mx-auto max-w-7xl px-6 py-10 sm:px-10">
      <!-- Loading State -->
      <div v-if="status === 'pending'" class="space-y-6">
        <div class="flex items-center gap-3">
          <div class="size-5 animate-spin rounded-full border-2 border-primary-200 border-t-primary-500" />
          <p class="text-body text-text-muted">Chargement des produits…</p>
        </div>
        <!-- Skeleton grid -->
        <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <div v-for="n in 8" :key="n" class="animate-pulse rounded-xl border border-neutral-200 bg-white p-4">
            <div class="mb-3 h-5 w-2/3 rounded bg-neutral-100" />
            <div class="mb-3 h-3 w-1/3 rounded bg-neutral-100" />
            <div class="mb-3 h-28 rounded-md bg-neutral-100" />
            <div class="flex gap-2">
              <div class="h-4 w-12 rounded bg-neutral-100" />
              <div class="h-4 w-12 rounded bg-neutral-100" />
              <div class="h-4 w-12 rounded bg-neutral-100" />
            </div>
            <hr class="my-3 border-neutral-100">
            <div class="flex items-center justify-between">
              <div class="h-7 w-20 rounded bg-neutral-100" />
              <div class="h-9 w-24 rounded-full bg-neutral-100" />
            </div>
          </div>
        </div>
      </div>

      <!-- Error State -->
      <div v-else-if="error">
        <EmptyState
          title="Impossible de charger les produits"
          description="Une erreur est survenue lors du chargement du catalogue. Veuillez réessayer."
        >
          <template #icon>
            <Icon name="ph:warning-circle" class="size-10 text-error" />
          </template>
          <template #actions>
            <Button variant="gradient" size="pill" class="font-semibold" @click="refresh()">
              <Icon name="ph:arrow-clockwise" class="size-4" />
              Réessayer
            </Button>
          </template>
        </EmptyState>
      </div>

      <!-- Empty State (no products at all) -->
      <div v-else-if="!products?.length">
        <EmptyState
          title="Aucun produit disponible"
          description="Notre catalogue est en cours de préparation. Revenez bientôt !"
        >
          <template #icon>
            <Icon name="ph:storefront" class="size-10 text-primary-500" />
          </template>
          <template #actions>
            <NuxtLink to="/">
              <Button variant="gradient" size="pill" class="font-semibold">
                <Icon name="ph:house" class="size-4" />
                Retour à l'accueil
              </Button>
            </NuxtLink>
          </template>
        </EmptyState>
      </div>

      <!-- Content -->
      <template v-else>
        <!-- Category Filters -->
        <div class="mb-8">
          <div class="mb-3 flex items-center justify-between">
            <h2 class="text-h4 font-semibold text-text-primary">Catégories</h2>
            <span class="text-body-sm text-text-muted">
              {{ filteredProducts.length }} résultat{{ filteredProducts.length !== 1 ? 's' : '' }}
              <template v-if="hasActiveFilters">
                sur {{ totalCount }}
              </template>
            </span>
          </div>

          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              :aria-pressed="!activeCategory"
              :class="[
                'inline-flex items-center gap-2 rounded-full px-4 py-2 text-body-sm font-medium transition-all',
                !activeCategory
                  ? 'bg-primary-500 text-white shadow-sm'
                  : 'bg-surface-purple border border-primary-100 text-text-secondary hover:border-primary-300 hover:text-primary-600',
              ]"
              @click="activeCategory = null"
            >
              <Icon name="ph:squares-four" class="size-4" />
              Tous
            </button>
            <button
              v-for="cat in availableCategories"
              :key="cat.id"
              type="button"
              :aria-pressed="activeCategory === cat.id"
              :class="[
                'inline-flex items-center gap-2 rounded-full px-4 py-2 text-body-sm font-medium transition-all',
                activeCategory === cat.id
                  ? 'bg-primary-500 text-white shadow-sm'
                  : 'bg-surface-purple border border-primary-100 text-text-secondary hover:border-primary-300 hover:text-primary-600',
              ]"
              @click="activeCategory = activeCategory === cat.id ? null : cat.id"
            >
              <Icon :name="cat.icon" class="size-4" />
              {{ cat.name }}
            </button>
          </div>
        </div>

        <Separator class="mb-8" />

        <!-- No results after filtering -->
        <div v-if="filteredProducts.length === 0" class="py-4">
          <EmptyState
            title="Aucun résultat"
            description="Aucun produit ne correspond à vos critères de recherche."
          >
            <template #icon>
              <Icon name="ph:magnifying-glass" class="size-10 text-primary-500" />
            </template>
            <template #actions>
              <Button variant="glass" size="pill-sm" class="font-semibold" @click="clearFilters">
                <Icon name="ph:x" class="size-4" />
                Effacer les filtres
              </Button>
            </template>
          </EmptyState>
        </div>

        <!-- Product Grid -->
        <section v-else class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <ProductCard
            v-for="product in filteredProducts"
            :key="product.id"
            :product="toFeaturedProduct(product)"
            :to="`/products/${product.id}`"
            :cta-label="product.stock > 0 ? 'Louer' : 'Indisponible'"
          />
        </section>

        <!-- Bottom Trust Bar -->
        <div class="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div class="flex items-center gap-3 rounded-xl rounded-tl-feature border border-primary-100 bg-surface-purple p-4">
            <div class="flex size-10 items-center justify-center rounded-full bg-primary-100">
              <Icon name="ph:shield-check" class="size-5 text-primary-600" />
            </div>
            <div>
              <p class="text-body-sm font-semibold text-text-primary">Matériel vérifié</p>
              <p class="text-caption text-text-muted">Testé avant chaque location</p>
            </div>
          </div>
          <div class="flex items-center gap-3 rounded-xl rounded-tr-feature border border-accent-100 bg-surface-violet p-4">
            <div class="flex size-10 items-center justify-center rounded-full bg-accent-100">
              <Icon name="ph:lightning" class="size-5 text-accent-600" />
            </div>
            <div>
              <p class="text-body-sm font-semibold text-text-primary">Livraison express</p>
              <p class="text-caption text-text-muted">En 30 min ou moins</p>
            </div>
          </div>
          <div class="flex items-center gap-3 rounded-xl rounded-bl-feature border border-primary-100 bg-surface-lavender p-4">
            <div class="flex size-10 items-center justify-center rounded-full bg-primary-100">
              <Icon name="ph:arrows-clockwise" class="size-5 text-primary-600" />
            </div>
            <div>
              <p class="text-body-sm font-semibold text-text-primary">Annulation gratuite</p>
              <p class="text-caption text-text-muted">Avant la livraison</p>
            </div>
          </div>
          <div class="flex items-center gap-3 rounded-xl rounded-br-feature border border-primary-100 bg-surface-lilac p-4">
            <div class="flex size-10 items-center justify-center rounded-full bg-primary-100">
              <Icon name="ph:headset" class="size-5 text-primary-600" />
            </div>
            <div>
              <p class="text-body-sm font-semibold text-text-primary">Support 7j/7</p>
              <p class="text-caption text-text-muted">Assistance dédiée</p>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
