<script setup lang="ts">
const route = useRoute()
const productId = route.params.id as string
const cart = useCartStore()
const added = ref(false)
const quantity = ref(1)
const activeImageIndex = ref(0)

watch(() => product.value?.stock, (stock) => {
  if (stock !== undefined && stock < quantity.value) {
    quantity.value = Math.max(1, stock)
  }
})

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
const isLowStock = computed(() => product.value && product.value.stock > 0 && product.value.stock <= 5)

const stockLabel = computed(() => {
  if (!product.value) return ''
  if (isOutOfStock.value) return 'Rupture de stock'
  if (isLowStock.value) return `Plus que ${product.value.stock} en stock`
  return 'En stock'
})

const stockColor = computed(() => {
  if (isOutOfStock.value) return 'text-error bg-error/10'
  if (isLowStock.value) return 'text-warning bg-warning/10'
  return 'text-success bg-success/10'
})

const formattedPrice = computed(() => {
  if (!product.value) return ''
  return Number(product.value.price).toFixed(2)
})

const priceSuffix = computed(() => {
  if (!product.value) return ''
  return product.value.pricingType === 'tiered' ? '/jour' : '/location'
})

const categoryLabels: Record<string, string> = {
  cat_chargers: 'Chargeurs',
  cat_cables: 'Câbles',
  cat_laptops: 'Ordinateurs',
  cat_monitors: 'Écrans',
  cat_peripherals: 'Périphériques',
  cat_adapters: 'Adaptateurs',
}

const categoryLabel = computed(() => {
  if (!product.value) return ''
  return categoryLabels[product.value.categoryId] ?? product.value.categoryId
})

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
    quantity: quantity.value,
    stock: p.stock,
    warehouseIds: p.warehouseIds ?? [],
  })
  added.value = true
  setTimeout(() => { added.value = false }, 2000)
}
</script>

