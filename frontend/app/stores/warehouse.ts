import { defineStore } from 'pinia'

export interface WarehouseSummary {
  id: string
  name: string
  address: string
  managerId: string | null
  manager?: { id: string, name: string, email: string } | null
}

export interface StockLine {
  id: string
  warehouseId: string
  productId: string
  quantity: number
  product: {
    id: string
    name: string
    slug: string
    imageUrl: string
    categoryId: string
    category?: { name: string } | null
  }
}

export interface ReturnItem {
  id: string
  reference: string
  status: string
  pickupAddress: string
  completedAt: string | null
  inspectionResult: 'available' | 'damaged' | null
  inspectionNote: string | null
  inspectedAt: string | null
  orderId: string | null
  customerId: string | null
  riderFee: number
}

export interface OrderToPrepare {
  id: string
  reference: string
  status: string
  preparedAt: string | null
  // code remis de vive voix au livreur au comptoir : l'API ne l'expose qu'a l'admin et au
  // responsable d'entrepot, jamais au livreur ni au client. Null tant que la commande n'est pas prete.
  pickupCode: string | null
  createdAt: string
  dropoffAddress: string
  items: { name: string, quantity: number }[]
}

export const LOW_STOCK_THRESHOLD = 3

export const useWarehouseStore = defineStore('warehouse', {
  state: () => ({
    warehouses: [] as WarehouseSummary[],
    selectedId: null as string | null,
    stock: [] as StockLine[],
    ordersToPrepare: [] as OrderToPrepare[],
    returnsToInspect: [] as ReturnItem[],
    returnsProcessed: [] as ReturnItem[],
    loading: false,
    error: null as string | null,
  }),

  getters: {
    // pour un manager : uniquement ses entrepots ; pour un admin : tous
    myWarehouses(state): WarehouseSummary[] {
      const auth = useAuthStore()
      if (auth.role === 'admin') return state.warehouses
      return state.warehouses.filter(w => w.managerId === auth.user?.id)
    },
    selected(state): WarehouseSummary | null {
      return state.warehouses.find(w => w.id === state.selectedId) ?? null
    },
    lowStock(state): StockLine[] {
      return state.stock.filter(s => s.quantity <= LOW_STOCK_THRESHOLD)
    },
    totalUnits(state): number {
      return state.stock.reduce((sum, s) => sum + s.quantity, 0)
    },
  },

  actions: {
    _auth() {
      const auth = useAuthStore()
      auth.hydrate()
      return auth
    },
    async _api(path: string, opts: Record<string, unknown> = {}) {
      const config = useRuntimeConfig()
      this._auth()
      const { withAuthRetry, authHeaders, csrfHeaders } = useAuthedFetch()
      const url = `${config.public.apiUrl}${path}`
      // 401 -> refresh -> retry une fois -> clearSession : centralise dans useAuthedFetch
      return withAuthRetry(() => $fetch(url, {
        ...opts,
        credentials: 'include',
        headers: {
          ...authHeaders(),
          ...csrfHeaders(),
          ...(opts.headers as object ?? {}),
        },
      }))
    },

    async fetchWarehouses() {
      this.loading = true
      this.error = null
      try {
        const res = await this._api('/warehouses') as { warehouses: WarehouseSummary[] }
        this.warehouses = res.warehouses
        if (!this.selectedId || !this.myWarehouses.some(w => w.id === this.selectedId)) {
          this.selectedId = this.myWarehouses[0]?.id ?? null
        }
      }
      catch (e) {
        this.error = e instanceof Error ? e.message : 'Chargement des entrepots impossible'
      }
      finally {
        this.loading = false
      }
    },

    async fetchInventory(warehouseId: string) {
      this.loading = true
      this.error = null
      try {
        const res = await this._api(`/inventory/${warehouseId}`) as { stock: StockLine[] }
        this.stock = res.stock
      }
      catch (e) {
        this.error = e instanceof Error ? e.message : 'Chargement du stock impossible'
      }
      finally {
        this.loading = false
      }
    },

    async adjustStock(warehouseId: string, productId: string, quantity: number, reason?: string) {
      const res = await this._api(`/inventory/${warehouseId}/${productId}`, {
        method: 'PATCH',
        body: { quantity, ...(reason ? { reason } : {}) },
      }) as { stock: StockLine }
      const line = this.stock.find(s => s.productId === productId)
      if (line) line.quantity = res.stock.quantity
    },

    async fetchOrdersToPrepare(warehouseId: string) {
      try {
        const res = await this._api(`/warehouses/${warehouseId}/orders`) as { orders: OrderToPrepare[] }
        this.ordersToPrepare = res.orders
      }
      catch (e) {
        this.error = e instanceof Error ? e.message : 'Chargement des commandes impossible'
      }
    },

    // Marque une commande prete pour le ramassage. La reponse porte le code de remise que le
    // comptoir devra dicter au livreur : l'appel est idempotent cote backend, donc rejouer la
    // preparation renvoie le meme code et la meme date plutot que d'en reemettre un nouveau.
    async markPrepared(warehouseId: string, orderId: string) {
      const res = await this._api(`/warehouses/${warehouseId}/orders/${orderId}/prepare`, { method: 'PATCH' }) as {
        order: { preparedAt: string, pickupCode: string | null }
      }
      const order = this.ordersToPrepare.find(o => o.id === orderId)
      if (!order) return
      order.preparedAt = res.order.preparedAt
      order.pickupCode = res.order.pickupCode
    },

    async fetchReturns() {
      this.loading = true
      this.error = null
      try {
        const res = await this._api('/returns') as { toInspect: ReturnItem[], processed: ReturnItem[] }
        this.returnsToInspect = res.toInspect
        this.returnsProcessed = res.processed
      }
      catch (e) {
        this.error = e instanceof Error ? e.message : 'Chargement des retours impossible'
      }
      finally {
        this.loading = false
      }
    },

    // inspection d'un retour collecte : available (remis en stock) ou damaged
    async processReturn(id: string, result: 'available' | 'damaged', note?: string) {
      await this._api(`/returns/${id}/process`, {
        method: 'PATCH',
        body: { result, ...(note ? { note } : {}) },
      })
      await this.fetchReturns()
    },

    select(warehouseId: string) {
      this.selectedId = warehouseId
    },
  },
})
