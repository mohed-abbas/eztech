import { defineStore } from 'pinia'

export type DurationUnit = 'flat' | 'hourly' | 'daily' | 'weekly'

export interface CartItem {
  productId: string
  name: string
  image: string
  pricingType: 'flat' | 'tiered'
  price: { flat?: number, hourly?: number, daily?: number, weekly?: number }
  quantity: number
  durationUnit: DurationUnit
  durationValue: number
  warehouseIds: string[]
  stock: number
}

// v2: les paniers v1 stockaient un prix par palier RECOPIE depuis un seul scalaire renvoye par le
// BFF (heure = jour = semaine). Ces lignes affichaient donc un total que le serveur ne reprend pas
// a son compte. On repart d'un panier vide plutot que de rejouer ces prix faux.
const CART_STORAGE_KEY = 'ez-cart-v2'
// offline fallback only — the live fee comes from the server (D-07) via loadDeliveryFee()
const DELIVERY_FEE_FALLBACK = 4.99

/** Paliers de location, dans l'ordre d'affichage. `flat` n'en est pas un : c'est l'autre mode. */
export const TIER_UNITS = ['hourly', 'daily', 'weekly'] as const

/**
 * Paliers reellement tarifes pour cette ligne. Un palier sans prix ne doit jamais etre propose :
 * computeLinePrice le compterait 0 alors que le serveur, lui, reprend le prix du palier depuis la
 * colonne Product correspondante (backend/src/lib/pricing.ts computeLineTotal).
 */
const priced = (v: number | undefined): boolean => typeof v === 'number' && v > 0

export function availableUnits(item: Pick<CartItem, 'pricingType' | 'price'>): DurationUnit[] {
  // Un produit a prix fixe sans flatPrice n'a pas plus de tarif qu'un produit a paliers sans palier.
  if (item.pricingType === 'flat') return priced(item.price.flat) ? ['flat'] : []
  return TIER_UNITS.filter(u => priced(item.price[u]))
}

function computeLinePrice(item: CartItem): number {
  const qty = item.quantity
  if (item.pricingType === 'flat') {
    return (item.price.flat ?? 0) * qty
  }
  const unitPrice
    = item.durationUnit === 'hourly' ? (item.price.hourly ?? 0)
      : item.durationUnit === 'daily' ? (item.price.daily ?? 0)
        : item.durationUnit === 'weekly' ? (item.price.weekly ?? 0)
          : 0
  return unitPrice * item.durationValue * qty
}

export const useCartStore = defineStore('cart', {
  state: () => ({
    items: [] as CartItem[],
    hydrated: false,
    // server-driven delivery fee (D-07); seeded with the offline fallback until loadDeliveryFee resolves
    serverDeliveryFee: DELIVERY_FEE_FALLBACK,
    feeLoaded: false,
  }),

  getters: {
    count: state => state.items.reduce((sum, i) => sum + i.quantity, 0),
    subtotal: state => state.items.reduce((sum, i) => sum + computeLinePrice(i), 0),
    deliveryFee: state => (state.items.length > 0 ? state.serverDeliveryFee : 0),
    total(): number {
      return this.subtotal + this.deliveryFee
    },
    isEmpty: state => state.items.length === 0,
  },

  actions: {
    hydrate() {
      if (!import.meta.client || this.hydrated) return
      this.hydrated = true
      // pull the server-driven delivery fee (D-07) — fire-and-forget, falls back to offline value
      void this.loadDeliveryFee()
      const stored = localStorage.getItem(CART_STORAGE_KEY)
      if (!stored) return
      try {
        this.items = JSON.parse(stored)
      }
      catch {
        localStorage.removeItem(CART_STORAGE_KEY)
      }
    },

    async loadDeliveryFee() {
      if (this.feeLoaded) return
      this.feeLoaded = true
      try {
        const res = await $fetch<{ deliveryFee: number }>('/api/config')
        if (typeof res.deliveryFee === 'number') this.serverDeliveryFee = res.deliveryFee
      }
      catch {
        // keep the offline fallback if the config BFF is unreachable
        this.feeLoaded = false
      }
    },

    persist() {
      if (!import.meta.client) return
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(this.items))
    },

    linePrice(item: CartItem): number {
      return computeLinePrice(item)
    },

    /** Paliers proposables pour cette ligne — a utiliser pour peupler le selecteur de duree. */
    unitsFor(item: CartItem): DurationUnit[] {
      return availableUnits(item)
    },

    addItem(payload: Omit<CartItem, 'quantity' | 'durationUnit' | 'durationValue'> & {
      quantity?: number
      durationUnit?: DurationUnit
      durationValue?: number
    }) {
      if (payload.stock <= 0) return
      // Un produit sans aucun palier tarife n'est pas commandable : le serveur le facturerait 0.
      const units = availableUnits(payload)
      if (units.length === 0) return

      const existing = this.items.find(i => i.productId === payload.productId)
      if (existing) {
        existing.quantity = Math.min(existing.quantity + (payload.quantity ?? 1), existing.stock)
        this.persist()
        return
      }
      // Le jour reste le palier par defaut quand il existe, sinon le premier reellement tarife.
      const defaultUnit: DurationUnit = units.includes('daily') ? 'daily' : units[0]!
      const requested = payload.durationUnit
      this.items.push({
        productId: payload.productId,
        name: payload.name,
        image: payload.image,
        pricingType: payload.pricingType,
        price: payload.price,
        quantity: payload.quantity ?? 1,
        durationUnit: requested && units.includes(requested) ? requested : defaultUnit,
        durationValue: payload.durationValue ?? 1,
        warehouseIds: payload.warehouseIds,
        stock: payload.stock,
      })
      this.persist()
    },

    removeItem(productId: string) {
      this.items = this.items.filter(i => i.productId !== productId)
      this.persist()
    },

    updateQuantity(productId: string, quantity: number) {
      const item = this.items.find(i => i.productId === productId)
      if (!item) return
      item.quantity = Math.max(1, Math.min(quantity, item.stock))
      this.persist()
    },

    updateDuration(productId: string, unit: DurationUnit, value: number) {
      const item = this.items.find(i => i.productId === productId)
      if (!item || item.pricingType === 'flat') return
      // Garde-fou : un palier sans prix serait affiche 0 ici et facture autrement par le serveur.
      // Le selecteur ne devrait deja plus le proposer (voir unitsFor), ceci en est le filet.
      if (!availableUnits(item).includes(unit)) return
      item.durationUnit = unit
      item.durationValue = Math.max(1, value)
      this.persist()
    },

    clearCart() {
      this.items = []
      this.persist()
    },
  },
})
