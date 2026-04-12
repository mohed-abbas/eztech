<script setup lang="ts">
definePageMeta({ layout: 'default', middleware: 'auth' })

const cart = useCartStore()
cart.hydrate()
const { items, subtotal, deliveryFee, total, isEmpty } = storeToRefs(cart)
const { addItem, removeItem, updateQuantity, updateDuration, linePrice } = cart

async function seedDemo() {
  const products = (await import('~/data/mock/products.json')).default as Array<{
    id: string
    name: string
    image: string
    pricingType: 'flat' | 'tiered'
    price: { flat?: number, hourly?: number, daily?: number, weekly?: number }
    stock: number
    warehouseIds: string[]
  }>
  const picks = [products[0], products.find(p => p.pricingType === 'tiered'), products[5]].filter(Boolean)
  for (const p of picks) {
    addItem({
      productId: p!.id,
      name: p!.name,
      image: p!.image,
      pricingType: p!.pricingType,
      price: p!.price,
      stock: p!.stock,
      warehouseIds: p!.warehouseIds,
    })
  }
}

async function goToCheckout() {
  await navigateTo('/checkout')
}
</script>

<template>
  <div class="min-h-screen bg-bg-muted py-10 px-4">
    <div class="max-w-5xl mx-auto">
      <div class="mb-8 flex items-center gap-3">
        <NuxtLink to="/products" class="text-text-muted hover:text-text-primary transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </NuxtLink>
        <h1 class="text-h3 font-bold text-text-primary">
          Mon panier
        </h1>
        <span v-if="!isEmpty" class="ml-auto text-sm text-text-muted">
          {{ items.length }} article{{ items.length > 1 ? 's' : '' }}
        </span>
      </div>

      <EmptyState
        v-if="isEmpty"
        title="Votre panier est vide"
        description="Parcourez notre catalogue et ajoutez des produits à louer."
      >
        <template #icon>
          <svg class="w-10 h-10 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </template>
        <template #actions>
          <NuxtLink
            to="/products"
            class="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 hover:bg-primary-700 px-6 py-3 font-semibold text-white transition-colors"
          >
            Voir le catalogue
          </NuxtLink>
          <button
            type="button"
            class="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-200 hover:bg-neutral-50 px-6 py-3 font-medium text-text-secondary transition-colors"
            @click="seedDemo"
          >
            Remplir avec des articles de démo
          </button>
        </template>
      </EmptyState>

      <div v-else class="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div class="lg:col-span-3 space-y-4">
          <CartItemRow
            v-for="item in items"
            :key="item.productId"
            :item="item"
            :line-price="linePrice(item)"
            @remove="removeItem"
            @update-quantity="updateQuantity"
            @update-duration="updateDuration"
          />
        </div>

        <div class="lg:col-span-2">
          <div class="sticky top-6">
            <PriceSummary :subtotal="subtotal" :delivery-fee="deliveryFee" :total="total">
              <template #actions>
                <button
                  class="w-full rounded-xl py-3.5 font-semibold text-white bg-primary-600 hover:bg-primary-700 active:scale-[.99] transition-all flex items-center justify-center gap-2"
                  @click="goToCheckout"
                >
                  Passer au paiement
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </template>
              <template #footer>
                Paiement sécurisé · Annulation gratuite avant livraison
              </template>
            </PriceSummary>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
