import { describe, it, expect, beforeEach, vi } from 'vitest'
import './setup'
import { useOrderTracking } from '~/composables/useOrderTracking'

// ─── TRACK-07 / Pitfall A unit ─────────────────────────────────────────────
// Plain Vitest on the composable via the existing tests/setup.ts stub harness
// (Vitest 3.2.4 + happy-dom + the Nuxt auto-import stubs) — NOT @nuxt/test-utils.
// We stub useSocket() on globalThis with a fake emit/on that captures handlers so a
// test can later drive the order-status handler, plus reactive connected/reconnecting refs.

type Handler = (...args: never[]) => void

interface FakeSocket {
  handlers: Map<string, Handler>
  emitted: Array<{ event: string, args: unknown[] }>
}

let fake: FakeSocket

function installFakeSocket() {
  const handlers = new Map<string, Handler>()
  const emitted: Array<{ event: string, args: unknown[] }> = []
  fake = { handlers, emitted }

  const g = globalThis as Record<string, unknown>
  g.useSocket = () => ({
    socket: null,
    connected: ref(true),
    reconnecting: ref(false),
    emit: (event: string, ...args: unknown[]) => { emitted.push({ event, args }) },
    on: (event: string, handler: Handler) => { handlers.set(event, handler) },
    off: (event: string) => { handlers.delete(event) },
  })
}

beforeEach(() => {
  installFakeSocket()
  // ensure onMounted/onBeforeUnmount don't error when called outside a component
  vi.restoreAllMocks()
})

describe('useOrderTracking', () => {
  it('showMap is true for live status picked_up', () => {
    const t = useOrderTracking('order-1', { id: 'order-1', status: 'picked_up' })
    expect(t.showMap.value).toBe(true)
    expect(t.isActive.value).toBe(true)
  })

  it('showMap is true for live status in_transit', () => {
    const t = useOrderTracking('order-1', { id: 'order-1', status: 'in_transit' })
    expect(t.showMap.value).toBe(true)
  })

  it('showMap is false for live status delivered', () => {
    const t = useOrderTracking('order-1', { id: 'order-1', status: 'delivered' })
    expect(t.showMap.value).toBe(false)
  })

  it('showMap is false for non-transit live statuses', () => {
    for (const status of ['pending_assignment', 'at_warehouse', 'awaiting_payment']) {
      const t = useOrderTracking('order-1', { id: 'order-1', status })
      expect(t.showMap.value).toBe(false)
    }
  })

  it('driving the full live Prisma vocabulary never throws (Pitfall A)', () => {
    const liveVocab = ['awaiting_payment', 'pending_assignment', 'at_warehouse']
    for (const status of liveVocab) {
      expect(() => {
        const t = useOrderTracking('order-1', { id: 'order-1', status })
        // drive an order-status event to the same live value
        t._onOrderStatus({ orderId: 'order-1', status })
        // touch the gate — must resolve, never throw a STATUS_CONFIG-style lookup
        void t.showMap.value
      }).not.toThrow()
    }
  })

  it('tracking active states', () => {
    // subscribe so the order-status handler is registered (as it is on mount)
    const t = useOrderTracking('order-1', { id: 'order-1', status: 'in_transit' })
    t._subscribe()
    expect(t.showMap.value).toBe(true)

    // the captured order-status handler flips in_transit → delivered
    const handler = fake.handlers.get('order-status')
    expect(handler).toBeTypeOf('function')
    handler!({ orderId: 'order-1', status: 'delivered' } as never)

    expect(t.showMap.value).toBe(false)
  })
})
