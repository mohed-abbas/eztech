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

// backend default page size (routes/notifications.ts:11); the API caps `limit` at 100.
export const NOTIFICATIONS_PAGE_SIZE = 20

export interface FetchNotificationsOptions {
  page?: number
  limit?: number
  unread?: boolean
  /** append to the current list instead of replacing it (« Charger plus ») */
  append?: boolean
}

export function useNotifications() {
  const { on, off } = useSocket()
  const auth = useAuthStore()

  // SHARED state (useState, not a bare ref): useNotifications() is called from both
  // NotificationBell.client.vue and pages/notifications.vue, and each call used to get its
  // own refs — so marking a row read on the page never moved the bell badge. useState is the
  // SSR-safe shared store (module-scope refs would leak between requests during SSR).
  const notifications = useState<AppNotification[]>('notifications', () => [])
  const unreadCount = useState<number>('notifications:unread', () => 0)
  // Identity that OWNS the shared rows above. useState lives for the whole app runtime, and
  // logout/login are SPA navigations (no page load), so the rows would otherwise survive an
  // account switch in the same tab: the next user would see the previous user's titles and
  // badge until their own fetch lands — and for the rest of the session if that fetch fails.
  const stateOwner = useState<string | null>('notifications:owner', () => null)
  // per-call-site UI state — the page's spinner must not be driven by the bell's fetch.
  const loading = ref(false)
  const error = ref<string | null>(null)
  // true when the last fetch filled a full page, i.e. there is probably another one.
  const hasMore = ref(false)

  function currentUserId(): string | null {
    if (import.meta.client) auth.hydrate()
    return auth.user?.id ?? null
  }

  // Drop the shared rows as soon as the logged-in identity differs from the one they were
  // fetched for (logout → null, or a same-tab account switch). Returns true when it reset.
  function syncIdentity(): boolean {
    const id = currentUserId()
    if (stateOwner.value === id) return false
    stateOwner.value = id
    notifications.value = []
    unreadCount.value = 0
    hasMore.value = false
    error.value = null
    return true
  }

  // Runs synchronously during setup: a consumer that REMOUNTS after an account switch (the app
  // bar bell is v-if'd on isAuthenticated) must not paint the previous account's rows for even
  // one frame, before its first fetch resolves.
  syncIdentity()

  async function _api<T>(path: string, opts: Record<string, unknown> = {}): Promise<T | null> {
    if (!import.meta.client) return null
    const config = useRuntimeConfig()
    auth.hydrate()
    const url = `${config.public.apiUrl}${path}`
    const csrf = useCookie('ez_csrf').value
    // credentials:'include' sends the httpOnly session cookie (works with no in-memory token);
    // the Bearer header still carries the header-path token; x-csrf-token guards unsafe methods (Phase 7).
    return await $fetch(url, {
      ...opts,
      credentials: 'include',
      headers: {
        ...(auth.token ? { Authorization: `Bearer ${auth.token}` } : {}),
        ...(csrf ? { 'x-csrf-token': csrf } : {}),
        ...(opts.headers as object ?? {}),
      },
    }) as T
  }

  // Returns the number of rows the server actually sent (0 on SSR / mock / failure), so a
  // caller can decide whether to offer another page. Zero-arg calls keep the original
  // behaviour: page 1, default page size, no unread filter, replace the list.
  async function fetchInitial(opts: FetchNotificationsOptions = {}): Promise<number> {
    if (!import.meta.client) return 0
    const { page = 1, limit = NOTIFICATIONS_PAGE_SIZE, unread = false, append = false } = opts
    // an account switch may have happened since the last call — never merge two users' rows.
    syncIdentity()
    const owner = stateOwner.value
    const { isMock } = useMock()
    if (isMock.value) {
      if (!append) notifications.value = []
      unreadCount.value = 0
      hasMore.value = false
      return 0
    }
    loading.value = true
    error.value = null
    try {
      const qs = new URLSearchParams({ page: String(page), limit: String(limit) })
      if (unread) qs.set('unread', 'true')
      const res = await _api<{ notifications: AppNotification[], unreadCount: number, page: number }>(
        `/notifications?${qs.toString()}`,
      )
      if (!res) return 0
      // the identity changed while this request was in flight → the payload belongs to the
      // previous account. Drop it rather than painting it over the new user's list.
      if (stateOwner.value !== owner) return 0
      const rows = res.notifications ?? []
      // de-dupe on append: a socket push may already have prepended a row that also
      // shows up in the next page (the offset shifts when a new row is inserted).
      notifications.value = append
        ? [...notifications.value, ...rows.filter(r => !notifications.value.some(n => n.id === r.id))]
        : rows
      unreadCount.value = res.unreadCount
      hasMore.value = rows.length === limit
      return rows.length
    }
    catch {
      error.value = 'fetch_failed'
      return 0
    }
    finally {
      loading.value = false
    }
  }

  // live push handler — prepend + bump unread; de-duped by id so a reconnect
  // replay (or a stray double-emit) never double-counts the badge.
  function onNotification(row: AppNotification) {
    // a push that lands right after an account switch must not be added to a list that still
    // belongs to the previous identity — clear first, then prepend for the current one.
    syncIdentity()
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
    const owner = stateOwner.value
    n.read = true
    unreadCount.value = Math.max(0, unreadCount.value - 1)
    const { isMock } = useMock()
    if (isMock.value) return
    try {
      await _api(`/notifications/${id}/read`, { method: 'PATCH' })
    }
    catch (e) {
      // rollback so the UI stays in sync with the server — but never resurrect a count for a
      // list that has since been reset by an account switch.
      if (stateOwner.value === owner) {
        n.read = prevRead
        unreadCount.value = prevCount
      }
      throw e
    }
  }

  async function markAllRead() {
    const prev = notifications.value.map(n => ({ id: n.id, read: n.read }))
    const prevCount = unreadCount.value
    const owner = stateOwner.value
    notifications.value.forEach((n) => { n.read = true })
    unreadCount.value = 0
    const { isMock } = useMock()
    if (isMock.value) return
    try {
      await _api('/notifications/read-all', { method: 'PATCH' })
    }
    catch (e) {
      if (stateOwner.value === owner) {
        const snap = new Map(prev.map(p => [p.id, p.read]))
        notifications.value.forEach((n) => { const r = snap.get(n.id); if (r !== undefined) n.read = r })
        unreadCount.value = prevCount
      }
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
    // The app bar bell can stay mounted across a same-tab account switch (SPA navigation, no
    // page load), so setup alone is not enough: watch the identity and wipe the shared rows the
    // moment it moves, then reload for whoever is logged in now. Scoped to the component, so it
    // is disposed on unmount like the socket subscription above.
    watch(() => auth.user?.id ?? null, (id) => {
      if (!syncIdentity()) return
      if (id && import.meta.client) void fetchInitial()
    })
  }

  return {
    notifications,
    unreadCount,
    loading,
    error,
    hasMore,
    fetchInitial,
    markRead,
    markAllRead,
    // exposed for tests / manual wiring without relying on the lifecycle hook
    _subscribe: subscribe,
    _cleanup: cleanup,
    _onNotification: onNotification,
  }
}
