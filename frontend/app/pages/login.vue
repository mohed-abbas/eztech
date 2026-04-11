<script setup lang="ts">
definePageMeta({
  layout: 'auth',
})

useHead({
  title: 'Sign In — EzTech',
  meta: [
    { name: 'description', content: 'Sign in to your EzTech account to browse, rent, and manage your tech equipment.' },
  ],
})

const { user, login, logout, loading, isAuthenticated } = useAuth()

// Form state
const email = ref('')
const password = ref('')

// Error state
const errors = reactive({
  email: '',
  password: '',
  general: '',
})

// Validation
function validateEmail(): boolean {
  if (!email.value.trim()) {
    errors.email = 'Email is required.'
    return false
  }
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailPattern.test(email.value.trim())) {
    errors.email = 'Please enter a valid email address.'
    return false
  }
  errors.email = ''
  return true
}

function validatePassword(): boolean {
  if (!password.value) {
    errors.password = 'Password is required.'
    return false
  }
  if (password.value.length < 8) {
    errors.password = 'Password must be at least 8 characters.'
    return false
  }
  errors.password = ''
  return true
}

function clearFieldError(field: 'email' | 'password') {
  errors[field] = ''
  errors.general = ''
}

// Form submission
async function handleSubmit() {
  const isEmailValid = validateEmail()
  const isPasswordValid = validatePassword()

  if (!isEmailValid || !isPasswordValid) {
    return
  }

  errors.general = ''

  try {
    await login(email.value.trim(), password.value)
    await navigateTo('/')
  }
  catch (err: unknown) {
    if (err instanceof Error) {
      errors.general = err.message
    }
    else {
      errors.general = 'An unexpected error occurred. Please try again.'
    }
  }
}

// Google OAuth placeholder
function handleGoogleOAuth() {
  alert('Google OAuth will be available in Phase 2.')
}
</script>

