<script setup lang="ts">
import { DELIVERY_STATUS_LABEL, NEXT_STATUS } from '~/stores/rider'

definePageMeta({ layout: 'default', middleware: 'auth' })
useHead({ title: 'Tableau de bord livreur - EzTech' })

const auth = useAuthStore()
const rider = useRiderStore()

onMounted(async () => {
  auth.hydrate()
  if (auth.role !== 'rider') return navigateTo('/products')
  await rider.fetchProfile()
  await rider.fetchActive()
  await rider.fetchNotifications()
  if (rider.isOnline) await rider.fetchAvailable()
})

const toggling = ref(false)
async function toggleOnline() {
  toggling.value = true
  try { await rider.setOnline(!rider.isOnline) }
  catch (e) { rider.error = e instanceof Error ? e.message : 'Action impossible' }
  finally { toggling.value = false }
}

const busyId = ref<string | null>(null)
async function accept(id: string) {
  busyId.value = id
  try { await rider.acceptOrder(id) }
  catch (e) { rider.error = e instanceof Error ? e.message : 'Impossible d\'accepter cette commande' }
  finally { busyId.value = null }
}
async function decline(id: string) {
  busyId.value = id
  try { await rider.declineOrder(id) }
  finally { busyId.value = null }
}

const advancing = ref(false)
async function advance() {
  if (!rider.activeDelivery) return
  const step = NEXT_STATUS[rider.activeDelivery.status]
  if (!step) return
  advancing.value = true
  try { await rider.advanceDelivery(step.next) }
  finally { advancing.value = false }
}

const nextStep = computed(() => rider.activeDelivery ? NEXT_STATUS[rider.activeDelivery.status] : undefined)

// soft countdown when an order is offered with an explicit expiry
const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => { timer = setInterval(() => { now.value = Date.now() }, 1000) })
onBeforeUnmount(() => { if (timer) clearInterval(timer) })
function remaining(iso: string | null): string | null {
  if (!iso) return null
  const ms = new Date(iso).getTime() - now.value
  if (ms <= 0) return 'expirée'
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function eur(n: number) { return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }) }
</script>

