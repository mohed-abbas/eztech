import { defineStore } from 'pinia'
import {
  loadNotifications,
  markAllNotificationsRead as markAllNotificationsReadShared,
  markNotificationRead as markNotificationReadShared,
  useNotificationState,
  type AppNotification,
} from '~/composables/useNotifications'

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

// contenu du colis, snapshot pris a la commande (backend RIDER_ORDER_SELECT.items)
export interface DeliveryOrderItem {
  id: string
  name: string
  quantity: number
  imageUrl: string | null
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
  // Renseigne des que l'entrepot a marque le colis pret. Le livreur voit SI c'est pret, jamais le
  // code de ramassage associe : celui-ci ne sort pas du comptoir (backend routes/rider.ts:217).
  preparedAt?: string | null
  // Absent de la projection livreur aujourd'hui, present sur la reponse de PATCH /status (ligne
  // Order brute) : d'ou l'optionnel. Voir requiresPickupCode().
  warehouseId?: string | null
  items?: DeliveryOrderItem[]
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

// Les notifications du livreur sont exactement celles de la cloche du header : meme endpoint,
// meme payload. Le type local decrivait un sous-ensemble des colonnes (pas d'orderId, pas de
// readAt) alors que l'API renvoie la ligne complete — on s'aligne donc sur AppNotification,
// seule forme exacte. Alias conserve pour les imports existants.
export type RiderNotification = AppNotification

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

// --- Passage de relais entrepot -> livreur ----------------------------------
// Le comptoir remet au livreur un code court (6 caracteres, backend lib/orders.ts) sans lequel la
// transition at_warehouse -> picked_up est refusee. Ce code ne transite JAMAIS par une reponse
// destinee au livreur : il est saisi a la main, jamais affiche.

export const PICKUP_CODE_LENGTH = 6

// Normalisation identique au backend (normalizePickupCode) : le livreur tape sur un telephone.
export function normalizePickupCode(code: string): string {
  return code.trim().toUpperCase()
}

// Une course sans entrepot — creation « delivery-job » directe, jeux de demo — n'a aucun comptoir
// pour preparer le colis ni emettre un code : le backend l'exempte du controle, l'exiger ici
// bloquerait le livreur pour toujours a at_warehouse.
// La projection livreur (RIDER_ORDER_SELECT) n'expose pas encore warehouseId, donc on retombe sur
// le seul signal disponible cote livreur : seules les commandes boutique portent des lignes, et ce
// sont exactement celles qui se voient attribuer un entrepot a la creation (routes/orders.ts).
export function requiresPickupCode(order: Pick<DeliveryOrder, 'warehouseId' | 'items'>): boolean {
  if (order.warehouseId !== undefined) return order.warehouseId !== null
  return (order.items?.length ?? 0) > 0
}

// $fetch leve une FetchError : le code metier se lit sur err.data.error, et selon l'appelant sur
// err.response._data.error. Meme lecture que _api, une seule fois.
export function readApiErrorCode(err: unknown): string | null {
  const e = err as { data?: { error?: string }, response?: { _data?: { error?: string } } }
  return e?.data?.error ?? e?.response?._data?.error ?? null
}

// Les deux refus du relais entrepot, traduits en consignes actionnables au comptoir.
const ADVANCE_ERROR_MESSAGE: Record<string, string> = {
  order_not_prepared: "L'entrepôt n'a pas encore fini de préparer ce colis. Patientez, le comptoir vous remettra le code dès qu'il est prêt.",
  invalid_pickup_code: 'Code de ramassage incorrect. Vérifiez-le auprès du comptoir de l\'entrepôt.',
}

export function advanceErrorMessage(err: unknown, fallback = 'Impossible de mettre à jour la livraison. Réessayez.'): string {
  const code = readApiErrorCode(err)
  return (code && ADVANCE_ERROR_MESSAGE[code]) || fallback
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
    loading: false,
    error: null as string | null,
  }),

  getters: {
    isOnline: state => state.profile?.online ?? false,
    isApproved: state => state.profile?.applicationStatus === 'approved',
    activeReturn: state => state.returnsMine.find(r => r.status === 'accepted') ?? null,

    // --- Notifications --------------------------------------------------------
    // Le store ne stocke PLUS les notifications : la source de verite unique est
    // useNotifications() (useState partage avec la cloche du header). Il y avait deux
    // compteurs independants sur la meme donnee, donc « Tout marquer comme lu » cote livreur
    // remettait le compteur Pinia a zero pendant que le badge de la cloche gardait son chiffre.
    // Ces getters gardent les noms historiques lus par /rider/dashboard et /rider/notifications.
    notifications: (): AppNotification[] => useNotificationState().notifications.value,
    unreadCount: (): number => useNotificationState().unreadCount.value,
  },

  actions: {
    _auth() {
      const auth = useAuthStore()
      auth.hydrate()
      return auth
    },
    async _api(path: string, opts: Record<string, unknown> = {}) {
      const config = useRuntimeConfig()
      // hydrate avant de lire le token : sur le chemin header il vient de localStorage
      this._auth()
      const { withAuthRetry, authHeaders, csrfHeaders } = useAuthedFetch()
      const url = `${config.public.apiUrl}${path}`
      // send the httpOnly session cookie (credentials) + CSRF token; only attach a Bearer header
      // when a token actually exists so an empty one never shadows the cookie (Phase 7).
      // Le 401 -> refresh -> retry une fois -> clearSession vit dans useAuthedFetch (y compris le
      // cas user_revoked) : ne pas le reimplementer ici.
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

    // `pickupCode` n'est requis que pour at_warehouse -> picked_up sur une commande rattachee a un
    // entrepot (cf. requiresPickupCode). Il est envoye tel que saisi, normalise comme cote serveur.
    async advanceDelivery(next: DeliveryStatus, note?: string, pickupCode?: string) {
      if (!this.activeDelivery) return
      const orderId = this.activeDelivery.id
      const { isMock } = useMock()
      if (isMock.value) {
        this.activeDelivery = { ...this.activeDelivery, status: next, deliveredAt: next === 'delivered' ? new Date().toISOString() : this.activeDelivery.deliveredAt }
        if (next === 'delivered') this.activeDelivery = null
        return
      }
      // `/admin/orders/...` et non `/orders/...` : en production nginx route /api/orders vers le BFF
      // Nuxt, qui n'expose aucun handler pour /status — la requete repondait 404 et AUCUN livreur ne
      // pouvait faire avancer une course (rider_assigned -> ... -> delivered). Le prefixe /api/admin
      // n'est pas intercepte et atteint Express. Ce n'est pas une elevation de privilege : la route
      // porte requireRole('rider') et lit l'identite du livreur dans le token (orders.ts:332).
      const code = pickupCode ? normalizePickupCode(pickupCode) : ''
      const res = await this._api(`/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        body: { status: next, ...(note ? { note } : {}), ...(code ? { pickupCode: code } : {}) },
      }) as { order: DeliveryOrder }
      if (res.order.status === 'delivered' || res.order.status === 'cancelled') { this.activeDelivery = null; return }
      // La reponse de PATCH /status est la ligne Order brute : elle porte warehouseId et preparedAt
      // mais ni items[] ni events[], contrairement a /rider/orders/active. On fusionne donc au lieu
      // de remplacer, sinon le contenu du colis et le fil d'evenements disparaissent de l'ecran des
      // la premiere transition.
      this.activeDelivery = normalizeOrder({ ...this.activeDelivery, ...res.order })
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
    // Simples delegations vers l'etat partage : une seule implementation, une seule mise a jour
    // optimiste avec rollback (voir useNotifications.ts). Les signatures ne bougent pas.

    async fetchNotifications(onlyUnread = false) {
      await loadNotifications({ unread: onlyUnread })
    },

    async markNotificationRead(id: string) {
      await markNotificationReadShared(id)
    },

    async markAllNotificationsRead() {
      await markAllNotificationsReadShared()
    },
  },
})
