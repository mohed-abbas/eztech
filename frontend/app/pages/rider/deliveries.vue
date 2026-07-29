<script setup lang="ts">
import {
  DELIVERY_STATUS_LABEL,
  NEXT_STATUS,
  PICKUP_CODE_LENGTH,
  advanceErrorMessage,
  requiresPickupCode,
  type DeliveryStatus,
  type DeliveryOrder,
} from '~/stores/rider'

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

// ─── Passage de relais au comptoir ──────────────────────────────────────────
// Meme garde que sur le tableau de bord : sans le code remis par l'entrepot, le backend refuse
// at_warehouse -> picked_up. Le code est saisi, jamais affiche.
const pickupCode = ref('')
const advanceError = ref<string | null>(null)

const needsPickupCode = computed(() => {
  const d = rider.activeDelivery
  return !!d && d.status === 'at_warehouse' && requiresPickupCode(d)
})
const pickupCodeFilled = computed(() => pickupCode.value.trim().length > 0)

function onPickupCodeInput(value: string | number) {
  pickupCode.value = String(value).toUpperCase().replace(/\s+/g, '')
}

const advancing = ref(false)
async function advance() {
  const d = rider.activeDelivery
  if (!d) return
  const step = NEXT_STATUS[d.status]
  if (!step) return
  const code = needsPickupCode.value ? pickupCode.value.trim() : undefined
  if (needsPickupCode.value && !code) {
    advanceError.value = 'Saisissez le code remis par le comptoir.'
    return
  }
  advancing.value = true
  advanceError.value = null
  try {
    await rider.advanceDelivery(step.next, undefined, code)
    pickupCode.value = ''
  }
  catch (e) { advanceError.value = advanceErrorMessage(e) }
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
function hhmm(iso: string) { return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) }
function eur(n: number) { return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }) }
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-8 space-y-6">
    <h1 class="text-h2 font-bold text-text-primary">Livraisons</h1>

    <!-- Active delivery -->
    <Card v-if="rider.activeDelivery">
      <CardHeader class="gap-2">
        <CardTitle>Livraison en cours · {{ rider.activeDelivery.reference }}</CardTitle>
        <div class="flex flex-wrap items-center gap-2">
          <CardDescription>{{ DELIVERY_STATUS_LABEL[rider.activeDelivery.status] }} · {{ eur(rider.activeDelivery.riderFee) }}</CardDescription>
          <span
            v-if="rider.activeDelivery.preparedAt"
            class="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-caption font-medium text-success"
          >
            <Icon name="ph:check-circle" class="size-3.5" />
            Colis prêt · {{ hhmm(rider.activeDelivery.preparedAt) }}
          </span>
          <span
            v-else-if="needsPickupCode"
            class="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-caption font-medium text-warning"
          >
            <Icon name="ph:hourglass" class="size-3.5" />
            En préparation
          </span>
        </div>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="space-y-1.5 text-body-sm">
          <p class="flex items-start gap-2.5"><Icon name="ph:package" class="mt-0.5 size-4 shrink-0 text-text-muted" /><span>{{ rider.activeDelivery.pickupAddress }}</span></p>
          <p class="flex items-start gap-2.5"><Icon name="ph:map-pin" class="mt-0.5 size-4 shrink-0 text-text-muted" /><span>{{ rider.activeDelivery.dropoffAddress }}</span></p>
        </div>

        <!-- Contenu du colis -->
        <div v-if="rider.activeDelivery.items?.length" class="space-y-2 border-t border-neutral-200 pt-4">
          <p class="text-caption font-medium uppercase tracking-wide text-text-muted">Contenu du colis</p>
          <ul class="space-y-2 text-body-sm">
            <li v-for="item in rider.activeDelivery.items" :key="item.id" class="flex items-center gap-3">
              <span class="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50">
                <ProductImage
                  :src="item.imageUrl"
                  :alt="item.name"
                  fallback-icon="ph:package"
                  img-class="size-full object-cover"
                  icon-class="size-5 text-neutral-400"
                />
              </span>
              <span class="min-w-0 flex-1 truncate text-text-primary">{{ item.name }}</span>
              <span class="shrink-0 text-text-muted">×{{ item.quantity }}</span>
            </li>
          </ul>
        </div>

        <!-- Code de ramassage : remis de la main a la main par le comptoir, jamais affiche -->
        <div v-if="needsPickupCode" class="space-y-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-body-sm">
          <label for="pickup-code-deliveries" class="block font-medium text-text-primary">Code de ramassage</label>
          <p class="text-caption text-text-muted">Le comptoir de l'entrepôt vous le remet avec le colis.</p>
          <Input
            id="pickup-code-deliveries"
            :model-value="pickupCode"
            type="text"
            name="pickup-code"
            inputmode="text"
            autocapitalize="characters"
            autocomplete="off"
            autocorrect="off"
            spellcheck="false"
            :maxlength="PICKUP_CODE_LENGTH"
            placeholder="XXXXXX"
            class="max-w-40 text-center font-mono uppercase tracking-[0.35em]"
            :aria-invalid="advanceError ? 'true' : undefined"
            aria-describedby="pickup-code-deliveries-help"
            @update:model-value="onPickupCodeInput"
          />
          <p id="pickup-code-deliveries-help" class="text-caption text-text-muted">{{ PICKUP_CODE_LENGTH }} caractères.</p>
        </div>

        <p v-if="advanceError" role="alert" class="flex items-start gap-2 text-body-sm text-error">
          <Icon name="ph:warning-circle" class="mt-0.5 size-4 shrink-0" />
          <span>{{ advanceError }}</span>
        </p>

        <!-- Indicateur de partage de position -->
        <div v-if="gpsActive" class="flex items-center gap-2 rounded-lg bg-success/10 px-3 py-2 text-body-sm text-success">
          <span class="relative flex size-2">
            <span class="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-75" />
            <span class="relative inline-flex size-2 rounded-full bg-success" />
          </span>
          Position partagée en direct avec le client
        </div>

        <!-- timeline -->
        <ol v-if="rider.activeDelivery.events?.length" class="border-l-2 border-border pl-4 space-y-2">
          <li v-for="ev in rider.activeDelivery.events" :key="ev.id" class="text-body-sm">
            <span class="font-medium text-text-primary">{{ DELIVERY_STATUS_LABEL[ev.status] }}</span>
            <span class="text-text-muted"> · {{ fmt(ev.createdAt) }}</span>
            <span v-if="ev.note" class="text-text-muted"> — {{ ev.note }}</span>
          </li>
        </ol>
      </CardContent>
      <CardFooter class="flex-wrap gap-2">
        <Button v-if="nextStep" :disabled="advancing || (needsPickupCode && !pickupCodeFilled)" @click="advance">
          <Icon name="ph:check-circle" class="mr-2 size-4" /> {{ nextStep.label }}
        </Button>
        <span v-else class="text-body-sm text-text-muted">Livraison terminée.</span>
        <Button variant="outline" as-child>
          <a :href="deliveryMapsUrl(rider.activeDelivery)" target="_blank" rel="noopener">
            <Icon name="ph:navigation-arrow" class="mr-2 size-4" /> Itinéraire
          </a>
        </Button>
      </CardFooter>
    </Card>
    <EmptyState
      v-else
      title="Aucune livraison en cours."
      description="Rendez-vous sur le tableau de bord pour accepter une nouvelle course."
    >
      <template #icon>
        <Icon name="ph:truck" class="size-10 text-primary-500" />
      </template>
      <template #actions>
        <Button variant="outline" as-child><NuxtLink to="/rider/dashboard">Voir les commandes disponibles</NuxtLink></Button>
      </template>
    </EmptyState>

    <!-- Recent deliveries & returns -->
    <section class="space-y-3">
      <h2 class="text-h4 font-semibold text-text-primary">Historique</h2>
      <Card v-if="rider.history.length">
        <CardContent class="p-0 overflow-x-auto">
          <table class="w-full text-body-sm">
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
        </CardContent>
      </Card>
      <EmptyState
        v-else
        title="Aucune course effectuée pour l'instant."
        description="Vos livraisons et retours terminés apparaîtront ici."
      >
        <template #icon>
          <Icon name="ph:clock-counter-clockwise" class="size-10 text-primary-500" />
        </template>
      </EmptyState>
    </section>
  </div>
</template>
