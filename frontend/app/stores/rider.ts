import { defineStore } from 'pinia'

// mirrors the backend OrderStatus enum
export type DeliveryStatus =
  | 'pending_assignment'
  | 'rider_assigned'
  | 'at_warehouse'
  | 'picked_up'
  | 'in_transit'
  | 'delivered'
  | 'cancelled'

export interface RiderProfile {
  id: string
  email: string
  name: string
  phone: string
  role: string
  vehicleType: 'bicycle' | 'scooter' | 'car' | null
  licenseNumber: string | null
  insuranceNumber: string | null
  applicationStatus: 'pending' | 'approved' | 'rejected'
  online: boolean
  totalDeliveries: number
  createdAt: string
}

export interface RiderDocument {
  id: string
  type: 'license' | 'insurance'
  fileName: string
  mimeType: string
  sizeBytes: number
  url: string
  status: 'pending' | 'approved' | 'rejected'
  uploadedAt: string
}

export interface OrderEvent {
  id: string
  orderId: string
  status: DeliveryStatus
  note: string | null
  createdAt: string
}

export interface DeliveryOrder {
  id: string
  reference: string
  status: DeliveryStatus
  customerId: string | null
  riderId: string | null
  pickupAddress: string
  pickupLat: number | null
  pickupLng: number | null
  dropoffAddress: string
  dropoffLat: number | null
  dropoffLng: number | null
  riderFee: number
  assignmentExpiresAt: string | null
  deliveredAt: string | null
  createdAt: string
  updatedAt: string
  events?: OrderEvent[]
}

export interface EarningsBucket { total: number, deliveries: number, returns: number }
export interface EarningsSummary {
  today: EarningsBucket
  week: EarningsBucket
  month: EarningsBucket
  allTime: EarningsBucket
}
export interface EarningsHistoryItem {
  kind: 'delivery' | 'return'
  id: string
  reference: string
  pickupAddress: string
  dropoffAddress: string | null
  riderFee: number
  completedAt: string | null
}

// mirrors the backend ReturnStatus enum
export type ReturnStatus = 'scheduled' | 'accepted' | 'completed' | 'cancelled'

export interface ReturnPickup {
  id: string
  reference: string
  status: ReturnStatus
  orderId: string | null
  customerId: string | null
  riderId: string | null
  pickupAddress: string
  pickupLat: number | null
  pickupLng: number | null
  scheduledFor: string | null
  riderFee: number
  completedAt: string | null
  createdAt: string
}

export type NotificationType = 'new_order' | 'return_scheduled' | 'earning_credited'

export interface RiderNotification {
  id: string
  type: NotificationType
  title: string
  body: string
  read: boolean
  createdAt: string
}

export const NOTIFICATION_ICON: Record<NotificationType, string> = {
  new_order: 'ph:package',
  return_scheduled: 'ph:arrow-u-down-left',
  earning_credited: 'ph:currency-eur',
}

export const RETURN_STATUS_LABEL: Record<ReturnStatus, string> = {
  scheduled: 'Planifié',
  accepted: 'Accepté',
  completed: 'Complété',
  cancelled: 'Annulé',
}

// statuses the rider can advance to, and the label of the action button
export const NEXT_STATUS: Partial<Record<DeliveryStatus, { next: DeliveryStatus, label: string }>> = {
  rider_assigned: { next: 'at_warehouse', label: "Arrivé à l'entrepôt" },
  at_warehouse: { next: 'picked_up', label: 'Colis récupéré' },
  picked_up: { next: 'in_transit', label: 'En route vers le client' },
  in_transit: { next: 'delivered', label: 'Livraison effectuée' },
}

export const DELIVERY_STATUS_LABEL: Record<DeliveryStatus, string> = {
  pending_assignment: 'En attente de livreur',
  rider_assigned: 'Livreur assigné',
  at_warehouse: "À l'entrepôt",
  picked_up: 'Colis récupéré',
  in_transit: 'En transit',
  delivered: 'Livré',
  cancelled: 'Annulé',
}

