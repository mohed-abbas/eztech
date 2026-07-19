<script setup lang="ts">
import { resetPasswordSchema, zodErrorsToRecord } from '~/lib/schemas'

definePageMeta({
  layout: 'auth',
})

const route = useRoute()
const auth = useAuthStore()
const { loading } = storeToRefs(auth)
const { resetPassword } = auth

const token = computed(() => (route.query.token as string | undefined) ?? '')

const password = ref('')
const confirmPassword = ref('')
const errors = reactive({
  password: '',
  confirmPassword: '',
})
const apiError = ref('')
const submitted = ref(false)

const successHeadingRef = ref<HTMLHeadingElement | null>(null)

function clearFieldError(field: 'password' | 'confirmPassword') {
  errors[field] = ''
  apiError.value = ''
}

function validate(): boolean {
  errors.password = ''
  errors.confirmPassword = ''
  const result = resetPasswordSchema.safeParse({
    password: password.value,
    confirmPassword: confirmPassword.value,
  })
  if (!result.success) {
    const flat = zodErrorsToRecord(result.error)
    errors.password = flat.password ?? ''
    errors.confirmPassword = flat.confirmPassword ?? ''
    return false
  }
  return true
}

async function handleSubmit() {
  apiError.value = ''

  if (!token.value) {
    apiError.value = 'Ce lien de réinitialisation est invalide ou a expiré.'
    return
  }

  if (!validate()) return

  try {
    await resetPassword(token.value, password.value)
    submitted.value = true

    await nextTick()
    successHeadingRef.value?.focus()

    setTimeout(() => {
      navigateTo('/login')
    }, 2500)
  }
  catch (err) {
    apiError.value = err instanceof Error ? err.message : 'Une erreur inattendue est survenue. Veuillez réessayer.'
  }
}

onMounted(() => {
  nextTick(() => {
    document.getElementById('reset-password')?.focus()
  })
})
</script>

<template>
  <div>
    <!-- State 1: Form -->
    <Transition
      enter-active-class="transition-all duration-300 ease-out"
      enter-from-class="opacity-0 translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition-all duration-200 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-2"
      mode="out-in"
    >
      <div v-if="!submitted" key="form">
        <!-- Back to login -->
        <NuxtLink
          to="/login"
          class="inline-flex items-center gap-1.5 text-body-sm text-text-secondary hover:text-text-primary transition-colors mb-8"
        >
          <Icon name="ph:arrow-left" class="h-4 w-4" />
          Retour à la connexion
        </NuxtLink>

        <!-- Heading -->
        <h1 class="text-h2 font-bold text-text-primary">
          Choisir un nouveau mot de passe
        </h1>
        <p class="mt-2 text-body text-text-muted leading-body">
          Saisissez votre nouveau mot de passe ci-dessous.
        </p>

        <!-- API error -->
        <div
          v-if="apiError"
          role="alert"
          class="mt-6 rounded-lg border border-error/20 bg-error/5 px-4 py-3 text-body-sm text-error"
        >
          {{ apiError }}
        </div>

        <!-- Form -->
        <form class="mt-8 space-y-5" novalidate @submit.prevent="handleSubmit">
          <FormField id="reset-password" label="Nouveau mot de passe" :error="errors.password" :data-error="!!errors.password">
            <template #default="{ id: fieldId }">
              <Input
                :id="fieldId"
                v-model="password"
                type="password"
                placeholder="Min. 8 caractères"
                autocomplete="new-password"
                :aria-invalid="!!errors.password || undefined"
                :aria-describedby="errors.password ? 'reset-password-error' : undefined"
                class="w-full"
                @input="clearFieldError('password')"
              />
            </template>
          </FormField>

          <FormField id="reset-confirm-password" label="Confirmer le mot de passe" :error="errors.confirmPassword" :data-error="!!errors.confirmPassword">
            <template #default="{ id: fieldId }">
              <Input
                :id="fieldId"
                v-model="confirmPassword"
                type="password"
                placeholder="Répétez votre mot de passe"
                autocomplete="new-password"
                :aria-invalid="!!errors.confirmPassword || undefined"
                :aria-describedby="errors.confirmPassword ? 'reset-confirm-password-error' : undefined"
                class="w-full"
                @input="clearFieldError('confirmPassword')"
              />
            </template>
          </FormField>

          <Button
            type="submit"
            variant="gradient"
            size="pill"
            class="w-full"
            :disabled="loading"
          >
            <Icon
              v-if="loading"
              name="ph:spinner"
              class="h-4 w-4 animate-spin mr-2"
            />
            {{ loading ? 'Réinitialisation...' : 'Réinitialiser le mot de passe' }}
          </Button>
        </form>
      </div>

      <!-- State 2: Success -->
      <div v-else key="success" class="text-center">
        <!-- Green checkmark -->
        <div class="mx-auto flex size-16 items-center justify-center rounded-full bg-success/10">
          <Icon name="ph:check-circle" class="h-8 w-8 text-success" />
        </div>

        <!-- Heading -->
        <h1
          ref="successHeadingRef"
          tabindex="-1"
          class="mt-6 text-h2 font-bold text-text-primary outline-none"
        >
          Mot de passe réinitialisé
        </h1>
        <p class="mt-3 text-body text-text-muted leading-body">
          Votre mot de passe a été mis à jour. Vous allez être redirigé vers la page de connexion.
        </p>

        <!-- Back to login button -->
        <NuxtLink to="/login" class="mt-8 block">
          <Button variant="gradient" size="pill" class="w-full">
            Se connecter
          </Button>
        </NuxtLink>
      </div>
    </Transition>
  </div>
</template>
