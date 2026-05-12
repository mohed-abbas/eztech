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
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold text-text-primary">Notifications</h1>
      <Button v-if="rider.unreadCount > 0" variant="outline" size="sm" @click="rider.markAllNotificationsRead()">Tout marquer comme lu</Button>
    </div>

    <Card v-if="rider.notifications.length === 0">
      <CardContent class="py-10 text-center text-text-muted">
        <Icon name="ph:bell-slash" class="mx-auto mb-3 size-10" />
        <p>Aucune notification.</p>
      </CardContent>
    </Card>

    <ul v-else class="space-y-2">
      <li
        v-for="n in rider.notifications"
        :key="n.id"
        class="flex items-start gap-3 rounded-lg border border-border p-3"
        :class="n.read ? 'bg-transparent' : 'bg-brand/5'"
      >
        <Icon :name="NOTIFICATION_ICON[n.type]" class="mt-0.5 size-5 text-brand" />
        <div class="min-w-0 flex-1">
          <p class="font-medium text-text-primary">{{ n.title }}</p>
          <p v-if="n.body" class="text-sm text-text-muted">{{ n.body }}</p>
          <p class="mt-0.5 text-xs text-text-muted">{{ fmt(n.createdAt) }}</p>
        </div>
        <button v-if="!n.read" class="shrink-0 text-xs text-brand hover:underline" @click="rider.markNotificationRead(n.id)">Marquer lu</button>
      </li>
    </ul>
  </div>
</template>
