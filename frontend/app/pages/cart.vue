<script setup lang="ts">
definePageMeta({ layout: 'default', middleware: 'auth' })

const cart = useCartStore()
cart.hydrate()
const { items, subtotal, deliveryFee, total, isEmpty } = storeToRefs(cart)
const { removeItem, updateQuantity, updateDuration, linePrice } = cart

const isDev = import.meta.dev

async function seedDemo() {
  const { addItem } = cart
  const products = (await import('~/data/mock/products.json')).default as Array<{
    id: string
    name: string
    image: string
    pricingType: 'flat' | 'tiered'
    price: { flat?: number, hourly?: number, daily?: number, weekly?: number }
    stock: number
    warehouseIds: string[]
  }>
  const picks = [products[0], products.find(p => p.pricingType === 'tiered'), products[5]]
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
  for (const p of picks) {
    addItem({
      productId: p.id,
      name: p.name,
      image: p.image,
      pricingType: p.pricingType,
      price: p.price,
      stock: p.stock,
      warehouseIds: p.warehouseIds,
    })
  }
}

async function goToCheckout() {
  await navigateTo('/checkout')
}
</script>

<template>
  <div class="min-h-screen bg-background">
    <!-- Cart Header -->
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
            <h1 class="text-h1 font-semibold text-white">Mon panier</h1>
            <p v-if="!isEmpty" class="mt-2 text-body text-neutral-400">
              {{ items.length }} article{{ items.length > 1 ? 's' : '' }} dans votre panier
            </p>
            <p v-else class="mt-2 text-body text-neutral-400">
              Votre panier est vide
            </p>
          </div>

          <!-- Mini Stats -->
          <div v-if="!isEmpty" class="hidden items-center gap-5 sm:flex">
            <div class="flex items-center gap-3">
              <div class="flex size-11 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm">
                <Icon name="ph:shopping-bag" class="size-5 text-primary-300" />
              </div>
              <div>
                <p class="text-caption font-medium text-neutral-500 leading-tight">Articles</p>
                <p class="text-body-lg font-semibold text-white leading-tight">{{ items.length }}</p>
              </div>
            </div>

            <div class="h-8 w-px bg-white/10" />

            <div class="flex items-center gap-3">
              <div class="flex size-11 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm">
                <Icon name="ph:clock" class="size-5 text-primary-300" />
              </div>
              <div>
                <p class="text-caption font-medium text-neutral-500 leading-tight">Livraison</p>
                <p class="text-body-lg font-semibold text-white leading-tight">~30 min</p>
              </div>
            </div>

            <div class="h-8 w-px bg-white/10" />

            <div class="flex items-center gap-3">
              <div class="flex size-11 items-center justify-center rounded-xl bg-primary-500/25 border border-primary-400/20">
                <Icon name="ph:wallet" class="size-5 text-primary-300" />
              </div>
              <div>
                <p class="text-caption font-medium text-primary-400 leading-tight">Total</p>
                <p class="text-body-lg font-semibold text-white leading-tight">{{ total.toFixed(2) }} &euro;</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="mx-auto max-w-7xl px-6 py-10 sm:px-10">
      <!-- Empty State -->
      <EmptyState
        v-if="isEmpty"
        title="Votre panier est vide"
        description="Parcourez notre catalogue et ajoutez des produits à louer."
      >
        <template #icon>
          <Icon name="ph:shopping-cart" class="size-10 text-primary-500" />
        </template>
        <template #actions>
          <NuxtLink to="/products">
            <Button variant="gradient" size="pill" class="font-semibold">
              <Icon name="ph:storefront" class="size-4" />
              Voir le catalogue
            </Button>
          </NuxtLink>
          <Button v-if="isDev" variant="glass" size="pill-sm" @click="seedDemo">
            Remplir avec des articles de d&eacute;mo
          </Button>
        </template>
      </EmptyState>

      <!-- Cart Grid -->
      <div v-else class="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <!-- Items Column -->
        <div class="lg:col-span-8 space-y-4">
          <div class="mb-2 flex items-center justify-between">
            <h2 class="text-h4 font-semibold text-text-primary">Vos articles</h2>
            <span class="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-3 py-1.5 text-caption font-medium text-primary-600">
              <Icon name="ph:package" class="size-3.5" />
              {{ items.length }} produit{{ items.length > 1 ? 's' : '' }}
            </span>
          </div>

          <CartItemRow
            v-for="item in items"
            :key="item.productId"
            :item="item"
            :line-price="linePrice(item)"
            @remove="removeItem"
            @update-quantity="updateQuantity"
            @update-duration="updateDuration"
          />

          <!-- Trust Bar -->
          <div class="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div class="rounded-xl rounded-tl-feature bg-surface-purple border border-primary-100 p-4 flex items-center gap-3">
              <div class="flex size-10 items-center justify-center rounded-full bg-primary-100">
                <Icon name="ph:shield-check" class="size-5 text-primary-600" />
              </div>
              <div>
                <p class="text-body-sm font-semibold text-text-primary">Paiement s&eacute;curis&eacute;</p>
                <p class="text-caption text-text-muted">Chiffrement SSL 256-bit</p>
              </div>
            </div>
            <div class="rounded-xl rounded-tr-feature bg-surface-violet border border-accent-100 p-4 flex items-center gap-3">
              <div class="flex size-10 items-center justify-center rounded-full bg-accent-100">
                <Icon name="ph:arrows-clockwise" class="size-5 text-accent-600" />
              </div>
              <div>
                <p class="text-body-sm font-semibold text-text-primary">Annulation gratuite</p>
                <p class="text-caption text-text-muted">Avant la livraison</p>
              </div>
            </div>
            <div class="rounded-xl rounded-bl-feature bg-surface-lavender border border-primary-100 p-4 flex items-center gap-3">
              <div class="flex size-10 items-center justify-center rounded-full bg-primary-100">
                <Icon name="ph:lightning" class="size-5 text-primary-600" />
              </div>
              <div>
                <p class="text-body-sm font-semibold text-text-primary">Livraison rapide</p>
                <p class="text-caption text-text-muted">En 30 min ou moins</p>
              </div>
            </div>
            <div class="rounded-xl rounded-br-feature bg-surface-lilac border border-primary-100 p-4 flex items-center gap-3">
              <div class="flex size-10 items-center justify-center rounded-full bg-primary-100">
                <Icon name="ph:headset" class="size-5 text-primary-600" />
              </div>
              <div>
                <p class="text-body-sm font-semibold text-text-primary">Support 7j/7</p>
                <p class="text-caption text-text-muted">Assistance d&eacute;di&eacute;e</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Summary Column -->
        <div class="lg:col-span-4">
          <div class="sticky top-6 space-y-4">
            <PriceSummary :subtotal="subtotal" :delivery-fee="deliveryFee" :total="total">
              <template #actions>
                <Button
                  variant="gradient"
                  size="pill"
                  class="w-full py-3.5 font-semibold gap-2"
                  @click="goToCheckout"
                >
                  Passer au paiement
                  <Icon name="ph:arrow-right" class="size-4" />
                </Button>
              </template>
              <template #footer>
                <div class="flex items-center justify-center gap-1.5">
                  <Icon name="ph:lock-simple" class="size-3.5 text-text-muted" />
                  Paiement s&eacute;curis&eacute; &middot; Annulation gratuite avant livraison
                </div>
              </template>
            </PriceSummary>

            <!-- Continue Shopping -->
            <NuxtLink to="/products" class="block">
              <Button variant="glass" size="pill-sm" class="w-full gap-2">
                <Icon name="ph:storefront" class="size-4" />
                Continuer mes achats
              </Button>
            </NuxtLink>

            <!-- Promo Teaser -->
            <div class="rounded-2xl bg-surface-lilac border border-primary-100 p-5">
              <div class="flex items-center gap-3 mb-3">
                <div class="flex size-9 items-center justify-center rounded-full bg-primary-500 text-white">
                  <Icon name="ph:percent" class="size-4" />
                </div>
                <p class="text-body-sm font-semibold text-text-primary">Code promo</p>
              </div>
              <div class="flex gap-2">
                <input
                  type="text"
                  disabled
                  placeholder="Bient&ocirc;t disponible"
                  class="flex-1 rounded-full border border-neutral-200 bg-neutral-50 px-4 py-2 text-body-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-400/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                <Button variant="outline" size="pill-sm" class="shrink-0" disabled>
                  Appliquer
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
