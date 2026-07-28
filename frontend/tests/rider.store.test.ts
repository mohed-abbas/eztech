import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { nuxtStubState, makeAuth, resetNuxtState } from './setup'
import {
  useRiderStore,
  NEXT_STATUS,
  DELIVERY_STATUS_LABEL,
  advanceErrorMessage,
  requiresPickupCode,
  type DeliveryOrder,
  type DeliveryStatus,
} from '~/stores/rider'
import { useNotificationState } from '~/composables/useNotifications'

// build a backend-shaped order; riderFee is intentionally a string to mimic Prisma Decimal serialisation
function makeOrder(over: Partial<Record<keyof DeliveryOrder, unknown>> = {}): Record<string, unknown> {
  return {
    id: 'order-1',
    reference: 'EZ-ABCDEF',
    status: 'pending_assignment',
    customerId: null,
    riderId: null,
    pickupAddress: 'Entrepôt',
    pickupLat: 48.8,
    pickupLng: 2.3,
    dropoffAddress: '1 Rue de Test',
    dropoffLat: null,
    dropoffLng: null,
    riderFee: '6.5',
    assignmentExpiresAt: null,
    deliveredAt: null,
    createdAt: '2026-05-12T10:00:00.000Z',
    updatedAt: '2026-05-12T10:00:00.000Z',
    ...over,
  }
}

// route $fetch responses by URL so test ordering doesn't matter
function routeFetch(table: Record<string, unknown>) {
  nuxtStubState.fetch.mockImplementation((url: string) => {
    const path = url.replace('http://api.test/api', '')
    if (!(path in table)) throw new Error(`unexpected fetch: ${path}`)
    return Promise.resolve(table[path])
  })
}

beforeEach(() => {
  setActivePinia(createPinia())
  // les notifications vivent dans un useState partage : sans reset, une cle survit d'un test a
  // l'autre et le suivant lit les lignes du precedent.
  resetNuxtState()
  nuxtStubState.isMock = false
  nuxtStubState.apiUrl = 'http://api.test/api'
  nuxtStubState.auth = makeAuth({ user: { id: 'rider-1', name: 'Test Rider', email: 'r@test.io', phone: '0600', createdAt: '2026-01-01' } })
  nuxtStubState.fetch = vi.fn()
})

