import { defineStore } from 'pinia'

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'rider_assigned'
  | 'picked_up'
  | 'in_transit'
  | 'delivered'
  | 'returned'
  | 'cancelled'

export interface OrderItem {
  productId: string
  quantity: number
  duration: { type: 'flat' | 'hourly' | 'daily' | 'weekly', value: number }
  unitPrice: number
  total: number
}

export interface OrderAddress {
  street: string
  city: string
  zipCode: string
  coordinates?: { lat: number, lng: number }
}

export interface Order {
  id: string
  userId: string
  items: OrderItem[]
  status: OrderStatus
  deliveryAddress: OrderAddress
  warehouseId: string
  riderId: string | null
  subtotal: number
  deliveryFee: number
  total: number
  createdAt: string
  estimatedDelivery: string | null
  deliveredAt: string | null
  returnDue: string | null
}

export interface Rider {
  id: string
  name: string
  phone: string
  vehicleType: 'bicycle' | 'scooter' | 'car'
  rating: number
  totalDeliveries: number
  currentLocation?: { lat: number, lng: number }
}

export const STATUS_STEPS: OrderStatus[] = [
  'pending',
  'confirmed',
  'preparing',
  'rider_assigned',
  'picked_up',
  'in_transit',
  'delivered',
]

export const ACTIVE_STATUSES: OrderStatus[] = [
  'pending',
  'confirmed',
  'preparing',
  'rider_assigned',
  'picked_up',
  'in_transit',
]

export const STATUS_CONFIG: Record<OrderStatus, { label: string, icon: string, color: string, bg: string, border: string }> = {
  pending: {
    label: 'En attente',
    icon: 'ph:hourglass',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
  },
  confirmed: {
    label: 'Confirmée',
    icon: 'ph:seal-check',
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
  },
  preparing: {
    label: 'En préparation',
    icon: 'ph:package',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
  },
  rider_assigned: {
    label: 'Livreur assigné',
    icon: 'ph:user-circle',
    color: 'text-primary-700',
    bg: 'bg-primary-50',
    border: 'border-primary-200',
  },
  picked_up: {
    label: 'Récupérée',
    icon: 'ph:cube',
    color: 'text-primary-700',
    bg: 'bg-primary-50',
    border: 'border-primary-200',
  },
  in_transit: {
    label: 'En route',
    icon: 'ph:motorcycle',
    color: 'text-primary-700',
    bg: 'bg-primary-50',
    border: 'border-primary-200',
  },
  delivered: {
    label: 'Livrée',
    icon: 'ph:check-circle',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
  },
  returned: {
    label: 'Retournée',
    icon: 'ph:arrows-clockwise',
    color: 'text-neutral-700',
    bg: 'bg-neutral-50',
    border: 'border-neutral-200',
  },
  cancelled: {
    label: 'Annulée',
    icon: 'ph:x-circle',
    color: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-200',
  },
}

const ORDERS_STORAGE_KEY = 'ez-orders'

