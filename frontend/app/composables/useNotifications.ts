import { getCurrentInstance } from 'vue'

// ─── Notification bell composable (NOTIF-04) ───────────────────────────────
// Reuses the Phase 5 singleton socket (useSocket) — NEVER opens a second
// connection. The server auto-joins every authenticated socket to its own
// `user:<sub>` room on connect, so no client `emit('subscribe')` is needed
// here (mirrors useOrderTracking's subscribe/cleanup lifecycle shape).

export interface AppNotification {
  id: string
  userId: string
  type: string
  event: string
  channel: string
  orderId: string | null
  title: string
  body: string
  read: boolean
  readAt: string | null
  scheduledAt: string | null
  sentAt: string | null
  createdAt: string
}

// icon per NotificationType (backend prisma enum) — falls back to a generic
// bell for any value not yet mapped so an unknown future type never crashes.
const NOTIFICATION_ICON: Record<string, string> = {
  new_order: 'ph:package',
  return_scheduled: 'ph:arrow-u-down-left',
  earning_credited: 'ph:currency-eur',
  order_confirmed: 'ph:check-circle',
  rider_assigned: 'ph:bicycle',
  order_picked_up: 'ph:package',
  order_delivered: 'ph:house-line',
  return_reminder: 'ph:bell-ringing',
  low_stock: 'ph:warning',
}

export function notificationIcon(type: string): string {
  return NOTIFICATION_ICON[type] ?? 'ph:bell'
}

export function useNotifications() {
  const { on, off } = useSocket()
  const auth = useAuthStore()

  const notifications = ref<AppNotification[]>([])
  const unreadCount = ref(0)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function _api<T>(path: string, opts: Record<string, unknown> = {}): Promise<T | null> {
    if (!import.meta.client) return null
    const config = useRuntimeConfig()
    auth.hydrate()
    const url = `${config.public.apiUrl}${path}`
    return await $fetch(url, {
      ...opts,
      headers: { Authorization: `Bearer ${auth.token ?? ''}`, ...(opts.headers as object ?? {}) },
    }) as T
  }

  async function fetchInitial() {
    if (!import.meta.client) return
    const { isMock } = useMock()
    if (isMock.value) {
      notifications.value = []
      unreadCount.value = 0
      return
    }
    loading.value = true
    error.value = null
    try {
      const res = await _api<{ notifications: AppNotification[], unreadCount: number }>('/notifications')
      if (res) {
        notifications.value = res.notifications
        unreadCount.value = res.unreadCount
      }
    }
    catch {
      error.value = 'fetch_failed'
    }
    finally {
      loading.value = false
    }
  }

  // live push handler — prepend + bump unread; de-duped by id so a reconnect
  // replay (or a stray double-emit) never double-counts the badge.
  function onNotification(row: AppNotification) {
    if (!row?.id || notifications.value.some(n => n.id === row.id)) return
    notifications.value = [row, ...notifications.value]
    if (!row.read) unreadCount.value += 1
  }

  function subscribe() {
    on('notification:new', onNotification as (...args: never[]) => void)
  }

  function cleanup() {
    off('notification:new', onNotification as (...args: never[]) => void)
  }

  async function markRead(id: string) {
    const n = notifications.value.find(x => x.id === id)
    if (!n || n.read) return
    const prevRead = n.read
    const prevCount = unreadCount.value
    n.read = true
    unreadCount.value = Math.max(0, unreadCount.value - 1)
    const { isMock } = useMock()
    if (isMock.value) return
    try {
      await _api(`/notifications/${id}/read`, { method: 'PATCH' })
    }
    catch (e) {
      // rollback so the UI stays in sync with the server
      n.read = prevRead
      unreadCount.value = prevCount
      throw e
    }
  }

  async function markAllRead() {
    const prev = notifications.value.map(n => ({ id: n.id, read: n.read }))
    const prevCount = unreadCount.value
    notifications.value.forEach((n) => { n.read = true })
    unreadCount.value = 0
    const { isMock } = useMock()
    if (isMock.value) return
    try {
      await _api('/notifications/read-all', { method: 'PATCH' })
    }
    catch (e) {
      const snap = new Map(prev.map(p => [p.id, p.read]))
      notifications.value.forEach((n) => { const r = snap.get(n.id); if (r !== undefined) n.read = r })
      unreadCount.value = prevCount
      throw e
    }
  }

  // wire up on mount, tear down on unmount (client-only; SSR has no socket).
  // Only register lifecycle hooks when called inside a component setup — keeps
  // the composable directly testable outside a component instance.
  if (getCurrentInstance()) {
    onMounted(() => {
      if (!import.meta.client) return
      subscribe()
      fetchInitial()
    })
    onBeforeUnmount(cleanup)
  }

  return {
    notifications,
    unreadCount,
    loading,
    error,
    fetchInitial,
    markRead,
    markAllRead,
    // exposed for tests / manual wiring without relying on the lifecycle hook
    _subscribe: subscribe,
    _cleanup: cleanup,
    _onNotification: onNotification,
  }
}