describe('rider store — real API', () => {
  it('fetchProfile sends cookie credentials + CSRF header (and a bearer token when one is held)', async () => {
    routeFetch({ '/rider/profile': { profile: { id: 'rider-1', name: 'Lucas', email: 'l@test.io', phone: '0601', role: 'rider', vehicleType: 'scooter', licenseNumber: 'L1', insuranceNumber: 'I1', applicationStatus: 'approved', online: false, totalDeliveries: 3, createdAt: '2026-01-01' } } })
    const store = useRiderStore()
    await store.fetchProfile()

    expect(nuxtStubState.auth.hydrate).toHaveBeenCalled()
    expect(nuxtStubState.fetch).toHaveBeenCalledWith(
      'http://api.test/api/rider/profile',
      expect.objectContaining({
        credentials: 'include',
        headers: expect.objectContaining({ Authorization: 'Bearer test-token', 'x-csrf-token': 'test-csrf' }),
      }),
    )
    expect(store.profile?.name).toBe('Lucas')
    expect(store.profile?.totalDeliveries).toBe(3)
  })

  it('fetchProfile omits the Authorization header when no bearer token is held (cookie-only session)', async () => {
    nuxtStubState.auth.token = null
    routeFetch({ '/rider/profile': { profile: { id: 'rider-1', name: 'Lucas', email: 'l@test.io', phone: '0601', role: 'rider', vehicleType: 'scooter', licenseNumber: 'L1', insuranceNumber: 'I1', applicationStatus: 'approved', online: false, totalDeliveries: 3, createdAt: '2026-01-01' } } })
    const store = useRiderStore()
    await store.fetchProfile()

    const call = nuxtStubState.fetch.mock.calls[0]!
    expect(call[1]).toMatchObject({ credentials: 'include', headers: { 'x-csrf-token': 'test-csrf' } })
    expect((call[1] as { headers: Record<string, unknown> }).headers).not.toHaveProperty('Authorization')
  })

  it('fetchProfile records an error message on failure', async () => {
    nuxtStubState.fetch.mockRejectedValueOnce(new Error('boom'))
    const store = useRiderStore()
    await store.fetchProfile()
    expect(store.profile).toBeNull()
    expect(store.error).toBe('boom')
  })

  it('updateProfile PUTs the patch and stores the returned profile', async () => {
    routeFetch({ '/rider/profile': { profile: { id: 'rider-1', name: 'New', email: 'r@test.io', phone: '0699', role: 'rider', vehicleType: 'car', licenseNumber: 'L1', insuranceNumber: 'I1', applicationStatus: 'approved', online: false, totalDeliveries: 0, createdAt: '2026-01-01' } } })
    const store = useRiderStore()
    await store.updateProfile({ phone: '0699', vehicleType: 'car' })
    const call = nuxtStubState.fetch.mock.calls[0]
    expect(call[0]).toBe('http://api.test/api/rider/profile')
    expect(call[1]).toMatchObject({ method: 'PUT', body: { phone: '0699', vehicleType: 'car' } })
    expect(store.profile?.phone).toBe('0699')
  })

  it('setOnline(true) toggles status then loads available orders (coercing riderFee to number)', async () => {
    routeFetch({
      '/rider/status': { online: true },
      '/rider/orders/available': { orders: [makeOrder({ id: 'o1', riderFee: '6.5' }), makeOrder({ id: 'o2', riderFee: 8.2 })] },
    })
    const store = useRiderStore()
    store.profile = { online: false } as never
    await store.setOnline(true)

    expect(store.isOnline).toBe(true)
    expect(store.available.map(o => o.id)).toEqual(['o1', 'o2'])
    expect(store.available[0]!.riderFee).toBe(6.5)
    expect(typeof store.available[1]!.riderFee).toBe('number')
  })

  it('setOnline(false) clears the available list without fetching it', async () => {
    routeFetch({ '/rider/status': { online: false } })
    const store = useRiderStore()
    store.profile = { online: true } as never
    store.available = [makeOrder({ id: 'o1' }) as unknown as DeliveryOrder]
    await store.setOnline(false)
    expect(store.isOnline).toBe(false)
    expect(store.available).toEqual([])
    // only the PATCH call, no GET /available
    expect(nuxtStubState.fetch).toHaveBeenCalledTimes(1)
  })

  it('acceptOrder POSTs accept, sets activeDelivery and removes the order from the pool', async () => {
    routeFetch({ '/rider/orders/o1/accept': { order: makeOrder({ id: 'o1', status: 'rider_assigned', riderId: 'rider-1', riderFee: '7.5' }) } })
    const store = useRiderStore()
    store.available = [
      makeOrder({ id: 'o1' }) as unknown as DeliveryOrder,
      makeOrder({ id: 'o2' }) as unknown as DeliveryOrder,
    ]
    await store.acceptOrder('o1')
    expect(store.activeDelivery?.id).toBe('o1')
    expect(store.activeDelivery?.status).toBe('rider_assigned')
    expect(store.activeDelivery?.riderFee).toBe(7.5)
    expect(store.available.map(o => o.id)).toEqual(['o2'])
  })

  it('declineOrder POSTs decline and drops the order from the pool', async () => {
    routeFetch({ '/rider/orders/o1/decline': {} })
    const store = useRiderStore()
    store.available = [makeOrder({ id: 'o1' }) as unknown as DeliveryOrder, makeOrder({ id: 'o2' }) as unknown as DeliveryOrder]
    await store.declineOrder('o1')
    expect(nuxtStubState.fetch).toHaveBeenCalledWith('http://api.test/api/rider/orders/o1/decline', expect.objectContaining({ method: 'POST' }))
    expect(store.available.map(o => o.id)).toEqual(['o2'])
  })

  it('advanceDelivery updates the active delivery, and clears it when delivered', async () => {
    routeFetch({
      '/admin/orders/o1/status': { order: makeOrder({ id: 'o1', status: 'in_transit', riderId: 'rider-1' }) },
    })
    const store = useRiderStore()
    store.activeDelivery = makeOrder({ id: 'o1', status: 'picked_up', riderId: 'rider-1' }) as unknown as DeliveryOrder
    await store.advanceDelivery('in_transit')
    expect(store.activeDelivery?.status).toBe('in_transit')

    routeFetch({ '/admin/orders/o1/status': { order: makeOrder({ id: 'o1', status: 'delivered', riderId: 'rider-1', deliveredAt: '2026-05-12T11:00:00Z' }) } })
    await store.advanceDelivery('delivered')
    expect(store.activeDelivery).toBeNull()
  })

  // Garde de non-regression. En production nginx route /api/orders vers le BFF Nuxt, qui n'a aucun
  // handler /status : la transition repondait 404 et aucun livreur ne pouvait avancer une course.
  // Ce test a longtemps ete vert parce qu'il routait lui-meme le mauvais chemin — on verifie donc
  // desormais l'URL appelee, pas seulement le resultat.
  it('advanceDelivery targets the un-shadowed /admin/orders path, never /api/orders', async () => {
    routeFetch({
      '/admin/orders/o1/status': { order: makeOrder({ id: 'o1', status: 'in_transit', riderId: 'rider-1' }) },
    })
    const store = useRiderStore()
    store.activeDelivery = makeOrder({ id: 'o1', status: 'picked_up', riderId: 'rider-1' }) as unknown as DeliveryOrder
    await store.advanceDelivery('in_transit')

    expect(nuxtStubState.fetch).toHaveBeenCalledWith(
      'http://api.test/api/admin/orders/o1/status',
      expect.objectContaining({ method: 'PATCH' }),
    )
    const called = nuxtStubState.fetch.mock.calls.map((c: unknown[]) => String(c[0]))
    expect(called.some(u => u === 'http://api.test/api/orders/o1/status')).toBe(false)
  })

  it('advanceDelivery sends an optional note', async () => {
    routeFetch({ '/admin/orders/o1/status': { order: makeOrder({ id: 'o1', status: 'at_warehouse', riderId: 'rider-1' }) } })
    const store = useRiderStore()
    store.activeDelivery = makeOrder({ id: 'o1', status: 'rider_assigned', riderId: 'rider-1' }) as unknown as DeliveryOrder
    await store.advanceDelivery('at_warehouse', 'porte B')
    expect(nuxtStubState.fetch).toHaveBeenCalledWith('http://api.test/api/admin/orders/o1/status', expect.objectContaining({ method: 'PATCH', body: { status: 'at_warehouse', note: 'porte B' } }))
  })

  // Passage de relais entrepot -> livreur : sans le code, le backend refuse desormais
  // at_warehouse -> picked_up (409 order_not_prepared / 422 invalid_pickup_code).
  it('advanceDelivery sends the pickup code the rider typed, normalised like the backend', async () => {
    routeFetch({ '/admin/orders/o1/status': { order: makeOrder({ id: 'o1', status: 'picked_up', riderId: 'rider-1', warehouseId: 'wh-1' }) } })
    const store = useRiderStore()
    store.activeDelivery = makeOrder({ id: 'o1', status: 'at_warehouse', riderId: 'rider-1', warehouseId: 'wh-1' }) as unknown as DeliveryOrder
    await store.advanceDelivery('picked_up', undefined, ' k7h2mz ')
    expect(nuxtStubState.fetch).toHaveBeenCalledWith(
      'http://api.test/api/admin/orders/o1/status',
      expect.objectContaining({ method: 'PATCH', body: { status: 'picked_up', pickupCode: 'K7H2MZ' } }),
    )
  })

  it('advanceDelivery omits pickupCode entirely when the rider supplies none', async () => {
    routeFetch({ '/admin/orders/o1/status': { order: makeOrder({ id: 'o1', status: 'at_warehouse', riderId: 'rider-1' }) } })
    const store = useRiderStore()
    store.activeDelivery = makeOrder({ id: 'o1', status: 'rider_assigned', riderId: 'rider-1' }) as unknown as DeliveryOrder
    await store.advanceDelivery('at_warehouse')
    const body = (nuxtStubState.fetch.mock.calls[0]![1] as { body: Record<string, unknown> }).body
    expect(body).toEqual({ status: 'at_warehouse' })
  })

  // La reponse de PATCH /status est la ligne Order brute : ni items[] ni events[]. Les remplacer
  // ferait disparaitre le contenu du colis de l'ecran des la premiere transition.
  it('advanceDelivery keeps the parcel contents the status response does not carry', async () => {
    routeFetch({ '/admin/orders/o1/status': { order: makeOrder({ id: 'o1', status: 'picked_up', riderId: 'rider-1', preparedAt: '2026-05-12T10:30:00Z' }) } })
    const store = useRiderStore()
    store.activeDelivery = makeOrder({
      id: 'o1',
      status: 'at_warehouse',
      riderId: 'rider-1',
      items: [{ id: 'i1', name: 'Perceuse', quantity: 2, imageUrl: null }],
    }) as unknown as DeliveryOrder
    await store.advanceDelivery('picked_up', undefined, 'K7H2MZ')
    expect(store.activeDelivery?.status).toBe('picked_up')
    expect(store.activeDelivery?.items).toEqual([{ id: 'i1', name: 'Perceuse', quantity: 2, imageUrl: null }])
    expect(store.activeDelivery?.preparedAt).toBe('2026-05-12T10:30:00Z')
  })

  it('fetchActive normalises or nulls the active delivery', async () => {
    routeFetch({ '/rider/orders/active': { order: makeOrder({ id: 'o1', status: 'rider_assigned', riderFee: '5' }) } })
    const store = useRiderStore()
    await store.fetchActive()
    expect(store.activeDelivery?.riderFee).toBe(5)

    routeFetch({ '/rider/orders/active': { order: null } })
    await store.fetchActive()
    expect(store.activeDelivery).toBeNull()
  })

  it('fetchEarnings loads the summary and history, coercing fees', async () => {
    routeFetch({
      '/rider/earnings': { today: { total: 7.5, deliveries: 1 }, week: { total: 13.4, deliveries: 2 }, month: { total: 13.4, deliveries: 2 }, allTime: { total: 13.4, deliveries: 2 } },
      '/rider/earnings/history': { history: [{ id: 'o1', reference: 'EZ-1', pickupAddress: 'W', dropoffAddress: 'D', riderFee: '7.5', deliveredAt: '2026-05-12T11:00:00Z' }] },
    })
    const store = useRiderStore()
    await store.fetchEarnings()
    expect(store.earnings?.today.deliveries).toBe(1)
    expect(store.earnings?.allTime.total).toBe(13.4)
    expect(store.history).toHaveLength(1)
    expect(store.history[0]!.riderFee).toBe(7.5)
  })

  it('uploadDocument base64-encodes the file and prepends the returned document', async () => {
    routeFetch({ '/rider/documents': { document: { id: 'doc-1', type: 'license', fileName: 'permis.png', mimeType: 'image/png', sizeBytes: 3, url: '/uploads/x', status: 'pending', uploadedAt: '2026-05-12T11:00:00Z' } } })
    const store = useRiderStore()
    store.documents = [{ id: 'old', type: 'insurance', fileName: 'a', mimeType: 'application/pdf', sizeBytes: 1, url: '#', status: 'approved', uploadedAt: '2026-01-01' }]
    const file = new File(['abc'], 'permis.png', { type: 'image/png' })
    await store.uploadDocument('license', file)

    const call = nuxtStubState.fetch.mock.calls[0]!
    expect(call[0]).toBe('http://api.test/api/rider/documents')
    expect(call[1]).toMatchObject({ method: 'POST', body: expect.objectContaining({ type: 'license', fileName: 'permis.png', mimeType: 'image/png', contentBase64: Buffer.from('abc').toString('base64') }) })
    expect(store.documents.map(d => d.id)).toEqual(['doc-1', 'old'])
  })
})

