import type { Ref } from 'vue'

export type DurationUnit = 'flat' | 'hourly' | 'daily' | 'weekly'

export interface CartItem {
  productId: string
  name: string
  image: string
  pricingType: 'flat' | 'tiered'
  price: { flat?: number; hourly?: number; daily?: number; weekly?: number }
  quantity: number
  durationUnit: DurationUnit
  durationValue: number
  warehouseIds: string[]
  stock: number
}

const CART_STORAGE_KEY = 'ez-cart'
const DELIVERY_FEE = 4.99

export function useCart() {
  const items = useState<CartItem[]>('cart:items', () => [])
  const hydrated = useState<boolean>('cart:hydrated', () => false)

  if (import.meta.client && !hydrated.value) {
    const stored = localStorage.getItem(CART_STORAGE_KEY)
    if (stored) {
      try {
        items.value = JSON.parse(stored)
      }
      catch {
        localStorage.removeItem(CART_STORAGE_KEY)
      }
    }
    hydrated.value = true
  }

  function persist() {
    if (!import.meta.client) return
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items.value))
  }

  watch(items, persist, { deep: true })

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

  const count = computed(() => items.value.reduce((sum, i) => sum + i.quantity, 0))
  const subtotal = computed(() => items.value.reduce((sum, i) => sum + computeLinePrice(i), 0))
  const deliveryFee = computed(() => (items.value.length > 0 ? DELIVERY_FEE : 0))
  const total = computed(() => subtotal.value + deliveryFee.value)
  const isEmpty = computed(() => items.value.length === 0)

  function addItem(payload: Omit<CartItem, 'quantity' | 'durationUnit' | 'durationValue'> & {
    quantity?: number
    durationUnit?: DurationUnit
    durationValue?: number
  }) {
    const existing = items.value.find(i => i.productId === payload.productId)
    if (existing) {
      existing.quantity = Math.min(existing.quantity + (payload.quantity ?? 1), existing.stock)
      return
    }
    const defaultUnit: DurationUnit = payload.pricingType === 'flat' ? 'flat' : 'daily'
    items.value.push({
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
  }

  function removeItem(productId: string) {
    items.value = items.value.filter(i => i.productId !== productId)
  }

  function updateQuantity(productId: string, quantity: number) {
    const item = items.value.find(i => i.productId === productId)
    if (!item) return
    const next = Math.max(1, Math.min(quantity, item.stock))
    item.quantity = next
  }

  function updateDuration(productId: string, unit: DurationUnit, value: number) {
    const item = items.value.find(i => i.productId === productId)
    if (!item || item.pricingType === 'flat') return
    item.durationUnit = unit
    item.durationValue = Math.max(1, value)
  }

  function clearCart() {
    items.value = []
  }

  function linePrice(item: CartItem): number {
    return computeLinePrice(item)
  }

  return {
    items: items as Ref<CartItem[]>,
    count,
    subtotal,
    deliveryFee,
    total,
    isEmpty,
    addItem,
    removeItem,
    updateQuantity,
    updateDuration,
    clearCart,
    linePrice,
  }
}