export const useOrdersStore = defineStore('orders', {
  state: () => ({
    orders: [] as Order[],
    riders: [] as Rider[],
    productNames: {} as Record<string, string>,
    localOrderIds: new Set<string>(),
    simulationTimers: new Map<string, ReturnType<typeof setTimeout>>(),
    loading: false,
    error: null as string | null,
    hydrated: false,
  }),

  getters: {
    activeOrders: (state) => state.orders.filter(o => ACTIVE_STATUSES.includes(o.status)),
    deliveredOrders: (state) => state.orders.filter(o => o.status === 'delivered' || o.status === 'returned'),
    cancelledOrders: (state) => state.orders.filter(o => o.status === 'cancelled'),

    stats(): { total: number, active: number, delivered: number, spent: number } {
      return {
        total: this.orders.length,
        active: this.activeOrders.length,
        delivered: this.deliveredOrders.length,
        spent: this.orders.filter(o => o.status !== 'cancelled').reduce((sum, o) => sum + o.total, 0),
      }
    },
  },

  actions: {
    async hydrate() {
      if (this.hydrated) return
      this.hydrated = true
      this.loading = true
      this.error = null

      try {
        const { isMock } = useMock()

        if (isMock.value) {
          const [ordersData, ridersData, productsData] = await Promise.all([
            import('~/data/mock/orders.json').then(m => m.default),
            import('~/data/mock/riders.json').then(m => m.default),
            import('~/data/mock/products.json').then(m => m.default),
          ])

          this.orders = ordersData as Order[]
          this.riders = ridersData as Rider[]
          this.productNames = Object.fromEntries(
            (productsData as Array<{ id: string, name: string }>).map(p => [p.id, p.name]),
          )

          this.mergeLocalOrders()
          return
        }

        const config = useRuntimeConfig()
        const auth = useAuthStore()
        const response = await $fetch<{ orders: Order[] }>(`${config.public.apiUrl}/orders`, {
          headers: { Authorization: `Bearer ${auth.token}` },
        })
        this.orders = response.orders
      }
      catch (err) {
        this.error = err instanceof Error ? err.message : 'Erreur de chargement des commandes'
        this.hydrated = false
      }
      finally {
        this.loading = false
      }
    },

    mergeLocalOrders() {
      if (!import.meta.client) return
      try {
        const stored = localStorage.getItem(ORDERS_STORAGE_KEY)
        if (!stored) return
        const localOrders = JSON.parse(stored) as Order[]
        for (const lo of localOrders) {
          this.localOrderIds.add(lo.id)
          if (!this.orders.find(o => o.id === lo.id)) {
            this.orders.unshift(lo)
          }
        }
      }
      catch {
        // Ignore corrupt localStorage
      }
    },

    persistLocal() {
      if (!import.meta.client) return
      const toSave = this.orders.filter(o => this.localOrderIds.has(o.id))
      localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(toSave))
    },

    createOrder(payload: {
      items: OrderItem[]
      deliveryAddress: OrderAddress
      subtotal: number
      deliveryFee: number
      total: number
      userId?: string
    }): Order {
      const id = `ord_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
      const order: Order = {
        id,
        userId: payload.userId ?? 'guest',
        items: payload.items,
        status: 'confirmed',
        deliveryAddress: payload.deliveryAddress,
        warehouseId: 'wh_001',
        riderId: null,
        subtotal: payload.subtotal,
        deliveryFee: payload.deliveryFee,
        total: payload.total,
        createdAt: new Date().toISOString(),
        estimatedDelivery: new Date(Date.now() + 30 * 60_000).toISOString(),
        deliveredAt: null,
        returnDue: null,
      }

      for (const item of payload.items) {
        if ((item as OrderItem & { name?: string }).name) {
          this.productNames[item.productId] = (item as OrderItem & { name?: string }).name!
        }
      }

      this.orders.unshift(order)
      this.localOrderIds.add(order.id)
      this.persistLocal()

      return order
    },

    /** Simulate delivery cycle: advances status every `intervalMs` through all steps. Returns cancel function. */
    simulateDelivery(orderId: string, intervalMs = 3000): () => void {
      // Cancel any existing simulation for this order
      this.cancelSimulation(orderId)

      const order = this.orders.find(o => o.id === orderId)
      if (!order) return () => {}

      const mockRider = this.riders[Math.floor(Math.random() * this.riders.length)]

      let stepIdx = STATUS_STEPS.indexOf(order.status)
      if (stepIdx < 0) stepIdx = 0

      const advance = () => {
        const current = this.orders.find(o => o.id === orderId)
        if (!current) {
          this.simulationTimers.delete(orderId)
          return
        }

        stepIdx++
        if (stepIdx >= STATUS_STEPS.length) {
          current.deliveredAt = new Date().toISOString()
          this.persistLocal()
          this.simulationTimers.delete(orderId)
          return
        }

        current.status = STATUS_STEPS[stepIdx]!

        if (current.status === 'rider_assigned' && mockRider) {
          current.riderId = mockRider.id
        }

        this.persistLocal()
        this.simulationTimers.set(orderId, setTimeout(advance, intervalMs))
      }

      this.simulationTimers.set(orderId, setTimeout(advance, intervalMs))

      return () => this.cancelSimulation(orderId)
    },

    cancelSimulation(orderId: string) {
      const timer = this.simulationTimers.get(orderId)
      if (timer !== undefined) {
        clearTimeout(timer)
        this.simulationTimers.delete(orderId)
      }
    },

    getOrder(id: string): Order | undefined {
      return this.orders.find(o => o.id === id)
    },

    getRider(riderId: string | null): Rider | undefined {
      if (!riderId) return undefined
      return this.riders.find(r => r.id === riderId)
    },

    getProductName(productId: string): string {
      return this.productNames[productId] ?? productId
    },

    getStepIndex(status: OrderStatus): number {
      const idx = STATUS_STEPS.indexOf(status)
      return idx >= 0 ? idx : 0
    },

    getProgress(status: OrderStatus): number {
      if (status === 'cancelled') return 0
      if (status === 'returned') return 100
      const idx = STATUS_STEPS.indexOf(status)
      if (idx < 0) return 0
      return Math.round((idx / (STATUS_STEPS.length - 1)) * 100)
    },

    itemCount(order: Order): number {
      return order.items.reduce((s, i) => s + i.quantity, 0)
    },

    itemSummary(order: Order): string {
      return order.items
        .map(i => {
          const name = this.getProductName(i.productId)
          return i.quantity > 1 ? `${name} ×${i.quantity}` : name
        })
        .join(', ')
    },
  },
})