<template>
  <div class="mx-auto max-w-4xl px-4 py-8 space-y-6">
    <div class="flex items-center justify-between gap-4 flex-wrap">
      <div>
        <h1 class="text-2xl font-bold text-text-primary">Tableau de bord livreur</h1>
        <p class="text-sm text-text-muted">
          Bonjour {{ rider.profile?.name ?? auth.user?.name }} ·
          <span v-if="rider.profile?.applicationStatus === 'pending'" class="text-amber-600">candidature en attente de validation</span>
          <span v-else-if="rider.profile?.applicationStatus === 'rejected'" class="text-red-600">candidature refusée</span>
          <span v-else class="text-emerald-600">compte validé</span>
        </p>
      </div>
      <div class="flex items-center gap-2">
        <Button variant="ghost" size="sm" as-child>
          <NuxtLink to="/rider/notifications" class="relative">
            <Icon name="ph:bell" class="size-5" />
            <span v-if="rider.unreadCount > 0" class="absolute -right-1 -top-1 rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{{ rider.unreadCount }}</span>
          </NuxtLink>
        </Button>
        <Button :disabled="toggling || !rider.isApproved" :variant="rider.isOnline ? 'default' : 'outline'" @click="toggleOnline">
          <Icon :name="rider.isOnline ? 'ph:wifi-high' : 'ph:wifi-slash'" class="mr-2 size-4" />
          {{ rider.isOnline ? 'En ligne' : 'Hors ligne' }}
        </Button>
      </div>
    </div>

    <p v-if="rider.error" class="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{{ rider.error }}</p>

    <!-- Onboarding gate -->
    <Card v-if="rider.profile && !rider.isApproved">
      <CardContent class="py-8 text-center text-text-muted">
        <Icon :name="rider.profile.applicationStatus === 'rejected' ? 'ph:x-circle' : 'ph:hourglass'" class="mx-auto mb-3 size-10" />
        <p v-if="rider.profile.applicationStatus === 'rejected'">Votre candidature a été refusée. Contactez le support pour plus d'informations.</p>
        <p v-else>Votre candidature est en cours de validation par notre équipe. Vous pourrez passer en ligne une fois approuvé.</p>
        <Button class="mt-4" variant="outline" as-child><NuxtLink to="/rider/account">Compléter mon dossier</NuxtLink></Button>
      </CardContent>
    </Card>

    <!-- Active delivery -->
    <Card v-if="rider.activeDelivery">
      <CardHeader>
        <CardTitle class="flex items-center gap-2">
          <Icon name="ph:truck" class="size-5 text-brand" />
          Livraison en cours · {{ rider.activeDelivery.reference }}
        </CardTitle>
        <CardDescription>{{ DELIVERY_STATUS_LABEL[rider.activeDelivery.status] }}</CardDescription>
      </CardHeader>
      <CardContent class="space-y-3 text-sm">
        <div class="flex gap-2"><Icon name="ph:package" class="size-4 mt-0.5 text-text-muted" /><span><strong>Retrait :</strong> {{ rider.activeDelivery.pickupAddress }}</span></div>
        <div class="flex gap-2"><Icon name="ph:map-pin" class="size-4 mt-0.5 text-text-muted" /><span><strong>Livraison :</strong> {{ rider.activeDelivery.dropoffAddress }}</span></div>
        <div class="flex gap-2"><Icon name="ph:currency-eur" class="size-4 mt-0.5 text-text-muted" /><span><strong>Rémunération :</strong> {{ eur(rider.activeDelivery.riderFee) }}</span></div>
      </CardContent>
      <CardFooter class="gap-2">
        <Button v-if="nextStep" :disabled="advancing" @click="advance">
          <Icon name="ph:check-circle" class="mr-2 size-4" /> {{ nextStep.label }}
        </Button>
        <Button variant="ghost" as-child><NuxtLink to="/rider/deliveries">Détails & historique</NuxtLink></Button>
      </CardFooter>
    </Card>

    <!-- Offline notice -->
    <Card v-else-if="rider.isApproved && !rider.isOnline">
      <CardContent class="py-10 text-center text-text-muted">
        <Icon name="ph:moon" class="mx-auto mb-3 size-10" />
        <p>Vous êtes hors ligne. Passez en ligne pour voir les commandes disponibles près de vous.</p>
      </CardContent>
    </Card>

    <!-- Available orders -->
    <section v-if="rider.isOnline && !rider.activeDelivery" class="space-y-3">
      <h2 class="text-lg font-semibold text-text-primary">Commandes disponibles ({{ rider.available.length }})</h2>
      <Card v-if="rider.available.length === 0">
        <CardContent class="py-10 text-center text-text-muted">
          <Icon name="ph:hourglass" class="mx-auto mb-3 size-10" />
          <p>Aucune commande disponible pour le moment. Restez en ligne, on vous préviendra.</p>
        </CardContent>
      </Card>
      <Card v-for="o in rider.available" :key="o.id" data-testid="available-order">
        <CardHeader>
          <CardTitle class="flex items-center justify-between text-base">
            <span>{{ o.reference }}</span>
            <span class="text-brand">{{ eur(o.riderFee) }}</span>
          </CardTitle>
          <CardDescription v-if="remaining(o.assignmentExpiresAt)">Expire dans {{ remaining(o.assignmentExpiresAt) }}</CardDescription>
        </CardHeader>
        <CardContent class="space-y-1.5 text-sm">
          <div class="flex gap-2"><Icon name="ph:package" class="size-4 mt-0.5 text-text-muted" /><span>{{ o.pickupAddress }}</span></div>
          <div class="flex gap-2"><Icon name="ph:map-pin" class="size-4 mt-0.5 text-text-muted" /><span>{{ o.dropoffAddress }}</span></div>
        </CardContent>
        <CardFooter class="gap-2">
          <Button :disabled="busyId === o.id" @click="accept(o.id)">Accepter</Button>
          <Button variant="outline" :disabled="busyId === o.id" @click="decline(o.id)">Refuser</Button>
        </CardFooter>
      </Card>
    </section>
  </div>
</template>