describe('rider store — 401 handling', () => {
  function unauthorized() {
    return Object.assign(new Error('Unauthorized'), { statusCode: 401 })
  }

  it('refreshes the token and retries once on 401', async () => {
    nuxtStubState.auth.refresh = vi.fn().mockResolvedValue(true)
    nuxtStubState.fetch
      .mockRejectedValueOnce(unauthorized())
      .mockResolvedValueOnce({ profile: { id: 'rider-1', name: 'L', email: 'l@t.io', phone: '0', role: 'rider', vehicleType: 'scooter', licenseNumber: null, insuranceNumber: null, applicationStatus: 'approved', online: false, totalDeliveries: 0, createdAt: '2026-01-01' } })
    const store = useRiderStore()
    await store.fetchProfile()
    expect(nuxtStubState.auth.refresh).toHaveBeenCalledTimes(1)
    expect(store.profile?.name).toBe('L')
    expect(nuxtStubState.auth.logout).not.toHaveBeenCalled()
    expect(nuxtStubState.auth.clearSession).not.toHaveBeenCalled()
  })

  // Le chemin 401 partage (useAuthedFetch) efface la session locale au lieu d'appeler logout() :
  // inutile de repartir vers un serveur qui vient de rejeter ce token.
  it('clears the session when the refresh also fails', async () => {
    nuxtStubState.auth.refresh = vi.fn().mockResolvedValue(false)
    nuxtStubState.fetch.mockRejectedValueOnce(unauthorized())
    const store = useRiderStore()
    await store.fetchProfile()
    expect(nuxtStubState.auth.clearSession).toHaveBeenCalledTimes(1)
  })
})

