<script setup lang="ts">
import { DELIVERY_STATUS_LABEL, NEXT_STATUS, type DeliveryStatus, type DeliveryOrder } from '~/stores/rider'

definePageMeta({ layout: 'default', middleware: 'auth' })
useHead({ title: 'Livraisons - EzTech' })

const auth = useAuthStore()
const rider = useRiderStore()

onMounted(async () => {
  auth.hydrate()
  if (auth.role !== 'rider') return navigateTo('/products')
  await Promise.all([rider.fetchActive(), rider.fetchEarnings()])
})

// ─── Émission GPS live pendant le transport (D-06) ──────────────────────────
// Le livreur ne diffuse sa position que lorsqu'il porte physiquement le colis.
const TRANSIT_STATUSES: DeliveryStatus[] = ['picked_up', 'in_transit']
const gpsActive = ref(false)
let emitter: { start: () => void, stop: () => void } | null = null
let emittingId: string | null = null

function syncGpsEmitter() {
  const d = rider.activeDelivery
  const shouldEmit = !!d && TRANSIT_STATUSES.includes(d.status)
  if (shouldEmit && d) {
    if (emittingId !== d.id) {
      emitter?.stop()
      emitter = useRiderPositionEmitter(d.id)
      emittingId = d.id
      emitter.start()
      gpsActive.value = true
    }
  } else if (emitter) {
    emitter.stop()
    emitter = null
    emittingId = null
    gpsActive.value = false
  }
}

watch(() => [rider.activeDelivery?.id, rider.activeDelivery?.status], syncGpsEmitter)
onBeforeUnmount(() => { emitter?.stop(); emitter = null })

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

// Itinéraire Google Maps entrepôt → client (coords si dispo, sinon adresses)
function deliveryMapsUrl(d: DeliveryOrder) {
  const origin = d.pickupLat != null && d.pickupLng != null
    ? `${d.pickupLat},${d.pickupLng}`
    : encodeURIComponent(d.pickupAddress)
  const destination = d.dropoffLat != null && d.dropoffLng != null
    ? `${d.dropoffLat},${d.dropoffLng}`
    : encodeURIComponent(d.dropoffAddress)
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`
}

function fmt(iso: string | null) {
  return iso ? new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'
}
function eur(n: number) { return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }) }
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-8 space-y-6">
    <h1 class="text-2xl font-bold text-text-primary">Livraisons</h1>

    <!-- Active delivery -->
    <Card v-if="rider.activeDelivery">
      <CardHeader>
        <CardTitle>Livraison en cours · {{ rider.activeDelivery.reference }}</CardTitle>
        <CardDescription>{{ DELIVERY_STATUS_LABEL[rider.activeDelivery.status] }} · {{ eur(rider.activeDelivery.riderFee) }}</CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="space-y-1.5 text-sm">
          <div class="flex gap-2"><Icon name="ph:package" class="size-4 mt-0.5 text-text-muted" /><span>{{ rider.activeDelivery.pickupAddress }}</span></div>
          <div class="flex gap-2"><Icon name="ph:map-pin" class="size-4 mt-0.5 text-text-muted" /><span>{{ rider.activeDelivery.dropoffAddress }}</span></div>
        </div>

        <!-- Indicateur de partage de position -->
        <div v-if="gpsActive" class="flex items-center gap-2 rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
          <span class="relative flex size-2">
            <span class="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-75" />
            <span class="relative inline-flex size-2 rounded-full bg-success" />
          </span>
          Position partagée en direct avec le client
        </div>

        <!-- timeline -->
        <ol v-if="rider.activeDelivery.events?.length" class="border-l-2 border-border pl-4 space-y-2">
          <li v-for="ev in rider.activeDelivery.events" :key="ev.id" class="text-sm">
            <span class="font-medium text-text-primary">{{ DELIVERY_STATUS_LABEL[ev.status] }}</span>
            <span class="text-text-muted"> · {{ fmt(ev.createdAt) }}</span>
            <span v-if="ev.note" class="text-text-muted"> — {{ ev.note }}</span>
          </li>
        </ol>
      </CardContent>
      <CardFooter class="gap-2">
        <Button v-if="nextStep" :disabled="advancing" @click="advance">
          <Icon name="ph:check-circle" class="mr-2 size-4" /> {{ nextStep.label }}
        </Button>
        <span v-else class="text-sm text-text-muted">Livraison terminée.</span>
        <Button variant="outline" as-child>
          <a :href="deliveryMapsUrl(rider.activeDelivery)" target="_blank" rel="noopener">
            <Icon name="ph:navigation-arrow" class="mr-2 size-4" /> Itinéraire
          </a>
        </Button>
      </CardFooter>
    </Card>
    <Card v-else>
      <CardContent class="py-10 text-center text-text-muted">
        <Icon name="ph:truck" class="mx-auto mb-3 size-10" />
        <p>Aucune livraison en cours.</p>
        <Button class="mt-4" variant="outline" as-child><NuxtLink to="/rider/dashboard">Voir les commandes disponibles</NuxtLink></Button>
      </CardContent>
    </Card>

    <!-- Recent deliveries & returns -->
    <section class="space-y-3">
      <h2 class="text-lg font-semibold text-text-primary">Historique</h2>
      <Card>
        <CardContent class="p-0">
          <table v-if="rider.history.length" class="w-full text-sm">
            <thead class="border-b border-border text-left text-text-muted">
              <tr><th class="px-4 py-2">Type</th><th class="px-4 py-2">Référence</th><th class="px-4 py-2">Adresse</th><th class="px-4 py-2">Date</th><th class="px-4 py-2 text-right">Gain</th></tr>
            </thead>
            <tbody>
              <tr v-for="h in rider.history" :key="h.id" class="border-b border-border/50 last:border-0">
                <td class="px-4 py-2">{{ h.kind === 'return' ? 'Retour' : 'Livraison' }}</td>
                <td class="px-4 py-2 font-medium">{{ h.reference }}</td>
                <td class="px-4 py-2 text-text-muted">{{ h.dropoffAddress ?? h.pickupAddress }}</td>
                <td class="px-4 py-2 text-text-muted">{{ fmt(h.completedAt) }}</td>
                <td class="px-4 py-2 text-right">{{ eur(h.riderFee) }}</td>
              </tr>
            </tbody>
          </table>
          <p v-else class="px-4 py-8 text-center text-text-muted">Aucune course effectuée pour l'instant.</p>
        </CardContent>
      </Card>
    </section>
  </div>
</template>
