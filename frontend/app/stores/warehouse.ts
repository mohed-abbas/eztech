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

export const LOW_STOCK_THRESHOLD = 3

export const useWarehouseStore = defineStore('warehouse', {
  state: () => ({
    warehouses: [] as WarehouseSummary[],
    selectedId: null as string | null,
    stock: [] as StockLine[],
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
      const auth = this._auth()
      const url = `${config.public.apiUrl}${path}`
      const csrf = useCookie('ez_csrf').value
      const call = () => $fetch(url, {
        ...opts,
        credentials: 'include',
        headers: {
          ...(auth.token ? { Authorization: `Bearer ${auth.token}` } : {}),
          ...(csrf ? { 'x-csrf-token': csrf } : {}),
          ...(opts.headers as object ?? {}),
        },
      })
      try {
        return await call()
      }
      catch (e) {
        const status = (e as { statusCode?: number, response?: { status?: number } })?.statusCode
          ?? (e as { response?: { status?: number } })?.response?.status
        if (status === 401) {
          if (await auth.refresh()) return await call()
          auth.logout()
        }
        throw e
      }
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

    select(warehouseId: string) {
      this.selectedId = warehouseId
    },
  },
})