describe('rider store — mock mode', () => {
  beforeEach(() => { nuxtStubState.isMock = true })

  it('fetchProfile builds a synthetic profile from the auth user without hitting the network', async () => {
    const store = useRiderStore()
    await store.fetchProfile()
    expect(nuxtStubState.fetch).not.toHaveBeenCalled()
    expect(store.profile).toMatchObject({ id: 'rider-1', name: 'Test Rider', applicationStatus: 'approved', vehicleType: 'scooter', online: false })
  })

  it('setOnline updates the local profile flag and clears the pool when going offline', async () => {
    const store = useRiderStore()
    await store.fetchProfile()
    await store.setOnline(false)
    expect(store.isOnline).toBe(false)
    expect(store.available).toEqual([])
    expect(nuxtStubState.fetch).not.toHaveBeenCalled()
  })

  it('acceptOrder moves a mock order from the pool to activeDelivery', async () => {
    const store = useRiderStore()
    await store.fetchProfile()
    store.available = [
      makeOrder({ id: 'm1' }) as unknown as DeliveryOrder,
      makeOrder({ id: 'm2' }) as unknown as DeliveryOrder,
    ]
    await store.acceptOrder('m1')
    expect(store.activeDelivery?.id).toBe('m1')
    expect(store.activeDelivery?.status).toBe('rider_assigned')
    expect(store.available.map(o => o.id)).toEqual(['m2'])
    expect(nuxtStubState.fetch).not.toHaveBeenCalled()
  })
})

