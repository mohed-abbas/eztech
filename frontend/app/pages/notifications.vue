<script setup lang="ts">
import type { AppNotification } from '~/composables/useNotifications'
import { NOTIFICATIONS_PAGE_SIZE } from '~/composables/useNotifications'

definePageMeta({
  layout: 'default',
  middleware: 'auth',
})

useHead({ title: 'Notifications - EzTech' })

const {
  notifications,
  unreadCount,
  loading,
  error,
  hasMore,
  fetchInitial,
  markRead,
  markAllRead,
} = useNotifications()

// useNotifications() is client-guarded end to end (`if (!import.meta.client) return`), so the
// SSR pass renders the skeleton rather than an empty list. `mounted` flips once the client
// takes over; the composable's own onMounted hook has already kicked off the page-1 fetch by
// then (it runs first — it was registered first, during setup).
const mounted = ref(false)
const page = ref(1)
const onlyUnread = ref(false)
const loadingMore = ref(false)
const actionError = ref<string | null>(null)

onMounted(() => {
  mounted.value = true
})

const showSkeleton = computed(() => !mounted.value || (loading.value && !loadingMore.value))
const isEmpty = computed(() => mounted.value && !loading.value && !error.value && notifications.value.length === 0)

const filters: { key: 'all' | 'unread', label: string }[] = [
  { key: 'all', label: 'Toutes' },
  { key: 'unread', label: 'Non lues' },
]

async function reload() {
  actionError.value = null
  page.value = 1
  await fetchInitial({ page: 1, limit: NOTIFICATIONS_PAGE_SIZE, unread: onlyUnread.value })
}

async function selectFilter(key: 'all' | 'unread') {
  if (onlyUnread.value === (key === 'unread')) return
  onlyUnread.value = key === 'unread'
  await reload()
}

async function loadMore() {
  if (loadingMore.value) return
  loadingMore.value = true
  actionError.value = null
  try {
    const next = page.value + 1
    const received = await fetchInitial({
      page: next,
      limit: NOTIFICATIONS_PAGE_SIZE,
      unread: onlyUnread.value,
      append: true,
    })
    if (received > 0) page.value = next
  }
  finally {
    loadingMore.value = false
  }
}

// markRead/markAllRead update optimistically and roll back + rethrow on failure — surface
// the rejection instead of swallowing it, otherwise the UI silently lies about the state.
async function open(n: AppNotification) {
  actionError.value = null
  try {
    await markRead(n.id)
  }
  catch {
    actionError.value = 'Impossible de marquer cette notification comme lue.'
    return
  }
  if (n.orderId) await navigateTo(`/orders/${n.orderId}`)
}

async function markOne(n: AppNotification) {
  actionError.value = null
  try {
    await markRead(n.id)
  }
  catch {
    actionError.value = 'Impossible de marquer cette notification comme lue.'
  }
}

async function markAll() {
  actionError.value = null
  try {
    await markAllRead()
  }
  catch {
    actionError.value = 'Impossible de tout marquer comme lu.'
  }
}

const ABSOLUTE: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
}

function fmtAbsolute(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', ABSOLUTE)
}

// Relative label for the last 24 h, absolute date beyond. Rendered client-side only
// (the list is empty during SSR), so there is no hydration mismatch on `Date.now()`.
function fmtRelative(iso: string): string {
  const ts = new Date(iso).getTime()
  if (Number.isNaN(ts)) return ''
  const diffMin = Math.round((Date.now() - ts) / 60000)
  if (diffMin < 1) return 'À l\'instant'
  if (diffMin < 60) return `Il y a ${diffMin} min`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `Il y a ${diffH} h`
  if (diffH < 48) return 'Hier'
  return fmtAbsolute(iso)
}
</script>

