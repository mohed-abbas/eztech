<script setup lang="ts">
import type { Address } from '~/stores/auth'

definePageMeta({ layout: 'default', middleware: 'auth' })

const cart = useCartStore()
cart.hydrate()
const { items, subtotal, deliveryFee, total, isEmpty } = storeToRefs(cart)
const { clearCart, linePrice } = cart
const auth = useAuthStore()
const { user } = storeToRefs(auth)
const { check: checkZone } = useServiceZone()
// Redirect to cart if empty
onMounted(() => {
  if (isEmpty.value) navigateTo('/cart', { replace: true })
})

// --- Address selection ---
type AddressMode = 'saved' | 'manual' | 'geo'
const addressMode = ref<AddressMode>('saved')
const selectedSavedId = ref<string | null>(user.value?.addresses?.[0]?.id ?? null)

const savedAddresses = computed<Address[]>(() => user.value?.addresses ?? [])

const manualStreet = ref('')
const manualCity = ref('Paris')
const manualZip = ref('')
const manualLat = ref<number | null>(null)
const manualLng = ref<number | null>(null)

const geoLoading = ref(false)
const geoError = ref<string | null>(null)

function useCurrentLocation() {
  if (!('geolocation' in navigator)) {
    geoError.value = 'Géolocalisation non supportée par votre navigateur.'
    return
  }
  geoError.value = null
  geoLoading.value = true
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      manualLat.value = pos.coords.latitude
      manualLng.value = pos.coords.longitude
      addressMode.value = 'geo'
      geoLoading.value = false
    },
    (err) => {
      geoError.value = `Impossible d'obtenir votre position : ${err.message}`
      geoLoading.value = false
    },
    { enableHighAccuracy: true, timeout: 10000 },
  )
}

// Resolve currently selected coordinates + printable address
interface ResolvedAddress {
  street: string
  city: string
  zipCode: string
  coordinates: { lat: number, lng: number } | null
}

const resolvedAddress = computed<ResolvedAddress | null>(() => {
  if (addressMode.value === 'saved') {
    const saved = savedAddresses.value.find(a => a.id === selectedSavedId.value)
    if (!saved) return null
    return {
      street: saved.street,
      city: saved.city,
      zipCode: saved.zipCode,
      coordinates: saved.coordinates ?? null,
    }
  }
  if (addressMode.value === 'geo') {
    if (manualLat.value == null || manualLng.value == null) return null
    return {
      street: 'Position actuelle',
      city: 'Paris',
      zipCode: '',
      coordinates: { lat: manualLat.value, lng: manualLng.value },
    }
  }
  // manual
  if (!manualStreet.value || !manualZip.value) return null
  return {
    street: manualStreet.value,
    city: manualCity.value,
    zipCode: manualZip.value,
    coordinates: manualLat.value != null && manualLng.value != null
      ? { lat: manualLat.value, lng: manualLng.value }
      : null,
  }
})

// Zone check — only runs when we have coordinates
const zoneResult = computed(() => {
  const addr = resolvedAddress.value
  if (!addr?.coordinates) return null
  return checkZone(addr.coordinates.lng, addr.coordinates.lat)
})

const canProceed = computed(() => {
  if (!resolvedAddress.value) return false
  // For manual without coordinates, allow (no zone check possible — mock fallback)
  if (!resolvedAddress.value.coordinates) return true
  return zoneResult.value?.inZone === true
})

// --- Card form ---
const monoInputClass = 'w-full bg-white border border-neutral-200 rounded-[--radius-md] px-4 py-3 text-body text-text-primary font-mono placeholder:text-text-muted outline-none focus:ring-2 focus:ring-primary-400/30 focus:border-primary-500 transition'

const cardNumber = ref('')
const cardExpiry = ref('')
const cardCvc = ref('')
const cardName = ref('')

function formatCardNumber(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 16)
  return digits.replace(/(.{4})/g, '$1 ').trim()
}
function onCardNumberInput(e: Event) {
  const input = e.target as HTMLInputElement
  cardNumber.value = formatCardNumber(input.value)
  input.value = cardNumber.value
}
function formatExpiry(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 4)
  if (digits.length >= 3) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return digits
}
function onExpiryInput(e: Event) {
  const input = e.target as HTMLInputElement
  cardExpiry.value = formatExpiry(input.value)
  input.value = cardExpiry.value
}
function onCvcInput(e: Event) {
  const input = e.target as HTMLInputElement
  cardCvc.value = input.value.replace(/\D/g, '').slice(0, 3)
  input.value = cardCvc.value
}