describe('rider store — returns', () => {
  it('fetchReturns loads available + mine, coercing fees', async () => {
    routeFetch({ '/rider/returns': {
      available: [{ id: 'r1', reference: 'RET-1', status: 'scheduled', orderId: null, customerId: null, riderId: null, pickupAddress: 'X', pickupLat: null, pickupLng: null, scheduledFor: null, riderFee: '4.5', completedAt: null, createdAt: '2026-05-12T10:00:00Z' }],
      mine: [],
    } })
    const store = useRiderStore()
    await store.fetchReturns()
    expect(store.returnsAvailable).toHaveLength(1)
    expect(store.returnsAvailable[0]!.riderFee).toBe(4.5)
    expect(store.returnsMine).toHaveLength(0)
  })

  it('acceptReturn moves a return from available to mine', async () => {
    routeFetch({ '/rider/returns/r1/accept': { return: { id: 'r1', reference: 'RET-1', status: 'accepted', orderId: null, customerId: null, riderId: 'rider-1', pickupAddress: 'X', pickupLat: null, pickupLng: null, scheduledFor: null, riderFee: '4.5', completedAt: null, createdAt: '2026-05-12T10:00:00Z' } } })
    const store = useRiderStore()
    store.returnsAvailable = [{ id: 'r1', reference: 'RET-1', status: 'scheduled', orderId: null, customerId: null, riderId: null, pickupAddress: 'X', pickupLat: null, pickupLng: null, scheduledFor: null, riderFee: 4.5, completedAt: null, createdAt: '2026-05-12T10:00:00Z' }]
    await store.acceptReturn('r1')
    expect(store.returnsAvailable).toHaveLength(0)
    expect(store.returnsMine.map(r => r.id)).toEqual(['r1'])
    expect(store.activeReturn?.id).toBe('r1')
  })

  it('completeReturn marks the return completed', async () => {
    routeFetch({ '/rider/returns/r1/complete': { return: { id: 'r1', reference: 'RET-1', status: 'completed', orderId: null, customerId: null, riderId: 'rider-1', pickupAddress: 'X', pickupLat: null, pickupLng: null, scheduledFor: null, riderFee: '4.5', completedAt: '2026-05-12T11:00:00Z', createdAt: '2026-05-12T10:00:00Z' } } })
    const store = useRiderStore()
    store.returnsMine = [{ id: 'r1', reference: 'RET-1', status: 'accepted', orderId: null, customerId: null, riderId: 'rider-1', pickupAddress: 'X', pickupLat: null, pickupLng: null, scheduledFor: null, riderFee: 4.5, completedAt: null, createdAt: '2026-05-12T10:00:00Z' }]
    await store.completeReturn('r1')
    expect(store.returnsMine[0]!.status).toBe('completed')
    expect(store.activeReturn).toBeNull()
  })
})

