<script setup lang="ts">
import { ACTIVE_STATUSES, STATUS_CONFIG, type OrderStatus } from '~/stores/orders'

definePageMeta({
  layout: 'default',
  middleware: 'auth',
})

useHead({ title: 'Mes commandes - EzTech' })

const store = useOrdersStore()
store.hydrate()

const activeFilter = ref<'all' | 'active' | 'delivered' | 'cancelled'>('all')

const filters: { key: typeof activeFilter.value, label: string }[] = [
  { key: 'all', label: 'Toutes' },
  { key: 'active', label: 'En cours' },
  { key: 'delivered', label: 'Livrées' },
  { key: 'cancelled', label: 'Annulées' },
]

const filteredOrders = computed(() => {
  if (activeFilter.value === 'all') return store.orders
  if (activeFilter.value === 'active') return store.activeOrders
  if (activeFilter.value === 'delivered') return store.deliveredOrders
  return store.cancelledOrders
})

function isActiveStatus(status: OrderStatus): boolean {
  return ACTIVE_STATUSES.includes(status)
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
</script>

<template>
  <div class="min-h-screen bg-background">
    <!-- Hero Header -->
    <div class="relative overflow-hidden bg-section-dark px-6 py-12 sm:px-10 sm:py-16">
      <div class="pointer-events-none absolute -right-20 -top-20 size-80 rounded-full bg-primary-500/15 blur-3xl" />
      <div class="pointer-events-none absolute -bottom-10 -left-10 size-64 rounded-full bg-primary-400/10 blur-2xl" />

      <div class="relative mx-auto max-w-7xl">
        <NuxtLink
          to="/products"
          class="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-body-sm font-medium text-neutral-300 backdrop-blur-sm transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400/50"
        >
          <Icon name="ph:arrow-left" class="size-4" />
          Retour au catalogue
        </NuxtLink>

        <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 class="text-h1 font-semibold text-white">Mes commandes</h1>
            <p class="mt-2 text-body text-neutral-400">
              Suivez et gérez toutes vos locations
            </p>
          </div>

          <!-- Stats Bar -->
          <div class="hidden items-center gap-5 sm:flex">
            <div class="flex items-center gap-3">
              <div class="flex size-11 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm">
                <Icon name="ph:receipt" class="size-5 text-primary-300" />
              </div>
              <div>
                <p class="text-caption font-medium text-neutral-500 leading-tight">Total</p>
                <p class="text-body-lg font-semibold text-white leading-tight">{{ store.stats.total }}</p>
              </div>
            </div>

            <div class="h-8 w-px bg-white/10" />

            <div class="flex items-center gap-3">
              <div class="flex size-11 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm">
                <Icon name="ph:clock" class="size-5 text-primary-300" />
              </div>
              <div>
                <p class="text-caption font-medium text-neutral-500 leading-tight">En cours</p>
                <p class="text-body-lg font-semibold text-white leading-tight">{{ store.stats.active }}</p>
              </div>
            </div>

            <div class="h-8 w-px bg-white/10" />

            <div class="flex items-center gap-3">
              <div class="flex size-11 items-center justify-center rounded-xl bg-primary-500/25 border border-primary-400/20">
                <Icon name="ph:wallet" class="size-5 text-primary-300" />
              </div>
              <div>
                <p class="text-caption font-medium text-primary-400 leading-tight">Dépensé</p>
                <p class="text-body-lg font-semibold text-white leading-tight">{{ store.stats.spent.toFixed(2) }} &euro;</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="mx-auto max-w-7xl px-6 py-10 sm:px-10">
      <!-- Loading -->
      <div v-if="store.loading" class="py-20 text-center text-text-muted">
        Chargement des commandes...
      </div>

      <!-- Empty State -->
      <EmptyState
        v-else-if="store.orders.length === 0"
        title="Aucune commande"
        description="Vous n'avez pas encore passé de commande. Parcourez notre catalogue pour commencer."
      >
        <template #icon>
          <Icon name="ph:receipt" class="size-10 text-primary-500" />
        </template>
        <template #actions>
          <NuxtLink to="/products">
            <Button variant="gradient" size="pill" class="font-semibold">
              <Icon name="ph:storefront" class="size-4" />
              Voir le catalogue
            </Button>
          </NuxtLink>
        </template>
      </EmptyState>

      <template v-else>
        <!-- Filter Tabs -->
        <div class="mb-6 flex items-center gap-2 overflow-x-auto">
          <button
            v-for="f in filters"
            :key="f.key"
            class="shrink-0 rounded-full px-4 py-2 text-body-sm font-medium transition-all"
            :class="activeFilter === f.key
              ? 'bg-primary-600 text-white'
              : 'bg-white text-text-secondary border border-neutral-200 hover:bg-neutral-50'"
            @click="activeFilter = f.key"
          >
            {{ f.label }}
          </button>
        </div>

        <!-- Orders List -->
        <div v-if="filteredOrders.length === 0" class="rounded-2xl border border-neutral-200 bg-white p-12 text-center">
          <Icon name="ph:magnifying-glass" class="mx-auto size-10 text-neutral-300" />
          <p class="mt-3 text-body font-medium text-text-primary">Aucune commande trouvée</p>
          <p class="mt-1 text-body-sm text-text-muted">Essayez un autre filtre</p>
        </div>

        <div v-else class="space-y-4">
          <NuxtLink
            v-for="order in filteredOrders"
            :key="order.id"
            :to="`/orders/${order.id}`"
            class="group block rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition-all hover:border-primary-300 hover:shadow-md sm:p-6"
          >
            <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <!-- Left: Order Info -->
              <div class="flex items-start gap-4">
                <div
                  class="flex size-12 shrink-0 items-center justify-center rounded-xl"
                  :class="STATUS_CONFIG[order.status].bg"
                >
                  <Icon :name="STATUS_CONFIG[order.status].icon" class="size-6" :class="STATUS_CONFIG[order.status].color" />
                </div>
                <div>
                  <div class="flex flex-wrap items-center gap-2">
                    <p class="text-body font-semibold text-text-primary">{{ order.id }}</p>
                    <span
                      class="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-caption font-medium"
                      :class="[STATUS_CONFIG[order.status].color, STATUS_CONFIG[order.status].bg, STATUS_CONFIG[order.status].border]"
                    >
                      <span
                        v-if="isActiveStatus(order.status)"
                        class="size-1.5 rounded-full bg-primary-500 animate-pulse"
                      />
                      {{ STATUS_CONFIG[order.status].label }}
                    </span>
                  </div>
                  <p class="mt-1 text-body-sm text-text-muted">{{ formatDate(order.createdAt) }}</p>
                  <p class="mt-1 text-body-sm text-text-secondary">
                    {{ store.itemSummary(order) }}
                  </p>
                </div>
              </div>

              <!-- Right: Price + Arrow -->
              <div class="flex items-center gap-4 sm:text-right">
                <div>
                  <p class="text-h4 font-semibold text-text-primary">{{ order.total.toFixed(2) }} &euro;</p>
                  <p class="text-caption text-text-muted">{{ store.itemCount(order) }} article{{ store.itemCount(order) > 1 ? 's' : '' }}</p>
                </div>
                <Icon
                  name="ph:arrow-right"
                  class="size-5 text-neutral-300 transition-transform group-hover:translate-x-1 group-hover:text-primary-500"
                />
              </div>
            </div>

            <!-- Active Order: Progress Hint -->
            <div
              v-if="isActiveStatus(order.status)"
              class="mt-4 flex items-center gap-3 rounded-xl bg-surface-purple border border-primary-100 px-4 py-3"
            >
              <Icon :name="STATUS_CONFIG[order.status].icon" class="size-5 text-primary-600" />
              <div class="flex-1">
                <div class="h-1.5 rounded-full bg-primary-100">
                  <div class="h-1.5 rounded-full bg-primary-500" :style="{ width: `${store.getProgress(order.status)}%` }" />
                </div>
              </div>
              <span class="text-caption font-medium text-primary-600">{{ STATUS_CONFIG[order.status].label }}</span>
            </div>
          </NuxtLink>
        </div>

        <!-- Summary Footer -->
        <div class="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div class="rounded-xl rounded-tl-feature bg-surface-purple border border-primary-100 p-5 flex items-center gap-3">
            <div class="flex size-10 items-center justify-center rounded-full bg-primary-100">
              <Icon name="ph:package" class="size-5 text-primary-600" />
            </div>
            <div>
              <p class="text-body-sm font-semibold text-text-primary">{{ store.stats.delivered }} livraison{{ store.stats.delivered > 1 ? 's' : '' }}</p>
              <p class="text-caption text-text-muted">Complétées avec succès</p>
            </div>
          </div>
          <div class="rounded-xl bg-surface-violet border border-accent-100 p-5 flex items-center gap-3">
            <div class="flex size-10 items-center justify-center rounded-full bg-accent-100">
              <Icon name="ph:shield-check" class="size-5 text-accent-600" />
            </div>
            <div>
              <p class="text-body-sm font-semibold text-text-primary">Garantie location</p>
              <p class="text-caption text-text-muted">Produits assurés à 100%</p>
            </div>
          </div>
          <div class="rounded-xl rounded-br-feature bg-surface-lavender border border-primary-100 p-5 flex items-center gap-3">
            <div class="flex size-10 items-center justify-center rounded-full bg-primary-100">
              <Icon name="ph:headset" class="size-5 text-primary-600" />
            </div>
            <div>
              <p class="text-body-sm font-semibold text-text-primary">Support 7j/7</p>
              <p class="text-caption text-text-muted">Assistance dédiée</p>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
