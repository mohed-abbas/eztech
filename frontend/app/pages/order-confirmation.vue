<script setup lang="ts">
// Page de confirmation post-paiement. L'id de commande arrive en query (?order=<id>) et NON en
// segment de route : créer app/pages/orders/[id]/confirmation.vue transformerait orders/[id].vue
// en route parente devant rendre <NuxtPage/>, ce qui casserait le suivi de commande.
// '~~' pointe la racine du projet frontend — seul alias qui atteint le type exporté par la route Nitro.
import type { TrackingOrder } from '~~/server/api/orders/[id].get'

definePageMeta({ layout: 'default', middleware: 'auth' })

const route = useRoute()

// même garde que la route BFF : uuid ou forme locale ord_*, rien d'autre ne peut être interpolé
const ID_RE = /^[\w-]{1,50}$/
const orderId = String(route.query.order ?? '')

// ?order= absent ou malformé : on renvoie sur la liste des commandes plutôt que d'afficher une
// page de succès vide.
if (!ID_RE.test(orderId)) {
  await navigateTo('/orders', { replace: true })
}

useHead({ title: 'Commande confirmée - EzTech' })

const auth = useAuthStore()

// On relit la commande depuis l'API (BFF GET /api/orders/:id, lecture seule) : un rechargement de
// la page réaffiche donc les vraies données, jamais un reste d'état du store checkout.
const { data: order, status, error, refresh } = await useFetch<TrackingOrder>(
  () => `/api/orders/${orderId}`,
  {
    immediate: ID_RE.test(orderId),
    $fetch: useRequestFetch() as typeof globalThis.$fetch,
    headers: computed<Record<string, string>>(() => {
      const headers: Record<string, string> = {}
      if (auth.token) headers.Authorization = `Bearer ${auth.token}`
      return headers
    }),
  },
)

const addressLine = computed(() => {
  const a = order.value?.deliveryAddress
  if (!a) return ''
  return [a.street, a.zipCode, a.city].filter(Boolean).join(', ')
})

