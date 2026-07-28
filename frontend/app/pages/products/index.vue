<script setup lang="ts">
import type { FeaturedProduct } from '~/composables/useLandingContent'

useHead({ title: 'Catalogue - EzTech' })
useSeoMeta({
  description: 'Louez du matériel tech haut de gamme : ordinateurs, écrans, périphériques. Livraison express en 30 minutes.',
  ogTitle: 'Catalogue - EzTech',
  ogDescription: 'Louez du matériel tech haut de gamme, livré chez vous.',
})

type TierPrices = { flat?: number, hourly?: number, daily?: number, weekly?: number }

type Product = {
  id: string
  name: string
  description: string
  categoryId: string
  categorySlug?: string
  categoryName?: string
  categoryIcon?: string
  image?: string
  /** Prix d'appel. Le prix reellement facture par palier est dans `prices`. */
  price: number
  prices?: TierPrices
  pricingType?: 'flat' | 'tiered'
  rating?: number
  stock: number
}

type Category = {
  id: string
  name: string
  slug: string
  description?: string
  icon?: string
}

const config = useRuntimeConfig()
const route = useRoute()
const router = useRouter()

const {
  data: products,
  status,
  error,
  refresh,
} = await useFetch<Product[]>('/api/products', {
  default: () => [],
})

// Real categories, straight from Express (/api/categories is NOT intercepted by the Nuxt BFF
// in production — it answers the Express envelope {categories:[...]}). SSR goes through the
// internal network (config.apiUrl), the browser through the public origin — same idiom as
// stores/auth.ts:167-172 and pages/categories.vue. No mock fallback: if the call fails the
// chips degrade to the categories carried by the live products, never to static JSON.
const categoriesEndpoint = computed(() => {
  const base = import.meta.server
    ? ((config.apiUrl as string) || (config.public.apiUrl as string))
    : (config.public.apiUrl as string)
  return `${base}/categories`
})

const {
  data: categoriesPayload,
  status: categoriesStatus,
  error: categoriesError,
} = await useFetch<{ categories: Category[] }>(categoriesEndpoint, {
  key: 'catalog-categories',
  default: () => ({ categories: [] }),
})

const apiCategories = computed<Category[]>(() => categoriesPayload.value?.categories ?? [])

const search = ref('')
// Slug-keyed, so /products?category=<slug> deep links work (contract with /categories).
const activeCategory = ref<string | null>(
  typeof route.query.category === 'string' && route.query.category ? route.query.category : null,
)

// Categories derived from the products currently in the catalog — the SSR-safe baseline.
const categoriesFromProducts = computed<Category[]>(() => {
  const seen = new Map<string, Category>()
  for (const p of products.value ?? []) {
    const slug = p.categorySlug
    if (!slug || seen.has(slug)) continue
    seen.set(slug, { id: slug, slug, name: p.categoryName ?? slug, icon: p.categoryIcon ?? 'ph:package' })
  }
  return [...seen.values()]
})

// The API list wins once loaded (it also contains categories with no product yet, which is
// how a freshly created category shows up here), merged with the product-derived baseline.
const availableCategories = computed<Category[]>(() => {
  const merged = new Map<string, Category>()
  for (const c of categoriesFromProducts.value) merged.set(c.slug, c)
  for (const c of apiCategories.value ?? []) merged.set(c.slug, { ...c, icon: c.icon ?? 'ph:package' })
  return [...merged.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'))
})

const categoryMap = computed(() => new Map(availableCategories.value.map(c => [c.slug, c])))

const categoriesPending = computed(() => categoriesStatus.value === 'pending')

const filteredProducts = computed(() => {
  let list = products.value ?? []
  if (activeCategory.value) {
    list = list.filter(p => p.categorySlug === activeCategory.value)
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

function selectCategory(slug: string | null) {
  activeCategory.value = activeCategory.value === slug ? null : slug
}

// Keep the URL in sync so a filtered catalog is shareable and /products?category=<slug> round-trips.
watch(activeCategory, (slug) => {
  const query = { ...route.query }
  if (slug) query.category = slug
  else delete query.category
  router.replace({ query })
})

// …and follow the URL the other way, so browser back/forward and an in-app link to
// /products?category=<slug> both re-apply the filter.
watch(() => route.query.category, (q) => {
  const slug = typeof q === 'string' && q ? q : null
  if (slug !== activeCategory.value) activeCategory.value = slug
})

function getCategoryName(p: Product): string {
  return p.categoryName ?? categoryMap.value.get(p.categorySlug ?? '')?.name ?? 'Tech'
}

function getCategoryIcon(p: Product): string {
  return p.categoryIcon ?? categoryMap.value.get(p.categorySlug ?? '')?.icon ?? 'ph:package'
}

// ProductCard affiche le montant suivi d'un « /Jour » ecrit en dur, donc pour un produit a paliers
// on lui donne le tarif JOURNALIER et pas le prix d'appel — sinon la carte annonce un tarif horaire
// libelle « par jour ». Le vrai correctif (unite pilotee par le produit) est dans ProductCard.vue,
// qui ne fait pas partie des fichiers modifiables ici.
function cardPrice(p: Product): number {
  if (p.pricingType === 'tiered') return p.prices?.daily ?? p.price
  return p.prices?.flat ?? p.price
}

function toFeaturedProduct(p: Product): FeaturedProduct {
  return {
    name: p.name,
    type: getCategoryName(p),
    price: `€${Number(cardPrice(p)).toFixed(2)}`,
    heroIcon: getCategoryIcon(p),
    imageUrl: p.image ?? null,
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
              class="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-neutral-400 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
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
        <div
          role="status"
          aria-busy="true"
          aria-label="Chargement des produits"
          class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          <ProductCardSkeleton v-for="n in 8" :key="n" />
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
                'inline-flex items-center gap-2 rounded-full px-4 py-2 text-body-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400/50 focus-visible:ring-offset-2',
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
              :key="cat.slug"
              type="button"
              :aria-pressed="activeCategory === cat.slug"
              :class="[
                'inline-flex items-center gap-2 rounded-full px-4 py-2 text-body-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400/50 focus-visible:ring-offset-2',
                activeCategory === cat.slug
                  ? 'bg-primary-500 text-white shadow-sm'
                  : 'bg-surface-purple border border-primary-100 text-text-secondary hover:border-primary-300 hover:text-primary-600',
              ]"
              @click="selectCategory(cat.slug)"
            >
              <Icon :name="cat.icon ?? 'ph:package'" class="size-4" />
              {{ cat.name }}
            </button>

            <span v-if="categoriesPending" class="inline-flex items-center gap-2 text-body-sm text-text-muted">
              <span class="size-4 animate-spin rounded-full border-2 border-primary-200 border-t-primary-500" />
              Chargement des catégories…
            </span>
          </div>

          <p v-if="categoriesError" class="mt-2 text-caption text-text-muted">
            <Icon name="ph:warning-circle" class="mr-1 inline size-4 text-warning" />
            Liste complète des catégories indisponible — seules celles présentes dans le catalogue sont affichées.
          </p>
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