<template>
  <div>
    <!-- Already logged in -->
    <div v-if="isAuthenticated" class="text-center py-8">
      <div class="mx-auto flex size-16 items-center justify-center rounded-full bg-primary-100 mb-4">
        <Icon name="ph:user" class="size-8 text-primary-600" />
      </div>
      <p class="text-body text-text-secondary mb-1">Logged in as</p>
      <p class="text-h4 font-semibold text-text-primary">{{ user?.name }}</p>
      <p class="text-body-sm text-text-muted">{{ user?.email }} &middot; {{ user?.role }}</p>
      <div class="mt-6 flex flex-col gap-3">
        <NuxtLink to="/">
          <span class="btn-gradient-primary w-full flex items-center justify-center rounded-full border border-white/10 px-6 py-3 text-body-sm font-medium text-white capitalize">
            Go to Home
          </span>
        </NuxtLink>
        <button
          type="button"
          class="w-full rounded-full border border-neutral-200 bg-white px-6 py-2.5 text-body-sm font-medium text-error hover:bg-error/5 transition-colors"
          @click="logout()"
        >
          Log out
        </button>
      </div>
    </div>

    <!-- Login form (when not authenticated) -->
    <template v-else>
    <!-- Heading -->
    <div class="mb-8">
      <h1 class="text-h2 font-bold text-text-primary leading-heading">
        Welcome back
      </h1>
      <p class="mt-2 text-body text-text-muted leading-body">
        Sign in to your EzTech account
      </p>
    </div>

    <!-- General error -->
    <div
      v-if="errors.general"
      role="alert"
      class="mb-6 rounded-lg border border-error/20 bg-error/5 px-4 py-3 text-body-sm text-error"
    >
      {{ errors.general }}
    </div>

    <!-- Login form -->
    <form
      novalidate
      class="space-y-5"
      @submit.prevent="handleSubmit"
    >
      <!-- Email field -->
      <div class="flex flex-col gap-1.5">
        <label for="login-email" class="text-body-sm font-medium text-neutral-800">
          Email
        </label>
        <input
          id="login-email"
          v-model="email"
          type="email"
          placeholder="you@example.com"
          autocomplete="email"
          :aria-invalid="!!errors.email || undefined"
          :aria-describedby="errors.email ? 'login-email-error' : undefined"
          :class="[
            'bg-white border border-neutral-200 rounded-[--radius-md] px-4 py-3 text-body text-text-primary outline-none focus:ring-2 focus:ring-primary-400/30 focus:border-primary-500 transition',
            errors.email ? 'border-error focus:border-error focus:ring-error/20' : '',
          ]"
          @input="clearFieldError('email')"
          @blur="validateEmail"
        >
        <p
          v-if="errors.email"
          id="login-email-error"
          role="alert"
          class="text-caption text-error"
        >
          {{ errors.email }}
        </p>
      </div>

      <!-- Password field -->
      <div class="flex flex-col gap-1.5">
        <div class="flex items-center justify-between">
          <label for="login-password" class="text-body-sm font-medium text-neutral-800">
            Password
          </label>
          <NuxtLink
            to="/forgot-password"
            class="text-caption font-medium text-primary-600 hover:text-primary-700 transition-colors"
          >
            Forgot password?
          </NuxtLink>
        </div>
        <input
          id="login-password"
          v-model="password"
          type="password"
          placeholder="Enter your password"
          autocomplete="current-password"
          :aria-invalid="!!errors.password || undefined"
          :aria-describedby="errors.password ? 'login-password-error' : undefined"
          :class="[
            'bg-white border border-neutral-200 rounded-[--radius-md] px-4 py-3 text-body text-text-primary outline-none focus:ring-2 focus:ring-primary-400/30 focus:border-primary-500 transition',
            errors.password ? 'border-error focus:border-error focus:ring-error/20' : '',
          ]"
          @input="clearFieldError('password')"
          @blur="validatePassword"
        >
        <p
          v-if="errors.password"
          id="login-password-error"
          role="alert"
          class="text-caption text-error"
        >
          {{ errors.password }}
        </p>
      </div>

      <!-- Submit button -->
      <button
        type="submit"
        :disabled="loading"
        class="btn-gradient-primary w-full flex items-center justify-center rounded-full border border-white/10 px-6 py-3 text-body-sm font-medium text-white capitalize transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg
          v-if="loading"
          class="mr-2 size-4 animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        {{ loading ? 'Signing in...' : 'Sign in' }}
      </button>
    </form>

    <!-- Separator -->
    <div class="relative my-6 flex items-center">
      <div class="flex-1 h-px bg-neutral-200" />
      <span class="px-4 text-caption text-text-muted">or</span>
      <div class="flex-1 h-px bg-neutral-200" />
    </div>

    <!-- Google OAuth button -->
    <button
      type="button"
      class="btn-glass bg-white w-full flex items-center justify-center gap-3 rounded-full px-6 py-2.5 text-body-sm font-medium text-text-primary capitalize"
      @click="handleGoogleOAuth"
    >
      <svg
        class="size-5"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
      </svg>
      Continue with Google
    </button>

    <!-- Footer link -->
    <p class="mt-8 text-center text-body-sm text-text-muted">
      Don't have an account?
      <NuxtLink
        to="/register"
        class="font-semibold text-primary-600 hover:text-primary-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 rounded-sm"
      >
        Sign up
      </NuxtLink>
    </p>

    <!-- Dev credentials hint -->
    <div class="mt-6 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
      <p class="text-caption font-semibold text-text-secondary mb-2">
        Test credentials
      </p>
      <div class="space-y-1 text-caption text-text-muted">
        <p><span class="font-medium text-text-secondary">Customer:</span> marie@example.com / password123</p>
        <p><span class="font-medium text-text-secondary">Rider:</span> lucas@example.com / password123</p>
        <p><span class="font-medium text-text-secondary">Admin:</span> admin@eztech.fr / admin123</p>
      </div>
    </div>
    </template>
  </div>
</template>
