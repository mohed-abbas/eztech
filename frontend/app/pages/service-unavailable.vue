<script setup lang="ts">
definePageMeta({ layout: 'default' })
useHead({ title: 'Service non disponible dans votre zone - EzTech' })

const email = ref('')
const submitting = ref(false)
const subscribed = ref(false)
const error = ref('')

const emailValid = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value))

async function notifyMe() {
  error.value = ''
  if (!emailValid.value) {
    error.value = 'Adresse email invalide.'
    return
  }
  submitting.value = true
  // Enregistrement simulé de la demande de notification
  await new Promise((r) => setTimeout(r, 900))
  submitting.value = false
  subscribed.value = true
}
</script>

<template>
  <div class="min-h-screen bg-background flex items-center justify-center px-6 py-16">
    <div class="w-full max-w-lg text-center">
      <!-- Illustration -->
      <div class="relative mx-auto mb-8 flex size-32 items-center justify-center">
        <div class="absolute inset-0 rounded-full bg-primary-100/60 blur-2xl" />
        <div class="relative flex size-32 items-center justify-center rounded-full bg-surface-purple border border-primary-100">
          <Icon name="ph:map-pin-line" class="size-14 text-primary-600" />
        </div>
        <div class="absolute -bottom-1 -right-1 flex size-11 items-center justify-center rounded-full bg-white border border-neutral-200 shadow-sm">
          <Icon name="ph:clock-countdown" class="size-6 text-warning" />
        </div>
      </div>

      <h1 class="text-h2 font-semibold text-text-primary">
        Service pas encore disponible chez vous
      </h1>
      <p class="mx-auto mt-3 max-w-md text-body text-text-muted">
        Nous ne livrons pas encore dans votre zone. Nous couvrons actuellement
        Paris Centre et Paris Est, et nous étendons notre couverture rapidement.
      </p>

      <!-- Notification par email -->
      <Card class="mt-8 p-6 text-left">
        <div v-if="!subscribed">
          <div class="mb-3 flex items-center gap-2">
            <Icon name="ph:bell-ringing" class="size-5 text-primary-600" />
            <h2 class="text-body font-semibold text-text-primary">
              Me notifier quand le service arrive dans ma zone
            </h2>
          </div>
          <form class="flex flex-col gap-3 sm:flex-row" @submit.prevent="notifyMe">
            <Input
              v-model="email"
              type="email"
              placeholder="vous@exemple.com"
              class="flex-1"
              :aria-invalid="!!error"
            />
            <Button type="submit" variant="gradient" class="font-semibold" :disabled="submitting">
              <Icon v-if="submitting" name="ph:spinner-gap" class="size-4 animate-spin" />
              <Icon v-else name="ph:paper-plane-tilt" class="size-4" />
              {{ submitting ? 'Envoi...' : 'Me notifier' }}
            </Button>
          </form>
          <p v-if="error" class="mt-2 text-body-sm text-error flex items-center gap-1.5">
            <Icon name="ph:warning-circle" class="size-4 shrink-0" />
            {{ error }}
          </p>
        </div>

        <!-- Confirmation -->
        <div v-else class="flex items-center gap-3">
          <div class="flex size-10 shrink-0 items-center justify-center rounded-full bg-success/10">
            <Icon name="ph:check-circle-fill" class="size-6 text-success" />
          </div>
          <div>
            <p class="text-body font-medium text-text-primary">C'est noté !</p>
            <p class="text-body-sm text-text-muted">
              Nous vous préviendrons dès que la livraison sera disponible chez vous.
            </p>
          </div>
        </div>
      </Card>

      <!-- Retour accueil -->
      <div class="mt-8">
        <NuxtLink to="/">
          <Button variant="outline" size="pill" class="font-medium">
            <Icon name="ph:arrow-left" class="size-4" />
            Retour à l'accueil
          </Button>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