const cardBrand = computed(() => {
  const d = cardNumber.value.replace(/\s/g, '')
  if (d.startsWith('4')) return 'Visa'
  if (d.startsWith('5')) return 'Mastercard'
  if (d.startsWith('3')) return 'Amex'
  return null
})

// --- Payment flow ---
type PaymentState = 'idle' | 'loading' | 'success' | 'error'
const paymentState = ref<PaymentState>('idle')

const formComplete = computed(() =>
  !!(cardNumber.value && cardExpiry.value && cardCvc.value && cardName.value && canProceed.value),
)

const ordersStore = useOrdersStore()
ordersStore.hydrate()

function createMockOrder() {
  const addr = resolvedAddress.value
  if (!addr) return ''
  const order = ordersStore.createOrder({
    items: items.value.map(i => ({
      productId: i.productId,
      name: i.name,
      quantity: i.quantity,
      duration: { type: i.durationUnit, value: i.durationValue },
      unitPrice: i.pricingType === 'flat'
        ? (i.price.flat ?? 0)
        : (i.price[i.durationUnit as 'hourly' | 'daily' | 'weekly'] ?? 0),
      total: linePrice(i),
    })),
    deliveryAddress: { ...addr, coordinates: addr.coordinates ?? undefined },
    subtotal: subtotal.value,
    deliveryFee: deliveryFee.value,
    total: total.value,
    userId: user.value?.id,
  })

  // Simulate the full delivery cycle (advances every 3s)
  ordersStore.simulateDelivery(order.id)

  return order.id
}

function submitPayment() {
  if (!formComplete.value) return
  paymentState.value = 'loading'

  setTimeout(() => {
    const digits = cardNumber.value.replace(/\s/g, '')
    if (digits.endsWith('0000')) {
      paymentState.value = 'error'
      return
    }
    paymentState.value = 'success'
    const orderId = createMockOrder()
    clearCart()
    setTimeout(() => navigateTo(`/orders/${orderId}`), 1200)
  }, 2000)
}

function retryPayment() {
  paymentState.value = 'idle'
}

// --- Step indicator ---
const currentStep = computed(() => {
  if (!resolvedAddress.value) return 1
  if (!formComplete.value) return 2
  return 3
})

const steps = [
  { num: 1, label: 'Adresse' },
  { num: 2, label: 'Paiement' },
  { num: 3, label: 'Confirmation' },
]
</script>

