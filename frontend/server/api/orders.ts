import mockOrders from '../../app/data/mock/orders.json'
import { mapOrderStatus } from '../../app/lib/orderStatus'

// backend Order shape (Decimal columns serialize as strings; status is the canonical backend enum)
interface ApiOrderItem {
  productId: string | null
  name: string
  quantity: number
  durationUnit: 'flat' | 'hourly' | 'daily' | 'weekly'
  durationValue: number
  unitPrice: string
  lineTotal: string
}

interface ApiOrder {
  id: string
  status: string
  customerId: string | null
  riderId: string | null
  warehouseId: string | null
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
  items?: ApiOrderItem[]
}

function fromMock() {
  return mockOrders
}

// map a backend Order onto the frontend Order shape the orders pages already render
function remap(o: ApiOrder) {
  return {
    id: o.id,
    userId: o.customerId ?? 'guest',
    items: (o.items ?? []).map((i) => ({
      productId: i.productId ?? '',
      quantity: i.quantity,
      duration: { type: i.durationUnit, value: i.durationValue },
      unitPrice: Number(i.unitPrice),
      total: Number(i.lineTotal),
    })),
    status: mapOrderStatus(o.status),
    deliveryAddress: {
      street: o.dropoffAddress,
      city: '',
      zipCode: '',
      coordinates:
        o.dropoffLat != null && o.dropoffLng != null
          ? { lat: o.dropoffLat, lng: o.dropoffLng }
          : undefined,
    },
    warehouseId: o.warehouseId ?? '',
    riderId: o.riderId,
    subtotal: Number(o.subtotal ?? 0),
    deliveryFee: Number(o.deliveryFee ?? 0),
    total: Number(o.total ?? 0),
    createdAt: o.createdAt,
    estimatedDelivery: o.estimatedDelivery ?? null,
    deliveredAt: o.deliveredAt ?? null,
    returnDue: o.returnDue ?? null,
  }
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  if (config.public.useMock) return fromMock()

  // forward the caller's bearer token so the backend scopes orders to the user
  const auth = getRequestHeader(event, 'authorization')

  try {
    const res = await $fetch<{ orders: ApiOrder[] }>(`${config.apiUrl}/orders`, {
      headers: auth ? { authorization: auth } : {},
    })
    return res.orders.map(remap)
  }
  catch (err) {
    // backend unreachable — degrade to local data rather than breaking the orders page, but surface it
    console.error('[orders BFF] /orders backend fetch failed, serving mock data:', err)
    return fromMock()
  }
})