// Le store ne stocke plus les notifications : il delegue a l'etat partage avec la cloche du
// header (useNotifications). On seme donc cet etat-la, pas des proprietes du store — ce sont
// desormais des getters en lecture seule.
describe('rider store — notifications', () => {
  function makeNotif(over: Record<string, unknown> = {}) {
    return {
      id: 'n1',
      userId: 'rider-1',
      type: 'new_order',
      event: 'order.created',
      channel: 'in_app',
      orderId: null,
      title: 'Nouvelle commande',
      body: '',
      read: false,
      readAt: null,
      scheduledAt: null,
      sentAt: null,
      createdAt: '2026-05-12T10:00:00Z',
      ...over,
    }
  }

  it('fetchNotifications stores list + unread count', async () => {
    routeFetch({ '/notifications?page=1&limit=20': { notifications: [
      makeNotif(),
      makeNotif({ id: 'n2', type: 'earning_credited', title: 'Gain', body: '7€', read: true }),
    ], unreadCount: 1 } })
    const store = useRiderStore()
    await store.fetchNotifications()
    expect(store.notifications).toHaveLength(2)
    expect(store.unreadCount).toBe(1)
  })

  it('markNotificationRead flips the flag, decrements the counter and calls the API', async () => {
    routeFetch({ '/notifications/n1/read': {} })
    const shared = useNotificationState()
    shared.notifications.value = [makeNotif()]
    shared.unreadCount.value = 1
    const store = useRiderStore()
    await store.markNotificationRead('n1')
    expect(store.notifications[0]!.read).toBe(true)
    expect(store.unreadCount).toBe(0)
    expect(nuxtStubState.fetch).toHaveBeenCalledWith('http://api.test/api/notifications/n1/read', expect.objectContaining({ method: 'PATCH' }))
  })

  it('markAllNotificationsRead clears everything', async () => {
    routeFetch({ '/notifications/read-all': { updated: 2 } })
    const shared = useNotificationState()
    shared.notifications.value = [makeNotif(), makeNotif({ id: 'n2', type: 'return_scheduled', title: 't2' })]
    shared.unreadCount.value = 2
    const store = useRiderStore()
    await store.markAllNotificationsRead()
    expect(store.notifications.every(n => n.read)).toBe(true)
    expect(store.unreadCount).toBe(0)
    // la cloche du header lit exactement le meme compteur
    expect(shared.unreadCount.value).toBe(0)
  })
})

