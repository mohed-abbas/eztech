<script setup lang="ts">
import {
  DELIVERY_STATUS_LABEL,
  NEXT_STATUS,
  PICKUP_CODE_LENGTH,
  advanceErrorMessage,
  requiresPickupCode,
  type DeliveryOrder,
} from '~/stores/rider'

definePageMeta({ layout: 'default', middleware: 'auth' })
useHead({ title: 'Tableau de bord livreur - EzTech' })

const auth = useAuthStore()
const rider = useRiderStore()

onMounted(async () => {
  auth.hydrate()
  if (auth.role !== 'rider') return navigateTo('/products')
  await rider.fetchProfile()
  await rider.fetchActive()
  // pas de fetchNotifications ici : la cloche de la barre d'app charge et pousse deja les memes
  // lignes (etat partage useNotifications), plus rien sur cet ecran ne les affiche.
  if (rider.isOnline) await rider.fetchAvailable()
})

const toggling = ref(false)
async function toggleOnline() {
  toggling.value = true
  try { await rider.setOnline(!rider.isOnline) }
  catch (e) { rider.error = e instanceof Error ? e.message : 'Action impossible' }
  finally { toggling.value = false }
}

// Le store ne possede pas rider.error : fetchActive/fetchAvailable ne le remettent jamais a null et
// ne le renseignent pas en cas d'echec. Sans ce handler, « Réessayer » laissait la banniere affichee
// pour toujours et une erreur reseau repartait en promesse non geree.
const retrying = ref(false)
async function retry() {
  retrying.value = true
  rider.error = null
  try {
    await rider.fetchActive()
    if (rider.isOnline) await rider.fetchAvailable()
  }
  catch (e) { rider.error = e instanceof Error ? e.message : 'Rechargement impossible' }
  finally { retrying.value = false }
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

// ─── Passage de relais au comptoir ──────────────────────────────────────────
// Le colis ne part plus sans le code que l'entrepot remet en main propre : sans lui le backend
// refuse at_warehouse -> picked_up. Le code n'est jamais affiche ici, seulement saisi.
const pickupCode = ref('')
const advanceError = ref<string | null>(null)

const needsPickupCode = computed(() => {
  const d = rider.activeDelivery
  return !!d && d.status === 'at_warehouse' && requiresPickupCode(d)
})
const pickupCodeFilled = computed(() => pickupCode.value.trim().length > 0)

// saisie telephone : majuscules au fil de la frappe et pas d'espaces parasites
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

// ─── Emission GPS pendant le transport ──────────────────────────────────────
// Ce tableau de bord porte la meme carte de livraison active et le meme bouton d'avancement que
// /rider/deliveries, mais il n'emettait aucune position : un livreur qui travaille depuis cet
// ecran (c'est ici que se trouvent le bouton En ligne et le vivier de commandes) laissait la
// carte du client vide. Le watch GPS est partage et compte ses references, donc passer d'un
// ecran a l'autre ne double ni les fixes ni les emissions.
const { sharing: gpsSharing } = useRiderGpsSharing(() => rider.activeDelivery)

// ─── Contenu du colis ───────────────────────────────────────────────────────
// Ecran telephone, livreur sur un vélo : on montre les premieres lignes et on compte le reste.
const MAX_PREVIEW_ITEMS = 3
function previewItems(o: DeliveryOrder) { return (o.items ?? []).slice(0, MAX_PREVIEW_ITEMS) }
function hiddenItems(o: DeliveryOrder) { return Math.max(0, (o.items?.length ?? 0) - MAX_PREVIEW_ITEMS) }

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

function hhmm(iso: string) { return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) }
function eur(n: number) { return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }) }
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-8 space-y-6">
    <!-- La cloche vit dans la barre d'app (poussee temps reel + menu deroulant) et le menu livreur
         pointe deja vers /rider/notifications : un troisieme badge ici faisait doublon. -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="space-y-1">
        <h1 class="text-h2 font-bold text-text-primary">Tableau de bord livreur</h1>
        <p class="text-body-sm text-text-muted">
          Bonjour {{ rider.profile?.name ?? auth.user?.name }} ·
          <span v-if="rider.profile?.applicationStatus === 'pending'" class="text-warning">candidature en attente de validation</span>
          <span v-else-if="rider.profile?.applicationStatus === 'rejected'" class="text-error">candidature refusée</span>
          <span v-else class="text-success">compte validé</span>
        </p>
      </div>
      <Button :disabled="toggling || !rider.isApproved" :variant="rider.isOnline ? 'default' : 'outline'" @click="toggleOnline">
        <Icon :name="rider.isOnline ? 'ph:wifi-high' : 'ph:wifi-slash'" class="mr-2 size-4" />
        {{ rider.isOnline ? 'En ligne' : 'Hors ligne' }}
      </Button>
    </div>

    <ErrorState v-if="rider.error" variant="inline" :title="rider.error">
      <template #actions>
        <Button variant="ghost" size="sm" :disabled="retrying" @click="retry">Réessayer</Button>
      </template>
    </ErrorState>

    <!-- Onboarding gate -->
    <EmptyState
      v-if="rider.profile && !rider.isApproved"
      :title="rider.profile.applicationStatus === 'rejected' ? 'Candidature refusée' : 'Candidature en cours de validation'"
      :description="rider.profile.applicationStatus === 'rejected'
        ? 'Votre candidature a été refusée. Contactez le support pour plus d\'informations.'
        : 'Votre candidature est en cours de validation par notre équipe. Vous pourrez passer en ligne une fois approuvé.'"
    >
      <template #icon>
        <Icon :name="rider.profile.applicationStatus === 'rejected' ? 'ph:x-circle' : 'ph:hourglass'" class="size-10 text-primary-500" />
      </template>
      <template #actions>
        <Button variant="outline" as-child><NuxtLink to="/rider/account">Compléter mon dossier</NuxtLink></Button>
      </template>
    </EmptyState>

    <!-- Active delivery -->
    <Card v-if="rider.activeDelivery" class="gap-4 p-4 sm:p-5">
      <CardHeader class="gap-2 p-0">
        <CardTitle class="flex items-center justify-between gap-3 text-h4">
          <span class="flex min-w-0 items-center gap-2">
            <Icon name="ph:truck" class="size-5 shrink-0 text-primary-600" />
            <span class="truncate">Livraison en cours · {{ rider.activeDelivery.reference }}</span>
          </span>
          <span class="shrink-0 text-primary-600">{{ eur(rider.activeDelivery.riderFee) }}</span>
        </CardTitle>
        <div class="flex flex-wrap items-center gap-2">
          <CardDescription>{{ DELIVERY_STATUS_LABEL[rider.activeDelivery.status] }}</CardDescription>
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

      <CardContent class="space-y-4 p-0 text-body-sm">
        <div class="space-y-2">
          <p class="flex items-start gap-2.5">
            <Icon name="ph:package" class="mt-0.5 size-4 shrink-0 text-text-muted" />
            <span><span class="font-medium text-text-primary">Retrait :</span> {{ rider.activeDelivery.pickupAddress }}</span>
          </p>
          <p class="flex items-start gap-2.5">
            <Icon name="ph:map-pin" class="mt-0.5 size-4 shrink-0 text-text-muted" />
            <span><span class="font-medium text-text-primary">Livraison :</span> {{ rider.activeDelivery.dropoffAddress }}</span>
          </p>
        </div>

        <!-- Contenu du colis -->
        <div v-if="rider.activeDelivery.items?.length" class="space-y-2 border-t border-neutral-200 pt-4">
          <p class="text-caption font-medium uppercase tracking-wide text-text-muted">Contenu du colis</p>
          <ul class="space-y-2">
            <li v-for="item in previewItems(rider.activeDelivery)" :key="item.id" class="flex items-center gap-3">
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
          <p v-if="hiddenItems(rider.activeDelivery)" class="text-caption text-text-muted">
            + {{ hiddenItems(rider.activeDelivery) }} autre{{ hiddenItems(rider.activeDelivery) > 1 ? 's' : '' }} article{{ hiddenItems(rider.activeDelivery) > 1 ? 's' : '' }}
          </p>
        </div>

        <!-- Code de ramassage : remis de la main a la main par le comptoir, jamais affiche -->
        <div v-if="needsPickupCode" class="space-y-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
          <label for="pickup-code" class="block font-medium text-text-primary">Code de ramassage</label>
          <p class="text-caption text-text-muted">Le comptoir de l'entrepôt vous le remet avec le colis.</p>
          <Input
            id="pickup-code"
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
            aria-describedby="pickup-code-help"
            @update:model-value="onPickupCodeInput"
          />
          <p id="pickup-code-help" class="text-caption text-text-muted">{{ PICKUP_CODE_LENGTH }} caractères.</p>
        </div>

        <p v-if="advanceError" role="alert" class="flex items-start gap-2 text-error">
          <Icon name="ph:warning-circle" class="mt-0.5 size-4 shrink-0" />
          <span>{{ advanceError }}</span>
        </p>

        <!-- meme formulation que /rider/deliveries : le livreur doit savoir que sa position part -->
        <div v-if="gpsSharing" class="flex items-center gap-2 rounded-lg bg-success/10 px-3 py-2 text-body-sm text-success">
          <span class="relative flex size-2">
            <span class="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-75" />
            <span class="relative inline-flex size-2 rounded-full bg-success" />
          </span>
          Position partagée en direct avec le client
        </div>
      </CardContent>

      <CardFooter class="flex flex-wrap gap-2 p-0">
        <Button v-if="nextStep" :disabled="advancing || (needsPickupCode && !pickupCodeFilled)" @click="advance">
          <Icon name="ph:check-circle" class="mr-2 size-4" /> {{ nextStep.label }}
        </Button>
        <Button variant="ghost" as-child><NuxtLink to="/rider/deliveries">Détails & historique</NuxtLink></Button>
      </CardFooter>
    </Card>

    <!-- Offline notice -->
    <EmptyState
      v-else-if="rider.isApproved && !rider.isOnline"
      title="Vous êtes hors ligne"
      description="Passez en ligne pour voir les commandes disponibles près de vous."
    >
      <template #icon>
        <Icon name="ph:moon" class="size-10 text-primary-500" />
      </template>
      <template #actions>
        <Button :disabled="toggling" @click="toggleOnline">
          <Icon name="ph:wifi-high" class="mr-2 size-4" /> Passer en ligne
        </Button>
      </template>
    </EmptyState>

    <!-- Available orders -->
    <section v-if="rider.isOnline && !rider.activeDelivery" class="space-y-3">
      <h2 class="text-h4 font-semibold text-text-primary">Commandes disponibles ({{ rider.available.length }})</h2>
      <EmptyState
        v-if="rider.available.length === 0"
        title="Aucune commande disponible pour le moment"
        description="Restez en ligne, on vous préviendra."
      >
        <template #icon>
          <Icon name="ph:hourglass" class="size-10 text-primary-500" />
        </template>
      </EmptyState>
      <Card v-for="o in rider.available" :key="o.id" class="gap-3 p-4" data-testid="available-order">
        <CardHeader class="gap-1 p-0">
          <CardTitle class="flex items-center justify-between gap-3 text-body font-semibold">
            <span class="truncate">{{ o.reference }}</span>
            <span class="shrink-0 text-primary-600">{{ eur(o.riderFee) }}</span>
          </CardTitle>
          <CardDescription v-if="remaining(o.assignmentExpiresAt)">Expire dans {{ remaining(o.assignmentExpiresAt) }}</CardDescription>
        </CardHeader>
        <CardContent class="space-y-3 p-0 text-body-sm">
          <div class="space-y-1.5">
            <p class="flex items-start gap-2.5">
              <Icon name="ph:package" class="mt-0.5 size-4 shrink-0 text-text-muted" />
              <span>{{ o.pickupAddress }}</span>
            </p>
            <p class="flex items-start gap-2.5">
              <Icon name="ph:map-pin" class="mt-0.5 size-4 shrink-0 text-text-muted" />
              <span>{{ o.dropoffAddress }}</span>
            </p>
          </div>
          <ul v-if="o.items?.length" class="space-y-2 border-t border-neutral-200 pt-3">
            <li v-for="item in previewItems(o)" :key="item.id" class="flex items-center gap-3">
              <span class="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
                <ProductImage
                  :src="item.imageUrl"
                  :alt="item.name"
                  fallback-icon="ph:package"
                  img-class="size-full object-cover"
                  icon-class="size-4 text-neutral-400"
                />
              </span>
              <span class="min-w-0 flex-1 truncate text-text-primary">{{ item.name }}</span>
              <span class="shrink-0 text-text-muted">×{{ item.quantity }}</span>
            </li>
            <li v-if="hiddenItems(o)" class="text-caption text-text-muted">
              + {{ hiddenItems(o) }} autre{{ hiddenItems(o) > 1 ? 's' : '' }} article{{ hiddenItems(o) > 1 ? 's' : '' }}
            </li>
          </ul>
        </CardContent>
        <CardFooter class="flex flex-wrap gap-2 p-0">
          <Button :disabled="busyId === o.id" @click="accept(o.id)">Accepter</Button>
          <Button variant="outline" :disabled="busyId === o.id" @click="decline(o.id)">Refuser</Button>
        </CardFooter>
      </Card>
    </section>
  </div>
</template>
