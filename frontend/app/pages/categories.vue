<script setup lang="ts">
// Page publique : liste LIVE des catégories depuis Express (GET /api/categories).
// /api/categories n'est PAS interceptée par le BFF Nuxt en production (vérifié : elle renvoie
// l'enveloppe Express {categories:[...]}), donc on appelle config.public.apiUrl directement.
import mockCategories from '~/data/mock/categories.json'

definePageMeta({ layout: 'default' })

useHead({ title: 'Catégories - EzTech' })

interface ApiCategory {
  id: string
  name: string
  slug: string
  description: string
  icon: string
  _count?: { products: number }
}

const config = useRuntimeConfig()
const { isMock } = useMock()

// Le rendu serveur passe par le réseau interne (config.apiUrl, ex. http://backend:3001/api),
// jamais par l'URL publique ; le client utilise config.public.apiUrl. Même idiome que
// stores/auth.ts:167-172.
const endpoint = computed(() => {
  const base = import.meta.server
    ? ((config.apiUrl as string) || (config.public.apiUrl as string))
    : (config.public.apiUrl as string)
  return `${base}/categories`
})

const { data, status, error, refresh } = await useFetch<{ categories: ApiCategory[] }>(
  endpoint,
  {
    key: 'categories-list',
    // Repli mock explicitement gaté : l'application doit tourner sans backend en mode démo.
    immediate: !isMock.value,
    default: () => (isMock.value ? { categories: mockCategories as ApiCategory[] } : { categories: [] }),
  },
)

const categories = computed<ApiCategory[]>(() => data.value?.categories ?? [])

function productCount(c: ApiCategory): number | null {
  return typeof c._count?.products === 'number' ? c._count.products : null
}

function countLabel(n: number): string {
  return n <= 1 ? `${n} produit` : `${n} produits`
}
</script>

<template>
  <div class="min-h-screen bg-background">
    <!-- Hero Header -->
    <div class="relative overflow-hidden bg-section-dark px-6 py-12 sm:px-10 sm:py-16">
      <div class="pointer-events-none absolute -right-20 -top-20 size-80 rounded-full bg-primary-500/15 blur-3xl" />
      <div class="pointer-events-none absolute -bottom-10 -left-10 size-64 rounded-full bg-primary-400/10 blur-2xl" />

      <div class="relative mx-auto max-w-7xl">
        <NuxtLink
          to="/products"
          class="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-body-sm font-medium text-neutral-300 backdrop-blur-sm transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400/50"
        >
          <Icon name="ph:arrow-left" class="size-4" />
          Retour au catalogue
        </NuxtLink>

        <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 class="text-h1 font-semibold text-white">Catégories</h1>
            <p class="mt-2 text-body text-neutral-400">
              Parcourez notre matériel par famille de produits
            </p>
          </div>

          <div v-if="categories.length" class="hidden items-center gap-3 sm:flex">
            <div class="flex size-11 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm">
              <Icon name="ph:squares-four" class="size-5 text-primary-300" />
            </div>
            <div>
              <p class="text-caption font-medium text-neutral-500 leading-tight">Catégories</p>
              <p class="text-body-lg font-semibold text-white leading-tight">{{ categories.length }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="mx-auto max-w-7xl px-6 py-10 sm:px-10">
      <!-- Loading -->
      <div v-if="status === 'pending'" class="space-y-6">
        <div class="flex items-center gap-3">
          <div class="size-5 animate-spin rounded-full border-2 border-primary-200 border-t-primary-500" />
          <p class="text-body text-text-muted">Chargement des catégories…</p>
        </div>
        <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <div v-for="n in 6" :key="n" class="animate-pulse rounded-2xl border border-neutral-200 bg-white p-6">
            <div class="mb-4 size-12 rounded-xl bg-neutral-100" />
            <div class="mb-3 h-5 w-1/2 rounded bg-neutral-100" />
            <div class="h-3 w-3/4 rounded bg-neutral-100" />
          </div>
        </div>
      </div>

      <!-- Error -->
      <div v-else-if="error">
        <EmptyState
          title="Impossible de charger les catégories"
          description="Une erreur est survenue lors du chargement. Veuillez réessayer."
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

      <!-- Empty -->
      <div v-else-if="!categories.length">
        <EmptyState
          title="Aucune catégorie disponible"
          description="Notre catalogue est en cours de préparation. Revenez bientôt !"
        >
          <template #icon>
            <Icon name="ph:squares-four" class="size-10 text-primary-500" />
          </template>
          <template #actions>
            <NuxtLink to="/products">
              <Button variant="gradient" size="pill" class="font-semibold">
                Voir tous les produits
              </Button>
            </NuxtLink>
          </template>
        </EmptyState>
      </div>

      <!-- Grid -->
      <div v-else class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <NuxtLink
          v-for="category in categories"
          :key="category.id"
          :to="`/products?category=${encodeURIComponent(category.slug)}`"
          class="group rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400/40"
        >
          <Card class="h-full p-6 transition-all group-hover:-translate-y-0.5 group-hover:border-primary-200 group-hover:shadow-md">
            <div class="flex items-start justify-between gap-4">
              <div class="flex size-12 items-center justify-center rounded-xl bg-surface-purple transition-colors group-hover:bg-primary-100">
                <Icon
                  :name="category.icon || 'ph:squares-four'"
                  class="size-6 text-primary-600"
                />
              </div>
              <span
                v-if="productCount(category) !== null"
                class="rounded-full bg-neutral-100 px-3 py-1 text-caption font-medium text-text-muted"
              >
                {{ countLabel(productCount(category)!) }}
              </span>
            </div>

            <h2 class="mt-4 text-h4 font-semibold text-text-primary">
              {{ category.name }}
            </h2>
            <p v-if="category.description" class="mt-1.5 text-body-sm text-text-muted">
              {{ category.description }}
            </p>

            <div class="mt-5 flex items-center gap-1.5 text-body-sm font-medium text-primary-600">
              Explorer
              <Icon
                name="ph:arrow-right"
                class="size-4 transition-transform group-hover:translate-x-0.5"
              />
            </div>
          </Card>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