describe('rider store — onboarding gate', () => {
  it('isApproved reflects the profile application status', async () => {
    routeFetch({ '/rider/profile': { profile: { id: 'rider-1', name: 'L', email: 'l@t.io', phone: '0', role: 'rider', vehicleType: 'scooter', licenseNumber: null, insuranceNumber: null, applicationStatus: 'pending', online: false, totalDeliveries: 0, createdAt: '2026-01-01' } } })
    const store = useRiderStore()
    await store.fetchProfile()
    expect(store.isApproved).toBe(false)
    store.profile!.applicationStatus = 'approved'
    expect(store.isApproved).toBe(true)
  })
})

describe('rider store — status flow constants', () => {
  it('NEXT_STATUS chains rider_assigned → at_warehouse → picked_up → in_transit → delivered', () => {
    const chain: DeliveryStatus[] = ['rider_assigned']
    let cur: DeliveryStatus | undefined = 'rider_assigned'
    while (cur && NEXT_STATUS[cur]) {
      cur = NEXT_STATUS[cur]!.next
      chain.push(cur)
    }
    expect(chain).toEqual(['rider_assigned', 'at_warehouse', 'picked_up', 'in_transit', 'delivered'])
    // a delivered order has no further action
    expect(NEXT_STATUS['delivered']).toBeUndefined()
  })

  it('requiresPickupCode exempts a delivery job with no warehouse and gates a warehouse order', () => {
    expect(requiresPickupCode({ warehouseId: 'wh-1', items: [] })).toBe(true)
    expect(requiresPickupCode({ warehouseId: null, items: [] })).toBe(false)
    // la projection livreur n'expose pas warehouseId : seules les commandes boutique ont des lignes
    expect(requiresPickupCode({ items: [{ id: 'i1', name: 'Perceuse', quantity: 1, imageUrl: null }] })).toBe(true)
    expect(requiresPickupCode({})).toBe(false)
  })

  it('advanceErrorMessage maps the two handover refusals and falls back otherwise', () => {
    const notPrepared = advanceErrorMessage({ data: { error: 'order_not_prepared' } })
    const badCode = advanceErrorMessage({ response: { _data: { error: 'invalid_pickup_code' } } })
    expect(notPrepared).toContain('préparer')
    expect(badCode).toContain('incorrect')
    expect(notPrepared).not.toBe(badCode)
    expect(advanceErrorMessage({ data: { error: 'invalid_transition' } })).toBe('Impossible de mettre à jour la livraison. Réessayez.')
    expect(advanceErrorMessage(new Error('boom'), 'Action impossible')).toBe('Action impossible')
  })

  it('DELIVERY_STATUS_LABEL covers every status used in the flow', () => {
    for (const s of ['pending_assignment', 'rider_assigned', 'at_warehouse', 'picked_up', 'in_transit', 'delivered', 'cancelled'] as DeliveryStatus[]) {
      expect(DELIVERY_STATUS_LABEL[s]).toBeTruthy()
    }
  })
})