<template>
  <div class="min-h-screen bg-background">
    <!-- SUCCESS OVERLAY -->
    <Transition name="success">
      <div v-if="paymentState === 'success'" class="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/60 backdrop-blur-sm">
        <div class="text-center">
          <div class="mx-auto mb-6 flex size-24 items-center justify-center rounded-full bg-success/15 ring-4 ring-success/10 animate-success-pop">
            <Icon name="ph:check-circle-fill" class="size-12 text-success" />
          </div>
          <h1 class="text-h2 font-bold text-white mb-2">Paiement réussi !</h1>
          <p class="text-body text-neutral-300">Redirection vers votre commande…</p>
        </div>
      </div>
    </Transition>

    <!-- CHECKOUT HEADER -->
    <div class="relative overflow-hidden bg-section-dark px-6 py-10 sm:px-10 sm:py-14">
      <div class="pointer-events-none absolute -right-20 -top-20 size-80 rounded-full bg-primary-500/15 blur-3xl" />
      <div class="pointer-events-none absolute -bottom-10 -left-10 size-64 rounded-full bg-accent-500/10 blur-2xl" />
      <div class="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-96 rounded-full bg-primary-600/5 blur-3xl" />

      <div class="relative mx-auto max-w-7xl">
        <!-- Back link pill -->
        <NuxtLink
          to="/cart"
          class="mb-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-body-sm font-medium text-neutral-300 backdrop-blur-sm transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400/50"
        >
          <Icon name="ph:arrow-left" class="size-4" />
          Retour au panier
        </NuxtLink>

        <div class="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 class="text-h1 font-semibold text-white">Paiement sécurisé</h1>
            <p class="mt-2 text-body text-neutral-400">
              Finalisez votre commande en quelques étapes
            </p>
          </div>

          <!-- Step Progress -->
          <div class="hidden items-center gap-2 sm:flex">
            <template v-for="(step, idx) in steps" :key="step.num">
              <div
                class="flex items-center gap-2.5 rounded-full px-4 py-2.5 text-body-sm font-medium transition-all duration-300"
                :class="[
                  currentStep >= step.num
                    ? 'bg-primary-500/25 text-white border border-primary-400/20'
                    : 'bg-white/5 text-neutral-500 border border-white/5',
                ]"
              >
                <div
                  class="flex size-6 items-center justify-center rounded-full transition-all duration-300"
                  :class="[
                    currentStep > step.num ? 'bg-success text-white' : '',
                    currentStep === step.num ? 'bg-primary-500 text-white' : '',
                    currentStep < step.num ? 'bg-white/10 text-neutral-500' : '',
                  ]"
                >
                  <Icon v-if="currentStep > step.num" name="ph:check-bold" class="size-3.5" />
                  <span v-else class="text-caption font-bold">{{ step.num }}</span>
                </div>
                <span class="hidden lg:inline">{{ step.label }}</span>
              </div>
              <div
                v-if="idx < steps.length - 1"
                class="h-px w-6 transition-colors duration-300"
                :class="currentStep > step.num ? 'bg-primary-400/50' : 'bg-white/10'"
              />
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- MAIN CONTENT -->
    <div class="mx-auto max-w-7xl px-6 py-10 sm:px-10">
      <div class="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <!-- LEFT COLUMN: Address + Payment -->
        <div class="lg:col-span-8 space-y-6">

          <!-- ADDRESS SECTION -->
          <Card class="overflow-hidden">
            <div class="border-b border-neutral-100 bg-surface-purple px-6 py-4">
              <div class="flex items-center gap-3">
                <div class="flex size-9 items-center justify-center rounded-xl bg-primary-100">
                  <Icon name="ph:map-pin-fill" class="size-5 text-primary-600" />
                </div>
                <div>
                  <h2 class="text-body font-semibold text-text-primary">Adresse de livraison</h2>
                  <p class="text-caption text-text-muted">Sélectionnez ou saisissez votre adresse</p>
                </div>
                <div v-if="resolvedAddress" class="ml-auto">
                  <span class="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-caption font-medium text-success">
                    <Icon name="ph:check-circle-fill" class="size-3.5" />
                    Renseignée
                  </span>
                </div>
              </div>
            </div>

            <div class="p-6">
              <!-- Address Mode Tabs -->
              <div class="flex flex-wrap gap-2 mb-5">
                <Button
                  v-if="savedAddresses.length > 0"
                  :variant="addressMode === 'saved' ? 'default' : 'outline'"
                  size="sm"
                  class="gap-1.5"
                  @click="addressMode = 'saved'"
                >
                  <Icon name="ph:bookmark-simple" class="size-4" />
                  Mes adresses
                </Button>
                <Button
                  :variant="addressMode === 'manual' ? 'default' : 'outline'"
                  size="sm"
                  class="gap-1.5"
                  @click="addressMode = 'manual'"
                >
                  <Icon name="ph:pencil-simple" class="size-4" />
                  Saisir manuellement
                </Button>
                <Button
                  :variant="addressMode === 'geo' ? 'default' : 'outline'"
                  size="sm"
                  class="gap-1.5"
                  :disabled="geoLoading"
                  @click="useCurrentLocation"
                >
                  <Icon name="ph:crosshair" class="size-4" :class="geoLoading ? 'animate-spin' : ''" />
                  {{ geoLoading ? 'Localisation...' : 'Ma position' }}
                </Button>
              </div>

              <!-- Saved -->
              <div v-if="addressMode === 'saved'" class="space-y-2">
                <AddressCard
                  v-for="addr in savedAddresses"
                  :key="addr.id"
                  :address="addr"
                  :selected="selectedSavedId === addr.id"
                  @select="(id: string) => selectedSavedId = id"
                />
                <p v-if="savedAddresses.length === 0" class="text-sm text-text-muted py-4 text-center">
                  Aucune adresse enregistrée.
                  <Button variant="link" size="sm" class="px-0 h-auto" @click="addressMode = 'manual'">Saisir manuellement</Button>
                </p>
              </div>

              <!-- Manual -->
              <div v-else-if="addressMode === 'manual'" class="space-y-4">
                <FormField id="manual-street" label="Rue" required>
                  <template #default="{ id }">
                    <Input :id="id" v-model="manualStreet" type="text" placeholder="12 Rue de Rivoli" />
                  </template>
                </FormField>
                <div class="grid grid-cols-2 gap-4">
                  <FormField id="manual-zip" label="Code postal" required>
                    <template #default="{ id }">
                      <Input :id="id" v-model="manualZip" type="text" placeholder="75004" />
                    </template>
                  </FormField>
                  <FormField id="manual-city" label="Ville">
                    <template #default="{ id }">
                      <Input :id="id" v-model="manualCity" type="text" />
                    </template>
                  </FormField>
                </div>
              </div>

              <!-- Geo -->
              <div v-else class="rounded-xl bg-primary-50 border border-primary-100 p-5 flex items-center gap-4">
                <div class="flex size-10 items-center justify-center rounded-full bg-primary-100">
                  <Icon name="ph:gps-fix" class="size-5 text-primary-600" />
                </div>
                <div>
                  <p v-if="manualLat != null" class="text-sm font-medium text-primary-700">
                    Position actuelle détectée
                  </p>
                  <p v-if="manualLat != null" class="text-caption text-primary-600/70 font-mono">
                    {{ manualLat.toFixed(4) }}, {{ manualLng?.toFixed(4) }}
                  </p>
                  <p v-else class="text-sm text-primary-700">En attente de votre position…</p>
                </div>
              </div>

              <p v-if="geoError" class="mt-3 text-sm text-error flex items-center gap-2">
                <Icon name="ph:warning-circle" class="size-4 shrink-0" />
                {{ geoError }}
              </p>

              <!-- Zone Feedback -->
              <div v-if="zoneResult" class="mt-4">
                <ZoneBadge :in-zone="zoneResult.inZone" :zone-name="zoneResult.zoneName" />
                <p v-if="!zoneResult.inZone" class="text-xs text-text-muted mt-2 ml-5">
                  Nous couvrons actuellement Paris Centre et Paris Est.
                </p>
              </div>
            </div>
          </Card>

          <!-- PAYMENT SECTION -->
          <Card class="overflow-hidden">
            <div class="border-b border-neutral-100 bg-surface-violet px-6 py-4">
              <div class="flex items-center gap-3">
                <div class="flex size-9 items-center justify-center rounded-xl bg-accent-100">
                  <Icon name="ph:credit-card-fill" class="size-5 text-accent-600" />
                </div>
                <div>
                  <h2 class="text-body font-semibold text-text-primary">Informations de paiement</h2>
                  <p class="text-caption text-text-muted">Chiffrement SSL 256-bit</p>
                </div>
                <div class="ml-auto flex items-center gap-2">
                  <span class="text-caption text-text-muted font-mono tracking-wider opacity-60">VISA</span>
                  <span class="text-caption text-text-muted font-mono tracking-wider opacity-60">MC</span>
                  <span class="text-caption text-text-muted font-mono tracking-wider opacity-60">AMEX</span>
                </div>
              </div>
            </div>

            <div class="p-6 space-y-4">
              <FormField id="card-name" label="Nom sur la carte" required>
                <template #default="{ id }">
                  <Input :id="id" v-model="cardName" type="text" placeholder="Jean Dupont" />
                </template>
              </FormField>

              <FormField id="card-number" label="Numéro de carte" required>
                <template #default="{ id }">
                  <div class="relative">
                    <input
                      :id="id"
                      :value="cardNumber"
                      type="text"
                      placeholder="4242 4242 4242 4242"
                      maxlength="19"
                      :class="[monoInputClass, 'pr-20']"
                      @input="onCardNumberInput"
                    >
                    <Transition name="brand-fade">
                      <span
                        v-if="cardBrand"
                        class="absolute right-3 top-1/2 -translate-y-1/2 rounded-md bg-primary-50 border border-primary-100 px-2.5 py-1 text-caption font-bold text-primary-700 font-mono tracking-wider"
                      >
                        {{ cardBrand }}
                      </span>
                    </Transition>
                  </div>
                </template>
              </FormField>

              <div class="grid grid-cols-2 gap-4">
                <FormField id="card-expiry" label="Date d'expiration" required>
                  <template #default="{ id }">
                    <input
                      :id="id"
                      :value="cardExpiry"
                      type="text"
                      placeholder="MM/AA"
                      maxlength="5"
                      :class="monoInputClass"
                      @input="onExpiryInput"
                    >
                  </template>
                </FormField>
                <FormField id="card-cvc" label="CVC" required>
                  <template #default="{ id }">
                    <input
                      :id="id"
                      :value="cardCvc"
                      type="text"
                      placeholder="123"
                      maxlength="3"
                      :class="monoInputClass"
                      @input="onCvcInput"
                    >
                  </template>
                </FormField>
              </div>

              <!-- Error State -->
              <Transition name="fade">
                <div
                  v-if="paymentState === 'error'"
                  class="flex items-start gap-3 rounded-xl bg-error/5 border border-error/20 p-4"
                >
                  <div class="flex size-8 items-center justify-center rounded-full bg-error/10 shrink-0 mt-0.5">
                    <Icon name="ph:x-circle-fill" class="size-5 text-error" />
                  </div>
                  <div class="flex-1">
                    <p class="text-sm font-semibold text-error">Paiement refusé</p>
                    <p class="text-sm text-text-muted mt-0.5">Votre carte a été refusée. Vérifiez les informations ou utilisez une autre carte.</p>
                    <Button variant="link" size="sm" class="mt-2 px-0 h-auto" @click="retryPayment">
                      Réessayer
                    </Button>
                  </div>
                </div>
              </Transition>

              <!-- Test hint -->
              <div class="rounded-lg bg-neutral-50 border border-neutral-100 px-4 py-3 flex items-center gap-3">
                <Icon name="ph:flask" class="size-4 text-text-muted shrink-0" />
                <p class="text-caption text-text-muted">
                  Test : <code class="bg-white px-1.5 py-0.5 rounded text-primary-600 font-mono border border-neutral-200">4242 4242 4242 4242</code> → succès ·
                  <code class="bg-white px-1.5 py-0.5 rounded text-error font-mono border border-neutral-200">...0000</code> → échec
                </p>
              </div>
            </div>
          </Card>

          <!-- TRUST BAR -->
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div class="rounded-xl rounded-tl-feature bg-surface-purple border border-primary-100 p-4 flex items-center gap-3">
              <div class="flex size-10 items-center justify-center rounded-full bg-primary-100">
                <Icon name="ph:shield-check" class="size-5 text-primary-600" />
              </div>
              <div>
                <p class="text-body-sm font-semibold text-text-primary">Paiement sécurisé</p>
                <p class="text-caption text-text-muted">Chiffrement SSL 256-bit</p>
              </div>
            </div>
            <div class="rounded-xl rounded-tr-feature bg-surface-violet border border-accent-100 p-4 flex items-center gap-3">
              <div class="flex size-10 items-center justify-center rounded-full bg-accent-100">
                <Icon name="ph:arrows-clockwise" class="size-5 text-accent-600" />
              </div>
              <div>
                <p class="text-body-sm font-semibold text-text-primary">Annulation gratuite</p>
                <p class="text-caption text-text-muted">Avant la livraison</p>
              </div>
            </div>
            <div class="rounded-xl rounded-bl-feature bg-surface-lavender border border-primary-100 p-4 flex items-center gap-3">
              <div class="flex size-10 items-center justify-center rounded-full bg-primary-100">
                <Icon name="ph:lightning" class="size-5 text-primary-600" />
              </div>
              <div>
                <p class="text-body-sm font-semibold text-text-primary">Livraison rapide</p>
                <p class="text-caption text-text-muted">En 30 min ou moins</p>
              </div>
            </div>
            <div class="rounded-xl rounded-br-feature bg-surface-lilac border border-primary-100 p-4 flex items-center gap-3">
              <div class="flex size-10 items-center justify-center rounded-full bg-primary-100">
                <Icon name="ph:headset" class="size-5 text-primary-600" />
              </div>
              <div>
                <p class="text-body-sm font-semibold text-text-primary">Support 7j/7</p>
                <p class="text-caption text-text-muted">Assistance dédiée</p>
              </div>
            </div>
          </div>
        </div>

        <!-- RIGHT COLUMN: Order Summary -->
        <div class="lg:col-span-4">
          <div class="sticky top-6 space-y-4">
            <!-- Order Items -->
            <Card class="overflow-hidden">
              <div class="border-b border-neutral-100 bg-surface-lavender px-6 py-4">
                <div class="flex items-center justify-between">
                  <h2 class="text-body font-semibold text-text-primary">Votre commande</h2>
                  <span class="inline-flex items-center gap-1.5 rounded-full bg-primary-50 border border-primary-100 px-2.5 py-1 text-caption font-medium text-primary-600">
                    <Icon name="ph:package" class="size-3.5" />
                    {{ items.length }} article{{ items.length > 1 ? 's' : '' }}
                  </span>
                </div>
              </div>

              <div class="divide-y divide-neutral-50">
                <div
                  v-for="item in items"
                  :key="item.productId"
                  class="flex items-center gap-3 px-6 py-4"
                >
                  <div class="flex size-12 items-center justify-center rounded-xl bg-surface-purple border border-primary-50 shrink-0">
                    <Icon name="ph:cube" class="size-6 text-primary-400" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-body-sm font-medium text-text-primary truncate">
                      {{ item.name }}
                    </p>
                    <div class="flex items-center gap-2 mt-0.5">
                      <span class="text-caption text-text-muted">
                        Qté {{ item.quantity }}
                      </span>
                      <span v-if="item.pricingType === 'tiered'" class="text-caption text-text-muted">
                        · {{ item.durationValue }}
                        {{ item.durationUnit === 'hourly' ? 'h' : item.durationUnit === 'daily' ? 'jour(s)' : 'sem.' }}
                      </span>
                    </div>
                  </div>
                  <span class="text-body-sm font-semibold text-text-primary whitespace-nowrap">
                    {{ linePrice(item).toFixed(2) }}€
                  </span>
                </div>
              </div>
            </Card>

            <!-- Price Summary -->
            <PriceSummary
              title="Total"
              :subtotal="subtotal"
              :delivery-fee="deliveryFee"
              :total="total"
            >
              <template #actions>
                <Button
                  variant="gradient"
                  size="pill"
                  class="w-full py-3.5 font-semibold gap-2"
                  :disabled="!formComplete || paymentState === 'loading'"
                  @click="submitPayment"
                >
                  <Icon
                    v-if="paymentState === 'loading'"
                    name="ph:spinner"
                    class="size-5 animate-spin"
                  />
                  <Icon v-else name="ph:lock-simple-fill" class="size-4" />
                  {{ paymentState === 'loading' ? 'Traitement...' : `Payer ${total.toFixed(2)} \u20AC` }}
                </Button>
              </template>
              <template #footer>
                <div class="flex items-center justify-center gap-1.5">
                  <Icon name="ph:shield-check" class="size-3.5 text-text-muted" />
                  Paiement sécurisé · Annulation gratuite
                </div>
              </template>
            </PriceSummary>

            <!-- Delivery Info Card -->
            <div class="rounded-2xl bg-surface-lilac border border-primary-100 p-5">
              <div class="flex items-center gap-3 mb-3">
                <div class="flex size-9 items-center justify-center rounded-full bg-primary-500 text-white">
                  <Icon name="ph:truck" class="size-4" />
                </div>
                <div>
                  <p class="text-body-sm font-semibold text-text-primary">Livraison express</p>
                  <p class="text-caption text-text-muted">Estimée en ~30 minutes</p>
                </div>
              </div>
              <Separator class="my-3" />
              <div class="space-y-2">
                <div class="flex items-center gap-2 text-caption text-text-secondary">
                  <Icon name="ph:check" class="size-3.5 text-success" />
                  Suivi en temps réel
                </div>
                <div class="flex items-center gap-2 text-caption text-text-secondary">
                  <Icon name="ph:check" class="size-3.5 text-success" />
                  Notification à chaque étape
                </div>
                <div class="flex items-center gap-2 text-caption text-text-secondary">
                  <Icon name="ph:check" class="size-3.5 text-success" />
                  Contact direct avec le livreur
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.success-enter-active { transition: opacity 0.4s ease; }
.success-leave-active { transition: opacity 0.3s ease; }
.success-enter-from, .success-leave-to { opacity: 0; }

.brand-fade-enter-active { transition: all 0.2s ease-out; }
.brand-fade-leave-active { transition: all 0.15s ease-in; }
.brand-fade-enter-from { opacity: 0; transform: translateY(-50%) scale(0.9); }
.brand-fade-leave-to { opacity: 0; transform: translateY(-50%) scale(0.9); }

@keyframes success-pop {
  0% { transform: scale(0.5); opacity: 0; }
  60% { transform: scale(1.1); }
  100% { transform: scale(1); opacity: 1; }
}

.animate-success-pop {
  animation: success-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}
</style>
