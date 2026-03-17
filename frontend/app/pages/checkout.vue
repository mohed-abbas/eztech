<script setup lang="ts">
definePageMeta({ layout: 'default' })

// --- Formulaire paiement ---
const cardNumber = ref('')
const cardExpiry = ref('')
const cardCvc = ref('')
const cardName = ref('')

// Formatage numéro carte : 4242 4242 4242 4242
function formatCardNumber(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 16)
  return digits.replace(/(.{4})/g, '$1 ').trim()
}

function onCardNumberInput(e: Event) {
  const input = e.target as HTMLInputElement
  cardNumber.value = formatCardNumber(input.value)
  input.value = cardNumber.value
}

// Formatage expiration : MM/AA
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

// --- État du paiement ---
type PaymentState = 'idle' | 'loading' | 'success' | 'error'
const paymentState = ref<PaymentState>('idle')

function submitPayment() {
  if (!cardNumber.value || !cardExpiry.value || !cardCvc.value || !cardName.value) return
  paymentState.value = 'loading'

  setTimeout(() => {
    // Simuler succès / échec : carte "0000" → échec
    const digits = cardNumber.value.replace(/\s/g, '')
    if (digits.endsWith('0000')) {
      paymentState.value = 'error'
    } else {
      paymentState.value = 'success'
      setTimeout(() => navigateTo('/orders/mock-123'), 1500)
    }
  }, 2500)
}

function retryPayment() {
  paymentState.value = 'idle'
}

// --- Panier mock ---
const cartItems = [
  { name: 'iPhone 15 Pro 256Go', qty: 1, price: 1199, image: '📱' },
  { name: 'Coque MagSafe transparente', qty: 2, price: 29, image: '🛡️' },
  { name: 'Chargeur USB-C 30W', qty: 1, price: 49, image: '🔌' },
]
const rentalDays = 3
const subtotal = computed(() => cartItems.reduce((s, i) => s + i.price * i.qty, 0))
const deliveryFee = 4.99
const total = computed(() => subtotal.value + deliveryFee)

