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
const router = useRouter()

// Redirect to cart if empty
onMounted(() => {
  if (isEmpty.value) router.replace('/cart')
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
  cardNumber.value && cardExpiry.value && cardCvc.value && cardName.value && canProceed.value,
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
</script>

<template>
  <div class="min-h-screen bg-bg-muted py-10 px-4">
    <!-- SUCCESS -->
    <Transition name="fade">
      <div v-if="paymentState === 'success'" class="max-w-md mx-auto text-center py-20">
        <div class="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-6">
          <svg class="w-10 h-10 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 class="text-h3 font-bold text-text-primary mb-2">Paiement réussi !</h1>
        <p class="text-text-muted">Redirection vers votre commande…</p>
      </div>
    </Transition>

    <div v-if="paymentState !== 'success'" class="max-w-5xl mx-auto">
      <div class="mb-8 flex items-center gap-3">
        <NuxtLink to="/cart" class="text-text-muted hover:text-text-primary transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </NuxtLink>
        <h1 class="text-h3 font-bold text-text-primary">Paiement sécurisé</h1>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <!-- Main column (3/5): address + card -->
        <div class="lg:col-span-3 space-y-5">
          <!-- ADDRESS CARD -->
          <Card class="p-6">
            <h2 class="font-semibold text-text-primary mb-4 flex items-center gap-2">
              <svg class="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Adresse de livraison
            </h2>

            <!-- Mode tabs -->
            <div class="flex flex-wrap gap-2 mb-4">
              <Button
                v-if="savedAddresses.length > 0"
                :variant="addressMode === 'saved' ? 'default' : 'secondary'"
                size="sm"
                @click="addressMode = 'saved'"
              >
                Mes adresses
              </Button>
              <Button
                :variant="addressMode === 'manual' ? 'default' : 'secondary'"
                size="sm"
                @click="addressMode = 'manual'"
              >
                Saisir manuellement
              </Button>
              <Button
                :variant="addressMode === 'geo' ? 'default' : 'secondary'"
                size="sm"
                class="flex items-center gap-1.5"
                :disabled="geoLoading"
                @click="useCurrentLocation"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 11a3 3 0 100-6 3 3 0 000 6z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 2C8 2 4 5 4 9c0 5.5 8 13 8 13s8-7.5 8-13c0-4-4-7-8-7z" />
                </svg>
                {{ geoLoading ? 'Localisation...' : 'Ma position' }}
              </Button>
            </div>

            <!-- Saved mode -->
            <div v-if="addressMode === 'saved'" class="space-y-2">
              <AddressCard
                v-for="addr in savedAddresses"
                :key="addr.id"
                :address="addr"
                :selected="selectedSavedId === addr.id"
                @select="(id) => selectedSavedId = id"
              />
              <p v-if="savedAddresses.length === 0" class="text-sm text-text-muted">
                Aucune adresse enregistrée. Passez en saisie manuelle.
              </p>
            </div>

            <!-- Manual mode -->
            <div v-else-if="addressMode === 'manual'" class="space-y-3">
              <div>
                <label class="block text-sm font-medium text-text-secondary mb-1.5">Rue</label>
                <Input v-model="manualStreet" type="text" placeholder="12 Rue de Rivoli" class="rounded-xl" />
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-sm font-medium text-text-secondary mb-1.5">Code postal</label>
                  <Input v-model="manualZip" type="text" placeholder="75004" class="rounded-xl" />
                </div>
                <div>
                  <label class="block text-sm font-medium text-text-secondary mb-1.5">Ville</label>
                  <Input v-model="manualCity" type="text" class="rounded-xl" />
                </div>
              </div>
            </div>

            <!-- Geo mode -->
            <div v-else class="rounded-xl bg-primary-50 border border-primary-100 p-4">
              <p v-if="manualLat != null" class="text-sm text-primary-700">
                Position actuelle détectée :
                <span class="font-mono">{{ manualLat.toFixed(4) }}, {{ manualLng?.toFixed(4) }}</span>
              </p>
              <p v-else class="text-sm text-primary-700">En attente de votre position…</p>
            </div>

            <p v-if="geoError" class="mt-3 text-sm text-error">{{ geoError }}</p>

            <!-- Zone feedback -->
            <div v-if="zoneResult" class="mt-4">
              <ZoneBadge :in-zone="zoneResult.inZone" :zone-name="zoneResult.zoneName" />
              <p v-if="!zoneResult.inZone" class="text-xs text-text-muted mt-2">
                Nous couvrons actuellement Paris Centre et Paris Est.
              </p>
            </div>
          </Card>

          <!-- CARD FORM -->
          <Card class="p-6">
            <h2 class="font-semibold text-text-primary mb-5 flex items-center gap-2">
              <svg class="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              Informations de carte
            </h2>

            <div class="mb-4">
              <label class="block text-sm font-medium text-text-secondary mb-1.5">Nom sur la carte</label>
              <Input v-model="cardName" type="text" placeholder="Jean Dupont" class="rounded-xl" />
            </div>

            <div class="mb-4">
              <label class="block text-sm font-medium text-text-secondary mb-1.5">Numéro de carte</label>
              <div class="relative">
                <input
                  :value="cardNumber"
                  type="text"
                  placeholder="4242 4242 4242 4242"
                  maxlength="19"
                  class="w-full rounded-xl border border-neutral-200 px-4 py-3 pr-16 font-mono focus:outline-none focus:ring-2 focus:ring-primary-500"
                  @input="onCardNumberInput"
                >
                <span
                  v-if="cardBrand"
                  class="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-primary-600 bg-primary-50 px-2 py-0.5 rounded"
                >
                  {{ cardBrand }}
                </span>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-text-secondary mb-1.5">Date d'expiration</label>
                <input
                  :value="cardExpiry"
                  type="text"
                  placeholder="MM/AA"
                  maxlength="5"
                  class="w-full rounded-xl border border-neutral-200 px-4 py-3 font-mono focus:outline-none focus:ring-2 focus:ring-primary-500"
                  @input="onExpiryInput"
                >
              </div>
              <div>
                <label class="block text-sm font-medium text-text-secondary mb-1.5">CVC</label>
                <input
                  :value="cardCvc"
                  type="text"
                  placeholder="123"
                  maxlength="3"
                  class="w-full rounded-xl border border-neutral-200 px-4 py-3 font-mono focus:outline-none focus:ring-2 focus:ring-primary-500"
                  @input="onCvcInput"
                >
              </div>
            </div>

            <Transition name="fade">
              <div
                v-if="paymentState === 'error'"
                class="mt-5 flex items-start gap-3 rounded-xl bg-error/5 border border-error/20 p-4"
              >
                <svg class="w-5 h-5 text-error mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                </svg>
                <div>
                  <p class="text-sm font-medium text-error">Paiement refusé</p>
                  <p class="text-sm text-text-muted mt-0.5">Votre carte a été refusée. Vérifiez les informations ou utilisez une autre carte.</p>
                  <button
                    class="mt-2 text-sm font-medium text-primary-600 hover:text-primary-700 underline"
                    @click="retryPayment"
                  >
                    Réessayer
                  </button>
                </div>
              </div>
            </Transition>

            <Button
              variant="default"
              size="lg"
              class="mt-6 w-full rounded-xl py-4 font-semibold gap-3"
              :class="paymentState === 'loading' ? '!bg-primary-400' : ''"
              :disabled="!formComplete || paymentState === 'loading'"
              @click="submitPayment"
            >
              <svg
                v-if="paymentState === 'loading'"
                class="w-5 h-5 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {{ paymentState === 'loading' ? 'Traitement en cours...' : `Payer ${total.toFixed(2)} \u20AC` }}
            </Button>

            <p class="text-center text-xs text-text-muted mt-3">
              Test : <code class="bg-neutral-100 px-1 rounded">4242 4242 4242 4242</code> → succès ·
              <code class="bg-neutral-100 px-1 rounded">4242 4242 4242 0000</code> → échec
            </p>
          </Card>
        </div>

        <!-- Summary (2/5) -->
        <div class="lg:col-span-2">
          <div class="sticky top-6 space-y-4">
            <Card class="p-6">
              <h2 class="font-semibold text-text-primary mb-5">
                Articles
              </h2>
              <div class="space-y-3">
                <div
                  v-for="item in items"
                  :key="item.productId"
                  class="flex items-center gap-3"
                >
                  <div class="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center shrink-0">
                    <svg class="w-5 h-5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
                    </svg>
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-text-primary truncate">
                      {{ item.name }}
                    </p>
                    <p class="text-xs text-text-muted">
                      Qté {{ item.quantity }}
                      <span v-if="item.pricingType === 'tiered'"> · {{ item.durationValue }} {{ item.durationUnit === 'hourly' ? 'h' : item.durationUnit === 'daily' ? 'jour(s)' : 'sem.' }}</span>
                    </p>
                  </div>
                  <span class="text-sm font-semibold text-text-primary whitespace-nowrap">
                    {{ linePrice(item).toFixed(2) }} €
                  </span>
                </div>
              </div>
            </Card>

            <PriceSummary
              title="Total"
              :subtotal="subtotal"
              :delivery-fee="deliveryFee"
              :total="total"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
