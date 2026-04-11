<script setup lang="ts">
import type { DurationUnit } from '~/composables/useCart'

definePageMeta({ layout: 'default', middleware: 'auth' })

const { items, subtotal, deliveryFee, total, isEmpty, addItem, removeItem, updateQuantity, updateDuration, linePrice } = useCart()

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

function onQtyInput(productId: string, e: Event) {
  const val = Number((e.target as HTMLInputElement).value)
  if (Number.isFinite(val)) updateQuantity(productId, val)
}

const UNIT_LABEL: Record<DurationUnit, string> = {
  flat: 'location',
  hourly: 'heure',
  daily: 'jour',
  weekly: 'semaine',
}

function availableUnits(pricingType: 'flat' | 'tiered'): DurationUnit[] {
  if (pricingType === 'flat') return ['flat']
  return ['hourly', 'daily', 'weekly']
}

function onUnitChange(productId: string, e: Event, currentValue: number) {
  const unit = (e.target as HTMLSelectElement).value as DurationUnit
  updateDuration(productId, unit, currentValue)
}

function onDurationValueInput(productId: string, unit: DurationUnit, e: Event) {
  const val = Number((e.target as HTMLInputElement).value)
  if (Number.isFinite(val)) updateDuration(productId, unit, val)
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
        <h1 class="text-h3 font-bold text-text-primary">Mon panier</h1>
        <span v-if="!isEmpty" class="ml-auto text-sm text-text-muted">
          {{ items.length }} article{{ items.length > 1 ? 's' : '' }}
        </span>
      </div>

      <!-- EMPTY STATE -->
      <div v-if="isEmpty" class="bg-white rounded-2xl shadow-sm border border-neutral-200 p-12 text-center">
        <div class="w-20 h-20 rounded-full bg-primary-50 flex items-center justify-center mx-auto mb-6">
          <svg class="w-10 h-10 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <h2 class="text-h4 font-semibold text-text-primary mb-2">Votre panier est vide</h2>
        <p class="text-text-muted mb-6">Parcourez notre catalogue et ajoutez des produits à louer.</p>
        <div class="flex flex-col sm:flex-row gap-3 justify-center">
          <NuxtLink
            to="/products"
            class="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 hover:bg-primary-700 px-6 py-3 font-semibold text-white transition-colors"
          >
            Voir le catalogue
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </NuxtLink>
          <button
            class="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-200 hover:bg-neutral-50 px-6 py-3 font-medium text-text-secondary transition-colors"
            @click="seedDemo"
          >
            Remplir avec des articles de démo
          </button>
        </div>
      </div>

      <!-- CART CONTENT -->
      <div v-else class="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <!-- Items list (3/5) -->
        <div class="lg:col-span-3 space-y-4">
          <div
            v-for="item in items"
            :key="item.productId"
            class="bg-white rounded-2xl shadow-sm border border-neutral-200 p-5"
          >
            <div class="flex gap-4">
              <img
                v-if="item.image && !item.image.startsWith('/assets/') || item.image.startsWith('http')"
                :src="item.image"
                :alt="item.name"
                class="w-20 h-20 rounded-xl object-cover bg-neutral-100"
                @error="($event.target as HTMLImageElement).style.display = 'none'"
              >
              <div v-else class="w-20 h-20 rounded-xl bg-primary-50 flex items-center justify-center shrink-0">
                <svg class="w-8 h-8 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
                </svg>
              </div>

              <div class="flex-1 min-w-0">
                <div class="flex items-start gap-3">
                  <div class="flex-1 min-w-0">
                    <h3 class="font-semibold text-text-primary truncate">{{ item.name }}</h3>
                    <p class="text-xs text-text-muted mt-0.5">
                      Stock disponible : {{ item.stock }}
                    </p>
                  </div>
                  <button
                    class="text-text-muted hover:text-error transition-colors shrink-0"
                    aria-label="Supprimer"
                    @click="removeItem(item.productId)"
                  >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M10 7V4a1 1 0 011-1h2a1 1 0 011 1v3" />
                    </svg>
                  </button>
                </div>

                <!-- Controls row -->
                <div class="mt-4 flex flex-wrap items-end gap-4">
                  <!-- Quantity -->
                  <div>
                    <label class="block text-xs font-medium text-text-secondary mb-1">Quantité</label>
                    <div class="flex items-center border border-neutral-200 rounded-lg overflow-hidden">
                      <button
                        class="w-8 h-9 flex items-center justify-center text-text-secondary hover:bg-neutral-50 disabled:opacity-40"
                        :disabled="item.quantity <= 1"
                        @click="updateQuantity(item.productId, item.quantity - 1)"
                      >
                        −
                      </button>
                      <input
                        :value="item.quantity"
                        type="number"
                        min="1"
                        :max="item.stock"
                        class="w-12 h-9 text-center font-medium text-text-primary bg-white focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                        @input="onQtyInput(item.productId, $event)"
                      >
                      <button
                        class="w-8 h-9 flex items-center justify-center text-text-secondary hover:bg-neutral-50 disabled:opacity-40"
                        :disabled="item.quantity >= item.stock"
                        @click="updateQuantity(item.productId, item.quantity + 1)"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <!-- Duration (tiered only) -->
                  <div v-if="item.pricingType === 'tiered'">
                    <label class="block text-xs font-medium text-text-secondary mb-1">Durée</label>
                    <div class="flex items-center gap-2">
                      <input
                        :value="item.durationValue"
                        type="number"
                        min="1"
                        class="w-16 h-9 px-2 text-center border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                        @input="onDurationValueInput(item.productId, item.durationUnit, $event)"
                      >
                      <select
                        :value="item.durationUnit"
                        class="h-9 px-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                        @change="onUnitChange(item.productId, $event, item.durationValue)"
                      >
                        <option
                          v-for="u in availableUnits(item.pricingType)"
                          :key="u"
                          :value="u"
                        >
                          {{ UNIT_LABEL[u] }}{{ item.durationValue > 1 ? 's' : '' }}
                        </option>
                      </select>
                    </div>
                  </div>

                  <div v-else class="text-xs text-text-muted">
                    Prix fixe par location
                  </div>

                  <!-- Line price -->
                  <div class="ml-auto text-right">
                    <p class="text-xs text-text-muted">Sous-total</p>
                    <p class="text-lg font-bold text-text-primary">
                      {{ linePrice(item).toFixed(2) }} €
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Summary (2/5) -->
        <div class="lg:col-span-2">
          <div class="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 sticky top-6">
            <h2 class="font-semibold text-text-primary mb-5">Récapitulatif</h2>

            <div class="space-y-2 text-sm">
              <div class="flex justify-between text-text-secondary">
                <span>Sous-total</span>
                <span>{{ subtotal.toFixed(2) }} €</span>
              </div>
              <div class="flex justify-between text-text-secondary">
                <span>Frais de livraison</span>
                <span>{{ deliveryFee.toFixed(2) }} €</span>
              </div>
              <div class="flex justify-between font-bold text-text-primary pt-3 mt-3 border-t border-neutral-100 text-base">
                <span>Total</span>
                <span>{{ total.toFixed(2) }} €</span>
              </div>
            </div>

            <button
              class="mt-6 w-full rounded-xl py-3.5 font-semibold text-white bg-primary-600 hover:bg-primary-700 active:scale-[.99] transition-all flex items-center justify-center gap-2"
              @click="goToCheckout"
            >
              Passer au paiement
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>

            <p class="mt-3 text-xs text-text-muted text-center">
              Paiement sécurisé · Annulation gratuite avant livraison
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