// coerce Prisma Decimal (serialized as string) into a number; non-finite values fall back to 0
// so the UI never renders "€NaN" from a malformed backend payload
function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v ?? 0)
  return Number.isFinite(n) ? n : 0
}
function normalizeOrder(o: DeliveryOrder): DeliveryOrder {
  return { ...o, riderFee: num(o.riderFee) }
}
function normalizeReturn(r: ReturnPickup): ReturnPickup {
  return { ...r, riderFee: num(r.riderFee) }
}

export const useRiderStore = defineStore('rider', {
  state: () => ({
    profile: null as RiderProfile | null,
    documents: [] as RiderDocument[],
    available: [] as DeliveryOrder[],
    activeDelivery: null as DeliveryOrder | null,
    earnings: null as EarningsSummary | null,
    history: [] as EarningsHistoryItem[],
    returnsAvailable: [] as ReturnPickup[],
    returnsMine: [] as ReturnPickup[],
    notifications: [] as RiderNotification[],
    unreadCount: 0,
    loading: false,
    error: null as string | null,
  }),

  getters: {
    isOnline: state => state.profile?.online ?? false,
    isApproved: state => state.profile?.applicationStatus === 'approved',
    activeReturn: state => state.returnsMine.find(r => r.status === 'accepted') ?? null,
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
      const call = () => $fetch(url, {
        ...opts,
        headers: { Authorization: `Bearer ${auth.token ?? ''}`, ...(opts.headers as object ?? {}) },
      })
      try {
        return await call()
      }
      catch (e) {
        const status = (e as { statusCode?: number, response?: { status?: number } })?.statusCode
          ?? (e as { response?: { status?: number } })?.response?.status
        const code = (e as { data?: { error?: string }, response?: { _data?: { error?: string } } })?.data?.error
          ?? (e as { response?: { _data?: { error?: string } } })?.response?._data?.error
        if (status === 401) {
          // when the backend signals the account was deleted/role-changed, refreshing won't help —
          // skip straight to logout to avoid an infinite refresh-retry loop
          if (code === 'user_revoked') { auth.logout(); throw e }
          // access token missing/expired — try a refresh, otherwise drop the (stale) session
          if (await auth.refresh()) return await call()
          auth.logout()
        }
        throw e
      }
    },

    async fetchProfile() {
      this.loading = true
      this.error = null
      try {
        const { isMock } = useMock()
        if (isMock.value) {
          const auth = this._auth()
          this.profile = {
            id: auth.user?.id ?? 'rider_mock',
            email: auth.user?.email ?? 'rider@eztech.fr',
            name: auth.user?.name ?? 'Livreur Démo',
            phone: auth.user?.phone ?? '',
            role: 'rider',
            vehicleType: auth.user?.vehicleType ?? 'scooter',
            licenseNumber: auth.user?.licenseNumber ?? null,
            insuranceNumber: auth.user?.insuranceNumber ?? null,
            applicationStatus: 'approved',
            online: this.profile?.online ?? false,
            totalDeliveries: 0,
            createdAt: auth.user?.createdAt ?? new Date().toISOString(),
          }
          return
        }
        const res = await this._api('/rider/profile') as { profile: RiderProfile }
        this.profile = res.profile
      }
      catch (err) {
        this.error = err instanceof Error ? err.message : 'Erreur de chargement du profil'
      }
      finally {
        this.loading = false
      }
    },

    async updateProfile(patch: Partial<Pick<RiderProfile, 'name' | 'phone' | 'vehicleType' | 'licenseNumber' | 'insuranceNumber'>>) {
      const { isMock } = useMock()
      if (isMock.value) {
        if (this.profile) this.profile = { ...this.profile, ...patch } as RiderProfile
        return
      }
      const res = await this._api('/rider/profile', { method: 'PUT', body: patch }) as { profile: RiderProfile }
      this.profile = res.profile
    },

    async setOnline(online: boolean) {
      const { isMock } = useMock()
      if (isMock.value) {
        if (this.profile) this.profile.online = online
        if (online) await this.fetchAvailable()
        else this.available = []
        return
      }
      const res = await this._api('/rider/status', { method: 'PATCH', body: { online } }) as { online: boolean }
      if (this.profile) this.profile.online = res.online
      if (res.online) await this.fetchAvailable()
      else this.available = []
    },

    async fetchDocuments() {
      const { isMock } = useMock()
      if (isMock.value) { this.documents = []; return }
      const res = await this._api('/rider/documents') as { documents: RiderDocument[] }
      this.documents = res.documents
    },

    async uploadDocument(type: 'license' | 'insurance', file: File) {
      const contentBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(file)
      })
      const { isMock } = useMock()
      if (isMock.value) {
        this.documents.unshift({
          id: `doc_${Date.now()}`, type, fileName: file.name, mimeType: file.type,
          sizeBytes: file.size, url: '#', status: 'pending', uploadedAt: new Date().toISOString(),
        })
        return
      }
      const res = await this._api('/rider/documents', {
        method: 'POST',
        body: { type, fileName: file.name, mimeType: file.type, contentBase64 },
      }) as { document: RiderDocument }
      this.documents.unshift(res.document)
    },

    async fetchAvailable() {
      const { isMock } = useMock()
      if (isMock.value) {
        if (!this.isOnline) { this.available = []; return }
        // synthesize a couple of jobs from the mock orders without a rider
        const orders = (await import('~/data/mock/orders.json')).default as Array<{ id: string, deliveryAddress: { street: string, city: string, zipCode: string }, riderId: string | null, deliveryFee: number, createdAt: string }>
        this.available = orders.filter(o => !o.riderId).slice(0, 3).map(o => ({
          id: o.id, reference: o.id.toUpperCase(), status: 'pending_assignment' as DeliveryStatus,
          customerId: null, riderId: null,
          pickupAddress: 'Entrepôt EzTech, Paris', pickupLat: 48.8566, pickupLng: 2.3522,
          dropoffAddress: `${o.deliveryAddress.street}, ${o.deliveryAddress.zipCode} ${o.deliveryAddress.city}`,
          dropoffLat: null, dropoffLng: null,
          riderFee: o.deliveryFee + 4, assignmentExpiresAt: null, deliveredAt: null,
          createdAt: o.createdAt, updatedAt: o.createdAt,
        }))
        return
      }
      const res = await this._api('/rider/orders/available') as { orders: DeliveryOrder[] }
      this.available = res.orders.map(normalizeOrder)
    },

    async fetchActive() {
      const { isMock } = useMock()
      if (isMock.value) return
      const res = await this._api('/rider/orders/active') as { order: DeliveryOrder | null }
      this.activeDelivery = res.order ? normalizeOrder(res.order) : null
    },

    async acceptOrder(orderId: string) {
      const { isMock } = useMock()
      if (isMock.value) {
        const order = this.available.find(o => o.id === orderId)
        if (order) {
          this.activeDelivery = { ...order, status: 'rider_assigned', riderId: this.profile?.id ?? null }
          this.available = this.available.filter(o => o.id !== orderId)
        }
        return
      }
      const res = await this._api(`/rider/orders/${orderId}/accept`, { method: 'POST' }) as { order: DeliveryOrder }
      this.activeDelivery = normalizeOrder(res.order)
      this.available = this.available.filter(o => o.id !== orderId)
    },

    async declineOrder(orderId: string) {
      const { isMock } = useMock()
      if (!isMock.value) {
        await this._api(`/rider/orders/${orderId}/decline`, { method: 'POST' })
      }
      this.available = this.available.filter(o => o.id !== orderId)
    },

    async advanceDelivery(next: DeliveryStatus, note?: string) {
      if (!this.activeDelivery) return
      const orderId = this.activeDelivery.id
      const { isMock } = useMock()
      if (isMock.value) {
        this.activeDelivery = { ...this.activeDelivery, status: next, deliveredAt: next === 'delivered' ? new Date().toISOString() : this.activeDelivery.deliveredAt }
        if (next === 'delivered') this.activeDelivery = null
        return
      }
      const res = await this._api(`/orders/${orderId}/status`, { method: 'PATCH', body: { status: next, ...(note ? { note } : {}) } }) as { order: DeliveryOrder }
      if (res.order.status === 'delivered' || res.order.status === 'cancelled') this.activeDelivery = null
      else this.activeDelivery = normalizeOrder(res.order)
    },

    async fetchEarnings() {
      const { isMock } = useMock()
      if (isMock.value) {
        const empty = { total: 0, deliveries: 0, returns: 0 }
        this.earnings = { today: { ...empty }, week: { ...empty }, month: { ...empty }, allTime: { ...empty } }
        this.history = []
        return
      }
      const [summary, hist] = await Promise.all([
        this._api('/rider/earnings') as Promise<EarningsSummary>,
        this._api('/rider/earnings/history') as Promise<{ history: EarningsHistoryItem[] }>,
      ])
      this.earnings = summary
      this.history = hist.history.map(h => ({ ...h, riderFee: num(h.riderFee) }))
    },

    // --- Returns -------------------------------------------------------------

    async fetchReturns() {
      const { isMock } = useMock()
      if (isMock.value) { this.returnsAvailable = []; this.returnsMine = []; return }
      const res = await this._api('/rider/returns') as { available: ReturnPickup[], mine: ReturnPickup[] }
      this.returnsAvailable = res.available.map(normalizeReturn)
      this.returnsMine = res.mine.map(normalizeReturn)
    },

    async acceptReturn(returnId: string) {
      const { isMock } = useMock()
      if (isMock.value) {
        const r = this.returnsAvailable.find(x => x.id === returnId)
        if (r) { this.returnsMine.unshift({ ...r, status: 'accepted', riderId: this.profile?.id ?? null }); this.returnsAvailable = this.returnsAvailable.filter(x => x.id !== returnId) }
        return
      }
      const res = await this._api(`/rider/returns/${returnId}/accept`, { method: 'POST' }) as { return: ReturnPickup }
      const r = normalizeReturn(res.return)
      this.returnsAvailable = this.returnsAvailable.filter(x => x.id !== returnId)
      this.returnsMine = [r, ...this.returnsMine.filter(x => x.id !== returnId)]
    },

    async completeReturn(returnId: string) {
      const { isMock } = useMock()
      if (isMock.value) {
        const r = this.returnsMine.find(x => x.id === returnId)
        if (r) { r.status = 'completed'; r.completedAt = new Date().toISOString() }
        return
      }
      const res = await this._api(`/rider/returns/${returnId}/complete`, { method: 'PATCH' }) as { return: ReturnPickup }
      const r = normalizeReturn(res.return)
      this.returnsMine = this.returnsMine.map(x => (x.id === returnId ? r : x))
    },

    // --- Notifications -------------------------------------------------------

    async fetchNotifications(onlyUnread = false) {
      const { isMock } = useMock()
      if (isMock.value) { this.notifications = []; this.unreadCount = 0; return }
      const res = await this._api(`/rider/notifications${onlyUnread ? '?unread=true' : ''}`) as { notifications: RiderNotification[], unreadCount: number }
      this.notifications = res.notifications
      this.unreadCount = res.unreadCount
    },

    async markNotificationRead(id: string) {
      const n = this.notifications.find(x => x.id === id)
      // if it's already read, nothing to do — avoids redundant network calls
      if (!n || n.read) return
      const prevRead = n.read
      const prevCount = this.unreadCount
      n.read = true
      this.unreadCount = Math.max(0, this.unreadCount - 1)
      const { isMock } = useMock()
      if (isMock.value) return
      try {
        await this._api(`/rider/notifications/${id}/read`, { method: 'PATCH' })
      }
      catch (e) {
        // rollback so the UI stays in sync with the server
        n.read = prevRead
        this.unreadCount = prevCount
        throw e
      }
    },

    async markAllNotificationsRead() {
      const prev = this.notifications.map(n => ({ id: n.id, read: n.read }))
      const prevCount = this.unreadCount
      this.notifications.forEach((n) => { n.read = true })
      this.unreadCount = 0
      const { isMock } = useMock()
      if (isMock.value) return
      try {
        await this._api('/rider/notifications/read-all', { method: 'POST' })
      }
      catch (e) {
        // rollback every entry's prior state on failure
        const snap = new Map(prev.map(p => [p.id, p.read]))
        this.notifications.forEach((n) => { const r = snap.get(n.id); if (r !== undefined) n.read = r })
        this.unreadCount = prevCount
        throw e
      }
    },
  },
})