const reference = computed(() => order.value?.reference || order.value?.id || '')

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="min-h-screen bg-background">
    <!-- Hero Header -->
    <div class="relative overflow-hidden bg-section-dark px-6 py-12 sm:px-10 sm:py-16">
      <div class="pointer-events-none absolute -right-20 -top-20 size-80 rounded-full bg-primary-500/15 blur-3xl" />
      <div class="pointer-events-none absolute -bottom-10 -left-10 size-64 rounded-full bg-primary-400/10 blur-2xl" />

      <div class="relative mx-auto max-w-3xl text-center">
        <div class="mx-auto mb-5 flex size-16 items-center justify-center rounded-full bg-emerald-500/15 backdrop-blur-sm">
          <Icon name="ph:check-circle" class="size-9 text-emerald-400" />
        </div>
        <h1 class="text-h1 font-semibold text-white">Commande confirmée</h1>
        <p class="mt-2 text-body text-neutral-400">
          Merci ! Votre commande est enregistrée et un livreur va être assigné.
        </p>
        <p v-if="reference" class="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-body-sm font-medium text-neutral-200 backdrop-blur-sm">
          <Icon name="ph:receipt" class="size-4" />
          Référence&nbsp;: {{ reference }}
        </p>
      </div>
    </div>

    <!-- Main Content -->
    <div class="mx-auto max-w-3xl px-6 py-10 sm:px-10">
      <!-- Loading -->
      <div v-if="status === 'pending'" class="space-y-4">
        <div class="flex items-center gap-3">
          <div class="size-5 animate-spin rounded-full border-2 border-primary-200 border-t-primary-500" />
          <p class="text-body text-text-muted">Chargement de votre commande…</p>
        </div>
        <div class="h-32 animate-pulse rounded-2xl bg-white" />
        <div class="h-48 animate-pulse rounded-2xl bg-white" />
      </div>

      <!-- Error -->
      <div v-else-if="error || !order">
        <EmptyState
          title="Commande introuvable"
          description="Nous n'avons pas pu récupérer cette commande. Elle n'existe peut-être pas ou ne vous appartient pas."
        >
          <template #icon>
            <Icon name="ph:warning-circle" class="size-10 text-error" />
          </template>
          <template #actions>
            <Button variant="gradient" size="pill" class="font-semibold" @click="refresh()">
              <Icon name="ph:arrow-clockwise" class="size-4" />
              Réessayer
            </Button>
            <NuxtLink to="/orders">
              <Button variant="outline" size="pill" class="font-medium">
                Mes commandes
              </Button>
            </NuxtLink>
          </template>
        </EmptyState>
      </div>

      <template v-else>
        <!-- Livraison -->
        <Card class="p-6">
          <div class="flex items-start gap-4">
            <div class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-surface-purple">
              <Icon name="ph:map-pin" class="size-5 text-primary-600" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-caption font-medium text-text-muted">Adresse de livraison</p>
              <p class="mt-1 break-words text-body font-medium text-text-primary">
                {{ addressLine || 'Adresse non renseignée' }}
              </p>
            </div>
          </div>

          <hr class="my-5 border-neutral-100">

          <div class="flex items-start gap-4">
            <div class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-surface-purple">
              <Icon name="ph:clock-countdown" class="size-5 text-primary-600" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-caption font-medium text-text-muted">Livraison estimée</p>
              <p class="mt-1 text-body font-medium text-text-primary">
                <template v-if="order.estimatedDelivery">
                  Vers {{ formatTime(order.estimatedDelivery) }}
                </template>
                <template v-else>
                  Créneau communiqué dès qu'un livreur est assigné
                </template>
              </p>
              <p v-if="order.createdAt" class="mt-0.5 text-body-sm text-text-muted">
                Commandée le {{ formatDateTime(order.createdAt) }}
              </p>
            </div>
          </div>
        </Card>

        <!-- Récapitulatif -->
        <Card class="mt-5 p-6">
          <h2 class="text-h4 font-semibold text-text-primary">Récapitulatif</h2>

          <ul v-if="order.items.length" class="mt-4 space-y-3">
            <li
              v-for="(item, index) in order.items"
              :key="`${item.productId}-${index}`"
              class="flex items-start justify-between gap-4"
            >
              <div class="min-w-0">
                <p class="truncate text-body-sm font-medium text-text-primary">{{ item.name }}</p>
                <p class="text-caption text-text-muted">
                  Quantité&nbsp;: {{ item.quantity }} &middot; {{ item.unitPrice.toFixed(2) }} &euro; l'unité
                </p>
              </div>
              <span class="shrink-0 text-body-sm font-medium text-text-primary">
                {{ item.total.toFixed(2) }} &euro;
              </span>
            </li>
          </ul>
          <p v-else class="mt-4 text-body-sm text-text-muted">
            Le détail des articles n'est pas disponible pour cette commande.
          </p>

          <hr class="my-5 border-neutral-100">

          <div class="space-y-2 text-body-sm text-text-muted">
            <div class="flex items-center justify-between">
              <span>Sous-total</span>
              <span>{{ order.subtotal.toFixed(2) }} &euro;</span>
            </div>
            <div class="flex items-center justify-between">
              <span>Livraison</span>
              <span>{{ order.deliveryFee > 0 ? `${order.deliveryFee.toFixed(2)} €` : 'Gratuite' }}</span>
            </div>
            <div class="flex items-center justify-between pt-2 font-semibold text-text-primary">
              <span>Total</span>
              <span class="text-h4">{{ order.total.toFixed(2) }} &euro;</span>
            </div>
          </div>
        </Card>

        <!-- Actions -->
        <div class="mt-8 flex flex-col gap-3 sm:flex-row">
          <NuxtLink :to="`/orders/${order.id}`" class="sm:flex-1">
            <Button variant="gradient" size="pill" class="w-full font-semibold">
              <Icon name="ph:navigation-arrow" class="size-4" />
              Suivre ma commande
            </Button>
          </NuxtLink>
          <NuxtLink to="/products" class="sm:flex-1">
            <Button variant="outline" size="pill" class="w-full font-medium">
              <Icon name="ph:squares-four" class="size-4" />
              Retour au catalogue
            </Button>
          </NuxtLink>
        </div>
      </template>
    </div>
  </div>
</template>
