<script setup lang="ts">
import { NOTIFICATION_ICON } from '~/stores/rider'

definePageMeta({ layout: 'default', middleware: 'auth' })
useHead({ title: 'Notifications - EzTech' })

const auth = useAuthStore()
const rider = useRiderStore()

onMounted(async () => {
  auth.hydrate()
  if (auth.role !== 'rider') return navigateTo('/products')
  await rider.fetchNotifications()
})

function fmt(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="mx-auto max-w-2xl px-4 py-8 space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h1 class="text-h2 font-bold text-text-primary">Notifications</h1>
      <Button v-if="rider.unreadCount > 0" variant="outline" size="sm" @click="rider.markAllNotificationsRead()">Tout marquer comme lu</Button>
    </div>

    <EmptyState
      v-if="rider.notifications.length === 0"
      title="Aucune notification."
      description="Vous serez prévenu ici dès qu'une course ou un retour vous est proposé."
    >
      <template #icon>
        <Icon name="ph:bell-slash" class="size-10 text-primary-500" />
      </template>
    </EmptyState>

    <ul v-else class="space-y-2">
      <li
        v-for="n in rider.notifications"
        :key="n.id"
        class="flex items-start gap-3 rounded-lg border border-border p-3"
        :class="n.read ? 'bg-transparent' : 'bg-primary-50'"
      >
        <Icon :name="NOTIFICATION_ICON[n.type]" class="mt-0.5 size-5 text-primary-600" />
        <div class="min-w-0 flex-1">
          <p class="font-medium text-text-primary">{{ n.title }}</p>
          <p v-if="n.body" class="text-body-sm text-text-muted">{{ n.body }}</p>
          <p class="mt-0.5 text-caption text-text-muted">{{ fmt(n.createdAt) }}</p>
        </div>
        <button
          v-if="!n.read"
          class="shrink-0 rounded-sm text-caption text-primary-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400/50 focus-visible:ring-offset-2"
          @click="rider.markNotificationRead(n.id)"
        >
          Marquer lu
        </button>
      </li>
    </ul>
  </div>
</template>