<template>
  <div class="min-h-screen bg-background">
    <!-- Hero Header -->
    <div class="relative overflow-hidden bg-section-dark px-6 py-12 sm:px-10 sm:py-16">
      <div class="pointer-events-none absolute -right-20 -top-20 size-80 rounded-full bg-primary-500/15 blur-3xl" />
      <div class="pointer-events-none absolute -bottom-10 -left-10 size-64 rounded-full bg-primary-400/10 blur-2xl" />

      <div class="relative mx-auto max-w-3xl">
        <NuxtLink
          to="/products"
          class="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-body-sm font-medium text-neutral-300 backdrop-blur-sm transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400/50"
        >
          <Icon name="ph:arrow-left" class="size-4" />
          Retour au catalogue
        </NuxtLink>

        <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 class="flex flex-wrap items-center gap-x-3 gap-y-2 text-h1 font-semibold text-white">
              Notifications
              <Badge
                v-if="unreadCount > 0"
                class="border-0 bg-primary-500 px-2.5 text-white"
              >
                {{ unreadCount > 99 ? '99+' : unreadCount }} non lue{{ unreadCount > 1 ? 's' : '' }}
              </Badge>
            </h1>
            <p class="mt-2 text-body text-neutral-400">
              Suivez vos commandes, vos retours et vos livraisons
            </p>
          </div>

          <Button
            variant="glass"
            size="pill-sm"
            :disabled="unreadCount === 0"
            class="self-start normal-case sm:self-auto"
            @click="markAll()"
          >
            <Icon name="ph:checks" class="size-4" />
            Tout marquer comme lu
          </Button>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="mx-auto max-w-3xl px-6 py-10 sm:px-10">
      <!-- Filters -->
      <div class="mb-6 flex items-center gap-2">
        <button
          v-for="f in filters"
          :key="f.key"
          type="button"
          class="shrink-0 rounded-full px-4 py-2 text-body-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400/40"
          :class="onlyUnread === (f.key === 'unread')
            ? 'bg-primary-600 text-white'
            : 'bg-white text-text-secondary border border-neutral-200 hover:bg-neutral-50'"
          :aria-pressed="onlyUnread === (f.key === 'unread')"
          @click="selectFilter(f.key)"
        >
          {{ f.label }}
          <span v-if="f.key === 'unread' && unreadCount > 0"> ({{ unreadCount }})</span>
        </button>
      </div>

      <!-- Mutation error (mark-read rollback) -->
      <div
        v-if="actionError"
        class="mb-4 flex items-center gap-2 rounded-xl border border-error/20 bg-error/5 px-4 py-3 text-body-sm text-error"
        role="alert"
      >
        <Icon name="ph:warning-circle" class="size-5 shrink-0" />
        {{ actionError }}
      </div>

      <!-- Loading skeleton -->
      <div v-if="showSkeleton" class="space-y-3">
        <div
          v-for="n in 5"
          :key="n"
          class="animate-pulse rounded-2xl border border-neutral-200 bg-white p-5"
        >
          <div class="flex items-start gap-4">
            <div class="size-11 shrink-0 rounded-xl bg-neutral-100" />
            <div class="flex-1 space-y-2">
              <div class="h-4 w-1/3 rounded bg-neutral-100" />
              <div class="h-3 w-2/3 rounded bg-neutral-100" />
              <div class="h-3 w-24 rounded bg-neutral-100" />
            </div>
          </div>
        </div>
      </div>

      <!-- Error -->
      <div
        v-else-if="error"
        class="rounded-2xl border border-neutral-200 bg-white p-12 text-center"
      >
        <Icon name="ph:wifi-slash" class="mx-auto size-10 text-neutral-300" />
        <p class="mt-3 text-body font-medium text-text-primary">
          Impossible de charger vos notifications
        </p>
        <p class="mt-1 text-body-sm text-text-muted">
          Vérifiez votre connexion puis réessayez.
        </p>
        <Button variant="outline" size="sm" class="mt-4" @click="reload()">
          Réessayer
        </Button>
      </div>

      <!-- Empty -->
      <EmptyState
        v-else-if="isEmpty"
        :title="onlyUnread ? 'Aucune notification non lue' : 'Aucune notification'"
        :description="onlyUnread
          ? 'Vous êtes à jour : tout a été lu.'
          : 'Vous serez prévenu ici dès qu\'une commande, une livraison ou un retour évolue.'"
      >
        <template #icon>
          <Icon name="ph:bell-slash" class="size-10 text-primary-500" />
        </template>
        <template #actions>
          <Button v-if="onlyUnread" variant="outline" size="pill-sm" @click="selectFilter('all')">
            Voir toutes les notifications
          </Button>
          <NuxtLink v-else to="/orders">
            <Button variant="gradient" size="pill-sm" class="font-semibold">
              <Icon name="ph:receipt" class="size-4" />
              Mes commandes
            </Button>
          </NuxtLink>
        </template>
      </EmptyState>

      <!-- List -->
      <template v-else>
        <ul class="space-y-3">
          <li
            v-for="n in notifications"
            :key="n.id"
            class="flex flex-col gap-2 rounded-2xl border p-4 shadow-sm transition-colors sm:flex-row sm:items-start sm:gap-3 sm:p-5"
            :class="n.read
              ? 'border-neutral-200 bg-white'
              : 'border-primary-200 border-l-4 border-l-primary-500 bg-surface-purple'"
          >
            <button
              type="button"
              class="flex min-w-0 flex-1 items-start gap-4 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400/40"
              @click="open(n)"
            >
              <span
                class="flex size-11 shrink-0 items-center justify-center rounded-xl"
                :class="n.read ? 'bg-neutral-100' : 'bg-primary-100'"
              >
                <Icon
                  :name="notificationIcon(n.type)"
                  class="size-5"
                  :class="n.read ? 'text-neutral-400' : 'text-primary-600'"
                />
              </span>
              <span class="min-w-0 flex-1">
                <span class="flex items-center gap-2">
                  <span class="text-body font-semibold text-text-primary">{{ n.title }}</span>
                  <span v-if="!n.read" class="size-2 shrink-0 rounded-full bg-primary-500" aria-hidden="true" />
                  <span v-if="!n.read" class="sr-only">Non lue</span>
                </span>
                <span v-if="n.body" class="mt-1 block text-body-sm text-text-secondary">{{ n.body }}</span>
                <span class="mt-1 block text-caption text-text-muted" :title="fmtAbsolute(n.createdAt)">
                  {{ fmtRelative(n.createdAt) }}
                </span>
                <span v-if="n.orderId" class="mt-1 inline-flex items-center gap-1 text-caption font-medium text-primary-600">
                  <Icon name="ph:arrow-right" class="size-3.5" />
                  Voir la commande
                </span>
              </span>
            </button>

            <Button
              v-if="!n.read"
              variant="ghost"
              size="sm"
              class="shrink-0 self-start text-primary-600 max-sm:ml-15 max-sm:px-0"
              :aria-label="`Marquer « ${n.title} » comme lu`"
              @click="markOne(n)"
            >
              Marquer comme lu
            </Button>
          </li>
        </ul>

        <div v-if="hasMore" class="mt-6 text-center">
          <Button variant="outline" size="pill-sm" :disabled="loadingMore" @click="loadMore()">
            <Icon v-if="loadingMore" name="ph:circle-notch" class="size-4 animate-spin" />
            {{ loadingMore ? 'Chargement...' : 'Charger plus' }}
          </Button>
        </div>
      </template>
    </div>
  </div>
</template>
