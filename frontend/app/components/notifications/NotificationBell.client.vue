<script setup lang="ts">
// Client-only bell (.client suffix mandatory — SSR must never open a socket,
// see Phase 6 threat T-06-22). Reuses the Phase 5 socket singleton through
// useNotifications() — never opens a second connection.
import type { AppNotification } from '~/composables/useNotifications'

const { notifications, unreadCount, markRead, markAllRead } = useNotifications()

const badgeLabel = computed(() => (unreadCount.value > 99 ? '99+' : String(unreadCount.value)))

function fmt(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

async function handleSelect(n: AppNotification) {
  await markRead(n.id)
  if (n.orderId) await navigateTo(`/orders/${n.orderId}`)
}
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger
      class="relative flex items-center justify-center size-10 rounded-lg text-neutral-500 transition-colors hover:bg-neutral-50 hover:text-neutral-900"
      aria-label="Notifications"
    >
      <Icon name="ph:bell" class="size-5" />
      <Badge
        v-if="unreadCount > 0"
        class="absolute -top-0.5 -right-0.5 h-5 min-w-5 justify-center border-0 bg-primary-500 px-1 text-white"
      >
        {{ badgeLabel }}
      </Badge>
    </DropdownMenuTrigger>

    <DropdownMenuContent align="end" class="w-80 p-0">
      <div class="flex items-center justify-between px-3 py-2.5">
        <span class="text-sm font-semibold text-neutral-900">Notifications</span>
        <button
          v-if="unreadCount > 0"
          type="button"
          class="text-xs font-medium text-primary-600 hover:underline"
          @click.stop="markAllRead()"
        >
          Tout marquer comme lu
        </button>
      </div>
      <DropdownMenuSeparator />

      <div v-if="notifications.length === 0" class="px-3 py-8 text-center text-sm text-neutral-500">
        <Icon name="ph:bell-slash" class="mx-auto mb-2 size-6 text-neutral-300" />
        Aucune notification.
      </div>

      <div v-else class="max-h-96 overflow-y-auto py-1">
        <DropdownMenuItem
          v-for="n in notifications"
          :key="n.id"
          class="flex cursor-pointer items-start gap-2.5 whitespace-normal px-3 py-2.5 focus:bg-neutral-50"
          :class="n.read ? '' : 'bg-primary-50/60'"
          @select="handleSelect(n)"
        >
          <Icon :name="notificationIcon(n.type)" class="mt-0.5 size-4 shrink-0 text-primary-500" />
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium text-neutral-900">{{ n.title }}</p>
            <p v-if="n.body" class="line-clamp-2 text-xs text-neutral-500">{{ n.body }}</p>
            <p class="mt-0.5 text-[11px] text-neutral-400">{{ fmt(n.createdAt) }}</p>
          </div>
          <span v-if="!n.read" class="mt-1 size-1.5 shrink-0 rounded-full bg-primary-500" />
        </DropdownMenuItem>
      </div>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
