<script setup lang="ts">
definePageMeta({
  layout: 'auth',
})

const route = useRoute()
const auth = useAuthStore()
const { loading, user } = storeToRefs(auth)
const { verifyEmail, resendVerification } = auth

const token = computed(() => (route.query.token as string | undefined) ?? '')

type State = 'verifying' | 'success' | 'error'
const state = ref<State>('verifying')
const errorMessage = ref('')
const resendEmail = ref(user.value?.email ?? '')
const resent = ref(false)

const headingRef = ref<HTMLHeadingElement | null>(null)

async function run() {
  if (!token.value) {
    state.value = 'error'
    errorMessage.value = 'Ce lien de confirmation est invalide ou a expiré.'
    return
  }
  try {
    await verifyEmail(token.value)
    state.value = 'success'
    await nextTick()
    headingRef.value?.focus()
    setTimeout(() => navigateTo('/'), 2500)
  }
  catch (err) {
    state.value = 'error'
    errorMessage.value = err instanceof Error ? err.message : 'Une erreur inattendue est survenue.'
    await nextTick()
    headingRef.value?.focus()
  }
}

async function handleResend() {
  if (!resendEmail.value) return
  await resendVerification(resendEmail.value)
  resent.value = true
}

onMounted(run)
</script>

<template>
  <div>
    <!-- State 1: Verifying -->
    <div v-if="state === 'verifying'" class="text-center">
      <div class="mx-auto flex size-16 items-center justify-center rounded-full bg-primary-600/10">
        <Icon name="ph:spinner" class="h-8 w-8 text-primary-600 animate-spin" />
      </div>
      <h1 class="mt-6 text-h2 font-bold text-text-primary">
        Confirmation en cours…
      </h1>
      <p class="mt-3 text-body text-text-muted leading-body">
        Nous vérifions votre lien de confirmation.
      </p>
    </div>

    <!-- State 2: Success -->
    <div v-else-if="state === 'success'" class="text-center">
      <div class="mx-auto flex size-16 items-center justify-center rounded-full bg-success/10">
        <Icon name="ph:check-circle" class="h-8 w-8 text-success" />
      </div>
      <h1
        ref="headingRef"
        tabindex="-1"
        class="mt-6 text-h2 font-bold text-text-primary outline-none"
      >
        Adresse email confirmée
      </h1>
      <p class="mt-3 text-body text-text-muted leading-body">
        Merci ! Votre compte est confirmé. Vous allez être redirigé.
      </p>
      <NuxtLink to="/" class="mt-8 block">
        <Button variant="gradient" size="pill" class="w-full">
          Continuer
        </Button>
      </NuxtLink>
    </div>

    <!-- State 3: Error + resend -->
    <div v-else class="text-center">
      <div class="mx-auto flex size-16 items-center justify-center rounded-full bg-error/10">
        <Icon name="ph:x-circle" class="h-8 w-8 text-error" />
      </div>
      <h1
        ref="headingRef"
        tabindex="-1"
        class="mt-6 text-h2 font-bold text-text-primary outline-none"
      >
        Confirmation impossible
      </h1>
      <p class="mt-3 text-body text-text-muted leading-body">
        {{ errorMessage }}
      </p>

      <div v-if="resent" role="status" class="mt-8 rounded-lg border border-success/20 bg-success/5 px-4 py-3 text-body-sm text-success">
        Si un compte non confirmé existe pour cette adresse, un nouveau lien vient d'être envoyé.
      </div>

      <form v-else class="mt-8 space-y-4 text-left" novalidate @submit.prevent="handleResend">
        <FormField id="resend-email" label="Renvoyer un lien de confirmation">
          <template #default="{ id: fieldId }">
            <Input
              :id="fieldId"
              v-model="resendEmail"
              type="email"
              placeholder="votre@email.com"
              autocomplete="email"
              class="w-full"
            />
          </template>
        </FormField>
        <Button
          type="submit"
          variant="gradient"
          size="pill"
          class="w-full"
          :disabled="loading || !resendEmail"
        >
          <Icon v-if="loading" name="ph:spinner" class="h-4 w-4 animate-spin mr-2" />
          {{ loading ? 'Envoi…' : 'Renvoyer le lien' }}
        </Button>
      </form>

      <NuxtLink
        to="/login"
        class="mt-6 inline-flex items-center gap-1.5 text-body-sm text-text-secondary hover:text-text-primary transition-colors"
      >
        <Icon name="ph:arrow-left" class="h-4 w-4" />
        Retour à la connexion
      </NuxtLink>
    </div>
  </div>
</template>