// Détection type de carte
const cardBrand = computed(() => {
  const d = cardNumber.value.replace(/\s/g, '')
  if (d.startsWith('4')) return 'Visa'
  if (d.startsWith('5')) return 'Mastercard'
  if (d.startsWith('3')) return 'Amex'
  return null
})
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

    <!-- FORM -->
    <div v-if="paymentState !== 'success'" class="max-w-5xl mx-auto">
      <div class="mb-8 flex items-center gap-3">
        <NuxtLink to="/cart" class="text-text-muted hover:text-text-primary transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </NuxtLink>
        <h1 class="text-h3 font-bold text-text-primary">Paiement sécurisé</h1>
        <span class="ml-auto flex items-center gap-1.5 text-sm text-text-muted">
          <svg class="w-4 h-4 text-success" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
          </svg>
          Paiement sécurisé SSL
        </span>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-5 gap-8">

        <!-- Formulaire paiement (3/5) -->
        <div class="lg:col-span-3 space-y-5">
          <div class="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6">
            <h2 class="font-semibold text-text-primary mb-5 flex items-center gap-2">
              <svg class="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/>
              </svg>
              Informations de carte
            </h2>

            <!-- Nom sur la carte -->
            <div class="mb-4">
              <label class="block text-sm font-medium text-text-secondary mb-1.5">
                Nom sur la carte
              </label>
              <input
                v-model="cardName"
                type="text"
                placeholder="Jean Dupont"
                class="w-full rounded-xl border border-neutral-200 px-4 py-3 text-text-primary placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              />
            </div>

            <!-- Numéro de carte -->
            <div class="mb-4">
              <label class="block text-sm font-medium text-text-secondary mb-1.5">
                Numéro de carte
              </label>
              <div class="relative">
                <input
                  :value="cardNumber"
                  type="text"
                  placeholder="4242 4242 4242 4242"
                  maxlength="19"
                  class="w-full rounded-xl border border-neutral-200 px-4 py-3 pr-16 text-text-primary font-mono placeholder:text-neutral-400 placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  @input="onCardNumberInput"
                />
                <span
                  v-if="cardBrand"
                  class="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-primary-600 bg-primary-50 px-2 py-0.5 rounded"
                >
                  {{ cardBrand }}
                </span>
              </div>
            </div>

            <!-- Expiration + CVC -->
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-text-secondary mb-1.5">
                  Date d'expiration
                </label>
                <input
                  :value="cardExpiry"
                  type="text"
                  placeholder="MM/AA"
                  maxlength="5"
                  class="w-full rounded-xl border border-neutral-200 px-4 py-3 text-text-primary font-mono placeholder:text-neutral-400 placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  @input="onExpiryInput"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-text-secondary mb-1.5">
                  CVC
                </label>
                <div class="relative">
                  <input
                    :value="cardCvc"
                    type="text"
                    placeholder="123"
                    maxlength="3"
                    class="w-full rounded-xl border border-neutral-200 px-4 py-3 pr-10 text-text-primary font-mono placeholder:text-neutral-400 placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                    @input="onCvcInput"
                  />
                  <svg class="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                </div>
              </div>
            </div>

            <!-- Message d'erreur -->
            <Transition name="slide-down">
              <div
                v-if="paymentState === 'error'"
                class="mt-5 flex items-start gap-3 rounded-xl bg-error/5 border border-error/20 p-4"
              >
                <svg class="w-5 h-5 text-error mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                </svg>
                <div>
                  <p class="text-sm font-medium text-error">Paiement refusé</p>
                  <p class="text-sm text-text-muted mt-0.5">Votre carte a été refusée. Vérifiez les informations ou utilisez une autre carte.</p>
                  <button
                    class="mt-2 text-sm font-medium text-primary-600 hover:text-primary-700 underline underline-offset-2"
                    @click="retryPayment"
                  >
                    Réessayer avec une autre carte
                  </button>
                </div>
              </div>
            </Transition>

            <!-- Bouton payer -->
            <button
              class="mt-6 w-full rounded-xl py-4 font-semibold text-white transition-all flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed"
              :class="paymentState === 'loading' ? 'bg-primary-400' : 'bg-primary-600 hover:bg-primary-700 active:scale-[.99]'"
              :disabled="paymentState === 'loading'"
              @click="submitPayment"
            >
              <svg
                v-if="paymentState === 'loading'"
                class="w-5 h-5 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
              </svg>
              {{ paymentState === 'loading' ? 'Traitement en cours…' : `Payer ${total.toFixed(2)} €` }}
            </button>

            <p class="text-center text-xs text-text-muted mt-3">
              Test : <code class="bg-neutral-100 px-1 rounded">4242 4242 4242 4242</code> → succès ·
              <code class="bg-neutral-100 px-1 rounded">4242 4242 4242 0000</code> → échec
            </p>
          </div>

          <!-- Logos sécurité -->
          <div class="flex items-center justify-center gap-6 py-2">
            <span class="text-xs text-neutral-400 flex items-center gap-1.5">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>
              SSL 256-bit
            </span>
            <span class="text-xs text-neutral-400">Visa</span>
            <span class="text-xs text-neutral-400">Mastercard</span>
            <span class="text-xs text-neutral-400">Amex</span>
          </div>
        </div>

        <!-- Résumé commande (2/5) -->
        <div class="lg:col-span-2">
          <div class="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 sticky top-6">
            <h2 class="font-semibold text-text-primary mb-5">Résumé de commande</h2>

            <!-- Articles -->
            <div class="space-y-3 mb-5">
              <div
                v-for="item in cartItems"
                :key="item.name"
                class="flex items-center gap-3"
              >
                <span class="text-2xl">{{ item.image }}</span>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-text-primary truncate">{{ item.name }}</p>
                  <p class="text-xs text-text-muted">Qté : {{ item.qty }}</p>
                </div>
                <span class="text-sm font-semibold text-text-primary whitespace-nowrap">
                  {{ (item.price * item.qty).toFixed(2) }} €
                </span>
              </div>
            </div>

            <!-- Durée de location -->
            <div class="flex items-center gap-2 rounded-lg bg-primary-50 border border-primary-100 px-3 py-2 mb-5">
              <svg class="w-4 h-4 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <span class="text-sm text-primary-700 font-medium">Location {{ rentalDays }} jours</span>
            </div>

            <!-- Totaux -->
            <div class="space-y-2 pt-4 border-t border-neutral-100">
              <div class="flex justify-between text-sm text-text-secondary">
                <span>Sous-total</span>
                <span>{{ subtotal.toFixed(2) }} €</span>
              </div>
              <div class="flex justify-between text-sm text-text-secondary">
                <span>Frais de livraison</span>
                <span>{{ deliveryFee.toFixed(2) }} €</span>
              </div>
              <div class="flex justify-between font-bold text-text-primary pt-3 border-t border-neutral-100 text-base">
                <span>Total</span>
                <span>{{ total.toFixed(2) }} €</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.4s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.slide-down-enter-active { transition: all 0.3s ease; }
.slide-down-enter-from { opacity: 0; transform: translateY(-8px); }
</style>