<template>
  <main class="min-h-screen bg-white">
    <!-- Breadcrumb -->
    <div class="bg-surface-purple border-b border-neutral-100">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4">
        <nav aria-label="Fil d'Ariane" class="flex items-center gap-2 text-body-sm">
          <NuxtLink to="/" class="text-text-muted hover:text-primary-600 transition-colors">
            Accueil
          </NuxtLink>
          <Icon name="lucide:chevron-right" class="size-3.5 text-neutral-300" />
          <NuxtLink to="/products" class="text-text-muted hover:text-primary-600 transition-colors">
            Catalogue
          </NuxtLink>
          <template v-if="product">
            <Icon name="lucide:chevron-right" class="size-3.5 text-neutral-300" />
            <span class="text-text-primary font-medium truncate max-w-50">{{ product.name }}</span>
          </template>
        </nav>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="status === 'pending'" class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
      <div class="flex flex-col items-center gap-4">
        <div class="size-10 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        <p class="text-text-muted">Chargement du produit...</p>
      </div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
      <EmptyState
        title="Produit introuvable"
        description="Ce produit n'existe pas ou a été retiré du catalogue."
      >
        <template #icon>
          <Icon name="lucide:package-x" class="size-10 text-primary-500" />
        </template>
        <template #actions>
          <Button as-child variant="default" size="lg">
            <NuxtLink to="/products">Retour au catalogue</NuxtLink>
          </Button>
        </template>
      </EmptyState>
    </div>

    <!-- Product content -->
    <div v-else-if="product">
      <!-- Hero section -->
      <section class="bg-linear-to-b from-surface-purple to-white">
        <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 lg:py-14">
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16">
            <!-- Image gallery -->
            <div class="space-y-4">
              <div class="relative aspect-square rounded-3xl bg-white border border-neutral-100 shadow-sm flex items-center justify-center overflow-hidden group">
                <img
                  v-if="product.image"
                  :src="product.image"
                  :alt="product.name"
                  class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  @error="($event.target as HTMLImageElement).style.display = 'none'"
                >
                <div v-else class="flex flex-col items-center gap-3 text-neutral-300">
                  <Icon name="lucide:package" class="size-24" />
                  <span class="text-body-sm text-neutral-400">Pas d'image disponible</span>
                </div>

                <!-- Stock badge overlay -->
                <div class="absolute top-4 left-4">
                  <span
                    class="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-caption font-semibold backdrop-blur-sm"
                    :class="stockColor"
                  >
                    <span class="size-1.5 rounded-full" :class="isOutOfStock ? 'bg-error' : isLowStock ? 'bg-warning' : 'bg-success'" />
                    {{ stockLabel }}
                  </span>
                </div>

                <!-- Pricing type badge -->
                <div v-if="product.pricingType === 'tiered'" class="absolute top-4 right-4">
                  <span class="inline-flex items-center gap-1 rounded-full bg-accent-100 px-3 py-1.5 text-caption font-semibold text-accent-700">
                    <Icon name="lucide:clock" class="size-3" />
                    Location flexible
                  </span>
                </div>
              </div>

              <!-- Thumbnail strip (visual filler for fullness) -->
              <div class="hidden sm:grid grid-cols-4 gap-3">
                <button
                  v-for="i in 4"
                  :key="i"
                  class="aspect-square rounded-xl border-2 overflow-hidden transition-all"
                  :class="activeImageIndex === i - 1 ? 'border-primary-500 shadow-md shadow-primary-100' : 'border-neutral-100 hover:border-neutral-300'"
                  @click="activeImageIndex = i - 1"
                >
                  <img
                    v-if="product.image"
                    :src="product.image"
                    :alt="`${product.name} - vue ${i}`"
                    class="w-full h-full object-cover"
                    @error="($event.target as HTMLImageElement).style.display = 'none'"
                  >
                  <div v-else class="w-full h-full bg-neutral-50 flex items-center justify-center">
                    <Icon name="lucide:image" class="size-5 text-neutral-300" />
                  </div>
                </button>
              </div>
            </div>

            <!-- Product info -->
            <div class="flex flex-col lg:py-2">
              <!-- Category & rating row -->
              <div class="flex items-center gap-3 mb-4">
                <span class="text-caption font-medium text-primary-600 bg-primary-50 rounded-full px-3 py-1">
                  {{ categoryLabel }}
                </span>
                <div v-if="product.rating" class="flex items-center gap-1.5 text-body-sm">
                  <div class="flex items-center gap-0.5">
                    <Icon
                      v-for="star in 5"
                      :key="star"
                      :name="star <= Math.round(product.rating) ? 'lucide:star' : 'lucide:star'"
                      class="size-4"
                      :class="star <= Math.round(product.rating) ? 'text-warning fill-warning' : 'text-neutral-200'"
                    />
                  </div>
                  <span class="text-text-secondary font-medium">{{ product.rating }}</span>
                  <span class="text-text-muted">({{ product.reviewCount ?? 0 }} avis)</span>
                </div>
              </div>

              <!-- Title -->
              <h1 class="text-h1 font-bold text-text-primary leading-tight">
                {{ product.name }}
              </h1>

              <!-- Price block -->
              <div class="mt-5 flex items-baseline gap-2">
                <span class="text-h1 font-bold text-text-primary leading-none">{{ formattedPrice }} €</span>
                <span class="text-body-lg text-text-muted">{{ priceSuffix }}</span>
              </div>

              <!-- Description -->
              <p class="mt-5 text-body-lg text-text-secondary leading-relaxed">
                {{ product.description }}
              </p>

              <!-- Compatibility tags -->
              <div v-if="product.compatibilityTags?.length" class="mt-6">
                <p class="text-body-sm font-medium text-text-secondary mb-2">Compatible avec</p>
                <div class="flex flex-wrap gap-2">
                  <span
                    v-for="tag in product.compatibilityTags"
                    :key="tag"
                    class="inline-flex items-center gap-1.5 rounded-lg bg-surface-lilac px-3 py-1.5 text-body-sm font-medium text-primary-700"
                  >
                    <Icon name="lucide:check-circle-2" class="size-3.5 text-primary-500" />
                    {{ tag }}
                  </span>
                </div>
              </div>

              <Separator class="my-6" />

              <!-- Add to cart section -->
              <div class="space-y-4">
                <!-- Quantity selector -->
                <div class="flex items-center gap-4">
                  <label class="text-body-sm font-medium text-text-secondary">Quantité</label>
                  <QuantityStepper
                    v-model="quantity"
                    :min="1"
                    :max="product.stock"
                    :disabled="isOutOfStock"
                  />
                  <span v-if="!isOutOfStock" class="text-body-sm text-text-muted">
                    {{ product.stock }} disponible{{ product.stock > 1 ? 's' : '' }}
                  </span>
                </div>

                <!-- CTA buttons -->
                <div class="flex flex-col sm:flex-row gap-3">
                  <Button
                    v-if="!isOutOfStock"
                    size="lg"
                    :variant="added ? 'default' : 'gradient'"
                    class="flex-1 rounded-full h-14 text-base"
                    :class="added ? 'bg-success hover:bg-success' : ''"
                    @click="addToCart"
                  >
                    <Icon v-if="added" name="lucide:check" class="size-5" />
                    <Icon v-else name="lucide:shopping-cart" class="size-5" />
                    {{ added ? 'Ajouté au panier !' : 'Ajouter au panier' }}
                  </Button>
                  <Button
                    v-else
                    size="lg"
                    variant="secondary"
                    class="flex-1 rounded-full h-14 text-base cursor-not-allowed"
                    disabled
                  >
                    <Icon name="lucide:package-x" class="size-5" />
                    Indisponible
                  </Button>

                  <Button
                    v-if="!isOutOfStock"
                    as-child
                    size="lg"
                    variant="glass"
                    class="rounded-full h-14 text-base px-8"
                  >
                    <NuxtLink to="/cart">
                      <Icon name="lucide:arrow-right" class="size-5" />
                      Voir le panier
                    </NuxtLink>
                  </Button>
                </div>
              </div>

              <!-- Trust signals -->
              <div class="mt-8 grid grid-cols-2 gap-3">
                <div class="flex items-center gap-3 rounded-xl bg-surface-purple p-3.5">
                  <div class="flex items-center justify-center size-10 rounded-lg bg-primary-100">
                    <Icon name="lucide:truck" class="size-5 text-primary-600" />
                  </div>
                  <div>
                    <p class="text-body-sm font-semibold text-text-primary">Livraison rapide</p>
                    <p class="text-caption text-text-muted">Sous 24-48h</p>
                  </div>
                </div>
                <div class="flex items-center gap-3 rounded-xl bg-surface-lavender p-3.5">
                  <div class="flex items-center justify-center size-10 rounded-lg bg-accent-100">
                    <Icon name="lucide:shield-check" class="size-5 text-accent-600" />
                  </div>
                  <div>
                    <p class="text-body-sm font-semibold text-text-primary">Garantie incluse</p>
                    <p class="text-caption text-text-muted">Protection complète</p>
                  </div>
                </div>
                <div class="flex items-center gap-3 rounded-xl bg-surface-violet p-3.5">
                  <div class="flex items-center justify-center size-10 rounded-lg bg-accent-200">
                    <Icon name="lucide:rotate-ccw" class="size-5 text-accent-700" />
                  </div>
                  <div>
                    <p class="text-body-sm font-semibold text-text-primary">Retour gratuit</p>
                    <p class="text-caption text-text-muted">Sous 14 jours</p>
                  </div>
                </div>
                <div class="flex items-center gap-3 rounded-xl bg-surface-lilac p-3.5">
                  <div class="flex items-center justify-center size-10 rounded-lg bg-primary-200">
                    <Icon name="lucide:headphones" class="size-5 text-primary-700" />
                  </div>
                  <div>
                    <p class="text-body-sm font-semibold text-text-primary">Support 7j/7</p>
                    <p class="text-caption text-text-muted">Assistance dédiée</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Details tabs section -->
      <section class="bg-neutral-50 border-t border-neutral-100">
        <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 lg:py-16">
          <Tabs default-value="description" class="w-full">
            <TabsList class="w-full sm:w-auto rounded-xl bg-surface-lilac p-1 h-auto">
              <TabsTrigger value="description" class="rounded-lg px-5 py-2.5 text-body-sm data-[state=active]:bg-white data-[state=active]:text-primary-700 data-[state=active]:shadow-sm">
                <Icon name="lucide:file-text" class="mr-1.5 size-4" />
                Description
              </TabsTrigger>
              <TabsTrigger value="specs" class="rounded-lg px-5 py-2.5 text-body-sm data-[state=active]:bg-white data-[state=active]:text-primary-700 data-[state=active]:shadow-sm">
                <Icon name="lucide:settings-2" class="mr-1.5 size-4" />
                Spécifications
              </TabsTrigger>
              <TabsTrigger value="delivery" class="rounded-lg px-5 py-2.5 text-body-sm data-[state=active]:bg-white data-[state=active]:text-primary-700 data-[state=active]:shadow-sm">
                <Icon name="lucide:truck" class="mr-1.5 size-4" />
                Livraison
              </TabsTrigger>
            </TabsList>

            <TabsContent value="description" class="mt-6">
              <Card class="overflow-hidden">
                <CardContent class="p-6 lg:p-8">
                  <div class="prose prose-neutral max-w-none">
                    <p class="text-body-lg text-text-secondary leading-relaxed">
                      {{ product.description }}
                    </p>
                    <div class="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-6">
                      <div class="text-center p-6 rounded-2xl bg-surface-purple">
                        <Icon name="lucide:zap" class="size-8 text-primary-500 mx-auto mb-3" />
                        <p class="text-body-sm font-semibold text-text-primary">Haute performance</p>
                        <p class="text-caption text-text-muted mt-1">Conçu pour les professionnels et passionnés de tech</p>
                      </div>
                      <div class="text-center p-6 rounded-2xl bg-surface-violet">
                        <Icon name="lucide:box" class="size-8 text-accent-500 mx-auto mb-3" />
                        <p class="text-body-sm font-semibold text-text-primary">Qualité premium</p>
                        <p class="text-caption text-text-muted mt-1">Produits vérifiés et entretenus avant chaque location</p>
                      </div>
                      <div class="text-center p-6 rounded-2xl bg-surface-lavender">
                        <Icon name="lucide:refresh-cw" class="size-8 text-primary-600 mx-auto mb-3" />
                        <p class="text-body-sm font-semibold text-text-primary">Location flexible</p>
                        <p class="text-caption text-text-muted mt-1">Louez à l'heure, la journée ou la semaine selon vos besoins</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="specs" class="mt-6">
              <Card class="overflow-hidden">
                <CardContent class="p-6 lg:p-8">
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div class="flex items-center justify-between p-4 rounded-xl bg-neutral-50 border border-neutral-100">
                      <span class="text-body-sm text-text-muted">Catégorie</span>
                      <span class="text-body-sm font-medium text-text-primary">{{ categoryLabel }}</span>
                    </div>
                    <div class="flex items-center justify-between p-4 rounded-xl bg-neutral-50 border border-neutral-100">
                      <span class="text-body-sm text-text-muted">Type de tarif</span>
                      <span class="text-body-sm font-medium text-text-primary">{{ product.pricingType === 'tiered' ? 'Tarif flexible' : 'Prix fixe' }}</span>
                    </div>
                    <div class="flex items-center justify-between p-4 rounded-xl bg-neutral-50 border border-neutral-100">
                      <span class="text-body-sm text-text-muted">Disponibilité</span>
                      <span class="text-body-sm font-medium" :class="isOutOfStock ? 'text-error' : 'text-success'">
                        {{ isOutOfStock ? 'Indisponible' : `${product.stock} en stock` }}
                      </span>
                    </div>
                    <div class="flex items-center justify-between p-4 rounded-xl bg-neutral-50 border border-neutral-100">
                      <span class="text-body-sm text-text-muted">Note moyenne</span>
                      <span class="text-body-sm font-medium text-text-primary">{{ product.rating ? `${product.rating}/5` : 'Pas encore noté' }}</span>
                    </div>
                    <div v-if="product.compatibilityTags?.length" class="sm:col-span-2 flex items-center justify-between p-4 rounded-xl bg-neutral-50 border border-neutral-100">
                      <span class="text-body-sm text-text-muted">Compatibilité</span>
                      <span class="text-body-sm font-medium text-text-primary">{{ product.compatibilityTags.join(', ') }}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="delivery" class="mt-6">
              <Card class="overflow-hidden">
                <CardContent class="p-6 lg:p-8">
                  <div class="space-y-6">
                    <div class="flex gap-4 p-4 rounded-xl bg-surface-purple">
                      <div class="flex items-center justify-center size-12 rounded-xl bg-primary-100 shrink-0">
                        <Icon name="lucide:package-check" class="size-6 text-primary-600" />
                      </div>
                      <div>
                        <p class="text-body font-semibold text-text-primary">Préparation de commande</p>
                        <p class="text-body-sm text-text-muted mt-1">Votre commande est préparée et vérifiée sous 24h après validation du paiement.</p>
                      </div>
                    </div>
                    <div class="flex gap-4 p-4 rounded-xl bg-surface-violet">
                      <div class="flex items-center justify-center size-12 rounded-xl bg-accent-100 shrink-0">
                        <Icon name="lucide:truck" class="size-6 text-accent-600" />
                      </div>
                      <div>
                        <p class="text-body font-semibold text-text-primary">Livraison à domicile</p>
                        <p class="text-body-sm text-text-muted mt-1">Livraison gratuite en zone desservie. Suivi en temps réel depuis votre espace client.</p>
                      </div>
                    </div>
                    <div class="flex gap-4 p-4 rounded-xl bg-surface-lavender">
                      <div class="flex items-center justify-center size-12 rounded-xl bg-primary-100 shrink-0">
                        <Icon name="lucide:rotate-ccw" class="size-6 text-primary-600" />
                      </div>
                      <div>
                        <p class="text-body font-semibold text-text-primary">Retour simplifié</p>
                        <p class="text-body-sm text-text-muted mt-1">Retour gratuit sous 14 jours. Nous organisons la collecte directement chez vous.</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </section>

      <!-- CTA banner -->
      <section class="bg-section-dark">
        <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
          <div class="flex flex-col lg:flex-row items-center justify-between gap-8">
            <div class="text-center lg:text-left">
              <h2 class="text-h2 font-bold text-white">
                Besoin d'aide pour choisir ?
              </h2>
              <p class="mt-3 text-body-lg text-neutral-400 max-w-lg">
                Notre équipe est disponible 7j/7 pour vous conseiller et trouver l'équipement idéal pour vos besoins.
              </p>
            </div>
            <div class="flex items-center gap-3">
              <Button as-child variant="gradient" size="pill" class="h-14 px-8 text-base">
                <NuxtLink to="/products">
                  <Icon name="lucide:search" class="size-5" />
                  Explorer le catalogue
                </NuxtLink>
              </Button>
              <Button variant="glass" size="pill" class="h-14 px-8 text-base">
                <Icon name="lucide:message-circle" class="size-5" />
                Nous contacter
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  </main>
</template>
