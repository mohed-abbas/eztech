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

const CART_STORAGE_KEY = 'ez-cart'
const DELIVERY_FEE = 4.99

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
  }),

  getters: {
    count: state => state.items.reduce((sum, i) => sum + i.quantity, 0),
    subtotal: state => state.items.reduce((sum, i) => sum + computeLinePrice(i), 0),
    deliveryFee: state => (state.items.length > 0 ? DELIVERY_FEE : 0),
    total(): number {
      return this.subtotal + this.deliveryFee
    },
    isEmpty: state => state.items.length === 0,
  },

  actions: {
    hydrate() {
      if (!import.meta.client || this.hydrated) return
      this.hydrated = true
      const stored = localStorage.getItem(CART_STORAGE_KEY)
      if (!stored) return
      try {
        this.items = JSON.parse(stored)
      }
      catch {
        localStorage.removeItem(CART_STORAGE_KEY)
      }
    },

    persist() {
      if (!import.meta.client) return
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(this.items))
    },

    linePrice(item: CartItem): number {
      return computeLinePrice(item)
    },

    addItem(payload: Omit<CartItem, 'quantity' | 'durationUnit' | 'durationValue'> & {
      quantity?: number
      durationUnit?: DurationUnit
      durationValue?: number
    }) {
      if (payload.stock <= 0) return
      const existing = this.items.find(i => i.productId === payload.productId)
      if (existing) {
        existing.quantity = Math.min(existing.quantity + (payload.quantity ?? 1), existing.stock)
        this.persist()
        return
      }
      const defaultUnit: DurationUnit = payload.pricingType === 'flat' ? 'flat' : 'daily'
      this.items.push({
        productId: payload.productId,
        name: payload.name,
        image: payload.image,
        pricingType: payload.pricingType,
        price: payload.price,
        quantity: payload.quantity ?? 1,
        durationUnit: payload.durationUnit ?? defaultUnit,
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
