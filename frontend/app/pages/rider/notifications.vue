<script setup lang="ts">
definePageMeta({ layout: 'default', middleware: 'auth' })
useHead({ title: 'Notifications - EzTech' })

const auth = useAuthStore()
const rider = useRiderStore()

onMounted(async () => {
  auth.hydrate()
  if (auth.role !== 'rider') return navigateTo('/products')
  await rider.fetchNotifications()
})

// markNotificationRead/markAllNotificationsRead annulent leur mise a jour optimiste puis
// relancent l'erreur : sans handler la ligne redevenait « non lue » sans rien dire, et la
// promesse partait en rejet non gere.
const actionError = ref<string | null>(null)

async function markOne(id: string) {
  actionError.value = null
  try { await rider.markNotificationRead(id) }
  catch { actionError.value = 'Impossible de marquer cette notification comme lue.' }
}

async function markAll() {
  actionError.value = null
  try { await rider.markAllNotificationsRead() }
  catch { actionError.value = 'Impossible de tout marquer comme lu.' }
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-8 space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-h2 font-bold text-text-primary">Notifications</h1>
        <p v-if="rider.notifications.length" class="text-body-sm text-text-muted">
          {{ rider.unreadCount > 0
            ? `${rider.unreadCount} non lue${rider.unreadCount > 1 ? 's' : ''}`
            : 'Vous êtes à jour' }}
        </p>
      </div>
      <Button v-if="rider.unreadCount > 0" variant="outline" size="sm" @click="markAll">
        <Icon name="ph:checks" class="mr-2 size-4" />
        Tout marquer comme lu
      </Button>
    </div>

    <ErrorState v-if="actionError" variant="inline" :title="actionError" />

    <EmptyState
      v-if="rider.notifications.length === 0"
      title="Aucune notification."
      description="Vous serez prévenu ici dès qu'une course ou un retour vous est proposé."
    >
      <template #icon>
        <Icon name="ph:bell-slash" class="size-10 text-primary-500" />
      </template>
    </EmptyState>

    <ul v-else class="space-y-3">
      <li
        v-for="n in rider.notifications"
        :key="n.id"
        class="flex items-start gap-3 rounded-2xl border p-4 shadow-sm"
        :class="n.read ? 'border-neutral-200 bg-white' : 'border-primary-200 bg-primary-50'"
      >
        <span
          class="flex size-9 shrink-0 items-center justify-center rounded-lg"
          :class="n.read ? 'bg-neutral-100 text-text-muted' : 'bg-primary-100 text-primary-600'"
        >
          <Icon :name="notificationIcon(n.type)" class="size-5" />
        </span>
        <div class="min-w-0 flex-1 space-y-1">
          <p class="font-medium text-text-primary">{{ n.title }}</p>
          <p v-if="n.body" class="text-body-sm text-text-muted">{{ n.body }}</p>
          <p class="text-caption text-text-muted">{{ fmt(n.createdAt) }}</p>
        </div>
        <Button
          v-if="!n.read"
          variant="ghost"
          size="sm"
          class="shrink-0 text-primary-600"
          :aria-label="`Marquer « ${n.title} » comme lu`"
          @click="markOne(n.id)"
        >
          Marquer lu
        </Button>
      </li>
    </ul>
  </div>
</template>
