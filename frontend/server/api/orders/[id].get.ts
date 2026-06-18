import mockOrders from '../../../app/data/mock/orders.json'
import type { BackendOrderStatus } from '../../../app/lib/orderStatus'

// Single owner-scoped order for the live tracking page (Pitfall A): unlike the list BFF
// (server/api/orders.ts) this route preserves the RAW Prisma OrderStatus so the tracking
// page drives its status/steps off the canonical backend vocabulary — never the divergent
// frontend mock enum that would throw a STATUS_CONFIG-style lookup.

interface ApiOrderItem {
  productId: string | null
  name: string
  quantity: number
  durationUnit: 'flat' | 'hourly' | 'daily' | 'weekly'
  durationValue: number
  unitPrice: string
  lineTotal: string
}

interface ApiOrderEvent {
  id: string
  orderId: string
  status: string
  note: string | null
  createdAt: string
}

interface ApiOrder {
  id: string
  status: string
  customerId: string | null
  riderId: string | null
  warehouseId: string | null
  pickupAddress?: string | null
  pickupLat?: number | null
  pickupLng?: number | null
  dropoffAddress: string
  dropoffLat: number | null
  dropoffLng: number | null
  subtotal: string | null
  deliveryFee: string | null
  total: string | null
  createdAt: string
  estimatedDelivery?: string | null
  deliveredAt: string | null
  returnDue?: string | null
  reference?: string | null
  items?: ApiOrderItem[]
  events?: ApiOrderEvent[]
}

// the live-tracking shape the page renders — status is the RAW Prisma vocabulary
export interface TrackingOrder {
  id: string
  reference: string | null
  status: BackendOrderStatus
  customerId: string | null
  riderId: string | null
  warehouseId: string | null
  pickupAddress: string | null
  pickup: { lat: number, lng: number } | null
  deliveryAddress: { street: string, city: string, zipCode: string }
  dropoff: { lat: number, lng: number } | null
  items: Array<{ productId: string, name: string, quantity: number, unitPrice: number, total: number }>
  subtotal: number
  deliveryFee: number
  total: number
  createdAt: string
  estimatedDelivery: string | null
  deliveredAt: string | null
  events: Array<{ status: string, note: string | null, createdAt: string }>
}

// reverse-map the mock display enum back onto the Prisma vocabulary so mock mode renders
// through the same Prisma-keyed status config the live path uses.
const DISPLAY_TO_BACKEND: Record<string, BackendOrderStatus> = {
  pending: 'awaiting_payment',
  confirmed: 'pending_assignment',
  preparing: 'at_warehouse',
  rider_assigned: 'rider_assigned',
  picked_up: 'picked_up',
  in_transit: 'in_transit',
  delivered: 'delivered',
  returned: 'delivered',
  cancelled: 'cancelled',
}

function remap(o: ApiOrder): TrackingOrder {
  return {
    id: o.id,
    reference: o.reference ?? null,
    status: o.status as BackendOrderStatus,
    customerId: o.customerId ?? null,
    riderId: o.riderId,
    warehouseId: o.warehouseId ?? null,
    pickupAddress: o.pickupAddress ?? null,
    pickup: o.pickupLat != null && o.pickupLng != null ? { lat: o.pickupLat, lng: o.pickupLng } : null,
    deliveryAddress: { street: o.dropoffAddress, city: '', zipCode: '' },
    dropoff: o.dropoffLat != null && o.dropoffLng != null ? { lat: o.dropoffLat, lng: o.dropoffLng } : null,
    items: (o.items ?? []).map(i => ({
      productId: i.productId ?? '',
      name: i.name,
      quantity: i.quantity,
      unitPrice: Number(i.unitPrice),
      total: Number(i.lineTotal),
    })),
    subtotal: Number(o.subtotal ?? 0),
    deliveryFee: Number(o.deliveryFee ?? 0),
    total: Number(o.total ?? 0),
    createdAt: o.createdAt,
    estimatedDelivery: o.estimatedDelivery ?? null,
    deliveredAt: o.deliveredAt ?? null,
    events: (o.events ?? []).map(e => ({ status: e.status, note: e.note, createdAt: e.createdAt })),
  }
}

// a valid id is a uuid or the local ord_* form — reject anything else so it can never be
// interpolated into the upstream request path (SSRF / path injection guard)
const ID_RE = /^[\w-]{1,50}$/

function fromMock(id: string): TrackingOrder | null {
  const found = (mockOrders as unknown as Array<Record<string, unknown>>).find(o => o['id'] === id)
  if (!found) return null
  const items = (found['items'] as Array<Record<string, unknown>> | undefined) ?? []
  return {
    id: String(found['id']),
    reference: null,
    status: DISPLAY_TO_BACKEND[String(found['status'])] ?? 'pending_assignment',
    customerId: (found['userId'] as string) ?? null,
    riderId: (found['riderId'] as string | null) ?? null,
    warehouseId: (found['warehouseId'] as string) ?? null,
    pickupAddress: null,
    pickup: null,
    deliveryAddress: {
      street: String((found['deliveryAddress'] as Record<string, unknown>)?.['street'] ?? ''),
      city: String((found['deliveryAddress'] as Record<string, unknown>)?.['city'] ?? ''),
      zipCode: String((found['deliveryAddress'] as Record<string, unknown>)?.['zipCode'] ?? ''),
    },
    dropoff: (found['deliveryAddress'] as Record<string, unknown>)?.['coordinates'] as { lat: number, lng: number } | null ?? null,
    items: items.map(i => ({
      productId: String(i['productId'] ?? ''),
      name: String(i['name'] ?? i['productId'] ?? ''),
      quantity: Number(i['quantity'] ?? 1),
      unitPrice: Number(i['unitPrice'] ?? 0),
      total: Number(i['total'] ?? 0),
    })),
    subtotal: Number(found['subtotal'] ?? 0),
    deliveryFee: Number(found['deliveryFee'] ?? 0),
    total: Number(found['total'] ?? 0),
    createdAt: String(found['createdAt'] ?? new Date().toISOString()),
    estimatedDelivery: (found['estimatedDelivery'] as string | null) ?? null,
    deliveredAt: (found['deliveredAt'] as string | null) ?? null,
    events: [],
  }
}

function notFound() {
  return createError({ statusCode: 404, statusMessage: 'order_not_found' })
}

export default defineEventHandler(async (event): Promise<TrackingOrder> => {
  const id = getRouterParam(event, 'id')
  const config = useRuntimeConfig()

  if (!id || !ID_RE.test(id)) throw notFound()

  if (config.public.useMock) {
    const mock = fromMock(id)
    if (!mock) throw notFound()
    return mock
  }

  // forward the caller's bearer token so the backend scopes the order to the owner/rider/admin
  const auth = getRequestHeader(event, 'authorization')
  try {
    const res = await $fetch<{ order: ApiOrder }>(`${config.apiUrl}/orders/${encodeURIComponent(id)}`, {
      headers: auth ? { authorization: auth } : {},
    })
    return remap(res.order)
  }
  catch (err: unknown) {
    const e = err as { statusCode?: number, response?: { status?: number } }
    const status = e.statusCode ?? e.response?.status ?? 502
    if (status === 404) throw notFound()
    console.error('[orders BFF] /orders/:id backend fetch failed:', err)
    throw createError({ statusCode: status, statusMessage: 'order_fetch_failed' })
  }
})
