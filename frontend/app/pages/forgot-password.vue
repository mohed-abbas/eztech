<script setup lang="ts">
import { forgotPasswordSchema, zodErrorsToRecord } from '~/lib/schemas'

definePageMeta({
  layout: 'auth',
})

const auth = useAuthStore()
const { loading } = storeToRefs(auth)
const { forgotPassword } = auth

const email = ref('')
const emailError = ref('')
const apiError = ref('')
const submitted = ref(false)
const submittedEmail = ref('')

const successHeadingRef = ref<HTMLHeadingElement | null>(null)

function validateEmail(): boolean {
  emailError.value = ''
  const result = forgotPasswordSchema.safeParse({ email: email.value })
  if (!result.success) {
    emailError.value = zodErrorsToRecord(result.error).email ?? 'Invalid email.'
    return false
  }
  return true
}

async function handleSubmit() {
  apiError.value = ''

  if (!validateEmail()) return

  try {
    await forgotPassword(email.value.trim())
    submittedEmail.value = email.value.trim()
    submitted.value = true

    await nextTick()
    successHeadingRef.value?.focus()
  }
  catch (err) {
    apiError.value = err instanceof Error ? err.message : 'An unexpected error occurred. Please try again.'
  }
}

function handleResend() {
  submitted.value = false
  email.value = ''
  emailError.value = ''
  apiError.value = ''

  nextTick(() => {
    document.getElementById('email')?.focus()
  })
}

onMounted(() => {
  nextTick(() => {
    document.getElementById('email')?.focus()
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
          Back to login
        </NuxtLink>

        <!-- Heading -->
        <h1 class="text-h2 font-bold text-text-primary">
          Reset your password
        </h1>
        <p class="mt-2 text-body text-text-muted leading-body">
          Enter your email address and we'll send you a link to reset your password.
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
          <div class="flex flex-col gap-1.5">
            <label for="email" class="text-body-sm font-medium text-neutral-800">Email address</label>
            <Input
              id="email"
              v-model="email"
              type="email"
              placeholder="you@example.com"
              autocomplete="email"
              :aria-invalid="!!emailError || undefined"
              :aria-describedby="emailError ? 'email-error' : undefined"
              class="w-full"
              @input="emailError = ''"
            />
            <p
              v-if="emailError"
              id="email-error"
              role="alert"
              class="text-caption text-error"
            >
              {{ emailError }}
            </p>
          </div>

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
            {{ loading ? 'Sending...' : 'Send reset link' }}
          </Button>
        </form>

        <!-- Footer -->
        <p class="mt-8 text-center text-body-sm text-text-muted">
          Remember your password?
          <NuxtLink
            to="/login"
            class="font-medium text-primary-600 hover:text-primary-700 transition-colors"
          >
            Log in
          </NuxtLink>
        </p>
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
          Check your email
        </h1>
        <p class="mt-3 text-body text-text-muted leading-body">
          We've sent a password reset link to
          <span class="font-medium text-text-primary">{{ submittedEmail }}</span>.
          Check your inbox and follow the instructions.
        </p>

        <!-- Back to login button -->
        <NuxtLink to="/login" class="mt-8 block">
          <Button variant="gradient" size="pill" class="w-full">
            Back to login
          </Button>
        </NuxtLink>

        <!-- Resend -->
        <p class="mt-6 text-body-sm text-text-muted">
          Didn't receive it?
          <button
            type="button"
            class="font-medium text-primary-600 hover:text-primary-700 transition-colors cursor-pointer"
            @click="handleResend"
          >
            Resend
          </button>
        </p>
      </div>
    </Transition>
  </div>
</template>
