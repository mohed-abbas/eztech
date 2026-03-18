<script setup lang="ts">
import type { RegisterCustomerPayload, RegisterRiderPayload } from '~/composables/useAuth'

definePageMeta({
  layout: 'auth',
})

const { loading, register, isAuthenticated } = useAuth()

// Redirect if already authenticated
watch(isAuthenticated, (val) => {
  if (val) navigateTo('/')
}, { immediate: true })

// Form state
const activeTab = ref<'customer' | 'rider'>('customer')
const apiError = ref('')

// Common fields
const name = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const phone = ref('')

// Customer-specific fields
const addressLabel = ref('')
const street = ref('')
const city = ref('')
const zipCode = ref('')

// Rider-specific fields
const vehicleType = ref<'bicycle' | 'scooter' | 'car'>('bicycle')
const licenseNumber = ref('')
const insuranceNumber = ref('')

// Validation errors
interface FormErrors {
  name: string
  email: string
  password: string
  confirmPassword: string
  phone: string
  addressLabel: string
  street: string
  city: string
  zipCode: string
  vehicleType: string
  licenseNumber: string
  insuranceNumber: string
}

const errors = reactive<FormErrors>({
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  phone: '',
  addressLabel: '',
  street: '',
  city: '',
  zipCode: '',
  vehicleType: '',
  licenseNumber: '',
  insuranceNumber: '',
})

const vehicleOptions = [
  { value: 'bicycle' as const, label: 'Bicycle', icon: 'ph:bicycle' },
  { value: 'scooter' as const, label: 'Scooter', icon: 'ph:motorcycle' },
  { value: 'car' as const, label: 'Car', icon: 'ph:car' },
]

function clearErrors() {
  const keys = Object.keys(errors) as (keyof FormErrors)[]
  keys.forEach((key) => {
    errors[key] = ''
  })
  apiError.value = ''
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function isValidPhone(value: string): boolean {
  const cleaned = value.replace(/\s/g, '')
  return /^(\+33|0)[67]\d{8}$/.test(cleaned)
}

function validate(): boolean {
  clearErrors()
  let valid = true

  // Common field validation
  if (!name.value.trim()) {
    errors.name = 'Name is required.'
    valid = false
  }
  else if (name.value.trim().length < 2) {
    errors.name = 'Name must be at least 2 characters.'
    valid = false
  }

  if (!email.value.trim()) {
    errors.email = 'Email is required.'
    valid = false
  }
  else if (!isValidEmail(email.value.trim())) {
    errors.email = 'Please enter a valid email address.'
    valid = false
  }

  if (!password.value) {
    errors.password = 'Password is required.'
    valid = false
  }
  else if (password.value.length < 8) {
    errors.password = 'Password must be at least 8 characters.'
    valid = false
  }

  if (!confirmPassword.value) {
    errors.confirmPassword = 'Please confirm your password.'
    valid = false
  }
  else if (confirmPassword.value !== password.value) {
    errors.confirmPassword = 'Passwords do not match.'
    valid = false
  }

  if (!phone.value.trim()) {
    errors.phone = 'Phone number is required.'
    valid = false
  }
  else if (!isValidPhone(phone.value.trim())) {
    errors.phone = 'Please enter a valid French mobile number (+33 6/7... or 06/07...).'
    valid = false
  }

  // Tab-specific validation
  if (activeTab.value === 'customer') {
    if (!addressLabel.value.trim()) {
      errors.addressLabel = 'Address label is required.'
      valid = false
    }
    if (!street.value.trim()) {
      errors.street = 'Street is required.'
      valid = false
    }
    if (!city.value.trim()) {
      errors.city = 'City is required.'
      valid = false
    }
    if (!zipCode.value.trim()) {
      errors.zipCode = 'Zip code is required.'
      valid = false
    }
  }
  else {
    if (!licenseNumber.value.trim()) {
      errors.licenseNumber = 'License number is required.'
      valid = false
    }
    if (!insuranceNumber.value.trim()) {
      errors.insuranceNumber = 'Insurance number is required.'
      valid = false
    }
  }

  return valid
}

function scrollToFirstError() {
  nextTick(() => {
    const firstErrorEl = document.querySelector('[data-error="true"]')
    if (firstErrorEl) {
      firstErrorEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
      const input = firstErrorEl.querySelector('input')
      input?.focus()
    }
  })
}

async function handleSubmit() {
  if (!validate()) {
    scrollToFirstError()
    return
  }

  apiError.value = ''

  try {
    if (activeTab.value === 'customer') {
      const payload: RegisterCustomerPayload = {
        name: name.value.trim(),
        email: email.value.trim(),
        password: password.value,
        phone: phone.value.trim(),
        address: {
          label: addressLabel.value.trim(),
          street: street.value.trim(),
          city: city.value.trim(),
          zipCode: zipCode.value.trim(),
        },
      }
      await register(payload)
    }
    else {
      const payload: RegisterRiderPayload = {
        name: name.value.trim(),
        email: email.value.trim(),
        password: password.value,
        phone: phone.value.trim(),
        vehicleType: vehicleType.value,
        licenseNumber: licenseNumber.value.trim(),
        insuranceNumber: insuranceNumber.value.trim(),
      }
      await register(payload)
    }

    await navigateTo('/')
  }
  catch (err: unknown) {
    if (err instanceof Error) {
      apiError.value = err.message
    }
    else {
      apiError.value = 'An unexpected error occurred. Please try again.'
    }
  }
}

function handleGoogleOAuth() {
  alert('Google OAuth available in Phase 2')
}
</script>

<template>
  <div>
    <!-- Heading -->
    <div class="mb-8">
      <h1 class="text-h2 font-bold text-text-primary leading-heading">
        Create your account
      </h1>
      <p class="mt-2 text-body text-text-muted leading-body">
        Join EzTech today
      </p>
    </div>

    <!-- API Error -->
    <div
      v-if="apiError"
      role="alert"
      class="mb-6 rounded-lg border border-error/20 bg-red-50 px-4 py-3 text-body-sm text-error"
    >
      {{ apiError }}
    </div>

    <!-- Registration Form -->
    <form novalidate @submit.prevent="handleSubmit">
      <!-- Customer / Rider Toggle -->
      <div class="mb-6">
        <div class="relative grid w-full grid-cols-2 rounded-full bg-neutral-100 p-1" role="tablist" aria-label="Account type">
          <!-- Sliding indicator -->
          <span
            aria-hidden="true"
            class="absolute inset-y-1 w-[calc(50%-0.25rem)] rounded-full bg-neutral-800 shadow-lg transition-transform duration-300 ease-in-out"
            :class="activeTab === 'rider' ? 'translate-x-[calc(100%+0.25rem)]' : 'translate-x-0'"
          />
          <button
            type="button"
            role="tab"
            :aria-selected="activeTab === 'customer'"
            :class="[
              'relative z-10 rounded-full py-2.5 text-body-sm font-medium transition-colors duration-300',
              activeTab === 'customer'
                ? 'text-white'
                : 'text-text-muted hover:text-text-secondary',
            ]"
            @click="activeTab = 'customer'; clearErrors()"
          >
            Customer
          </button>
          <button
            type="button"
            role="tab"
            :aria-selected="activeTab === 'rider'"
            :class="[
              'relative z-10 rounded-full py-2.5 text-body-sm font-medium transition-colors duration-300',
              activeTab === 'rider'
                ? 'text-white'
                : 'text-text-muted hover:text-text-secondary',
            ]"
            @click="activeTab = 'rider'; clearErrors()"
          >
            Rider
          </button>
        </div>

        <!-- Common Fields -->
        <div class="mt-6 space-y-4">
          <!-- Name -->
          <div :data-error="!!errors.name">
            <label for="register-name" class="text-body-sm font-medium text-neutral-800">
              Full name
            </label>
            <input
              id="register-name"
              v-model="name"
              type="text"
              placeholder="John Doe"
              autocomplete="name"
              :aria-invalid="!!errors.name"
              :aria-describedby="errors.name ? 'register-name-error' : undefined"
              :class="[
                'w-full bg-white border border-neutral-200 rounded-[--radius-md] px-4 py-3 text-body text-text-primary placeholder:text-text-muted outline-none focus:ring-2 focus:ring-primary-400/30 focus:border-primary-500 transition',
                errors.name ? 'border-error focus:border-error focus:ring-error/20' : '',
              ]"
            >
            <p
              v-if="errors.name"
              id="register-name-error"
              role="alert"
              class="mt-1 text-caption text-error"
            >
              {{ errors.name }}
            </p>
          </div>

          <!-- Email -->
          <div :data-error="!!errors.email">
            <label for="register-email" class="text-body-sm font-medium text-neutral-800">
              Email address
            </label>
            <input
              id="register-email"
              v-model="email"
              type="email"
              placeholder="john@example.com"
              autocomplete="email"
              :aria-invalid="!!errors.email"
              :aria-describedby="errors.email ? 'register-email-error' : undefined"
              :class="[
                'w-full bg-white border border-neutral-200 rounded-[--radius-md] px-4 py-3 text-body text-text-primary placeholder:text-text-muted outline-none focus:ring-2 focus:ring-primary-400/30 focus:border-primary-500 transition',
                errors.email ? 'border-error focus:border-error focus:ring-error/20' : '',
              ]"
            >
            <p
              v-if="errors.email"
              id="register-email-error"
              role="alert"
              class="mt-1 text-caption text-error"
            >
              {{ errors.email }}
            </p>
          </div>

          <!-- Password -->
          <div :data-error="!!errors.password">
            <label for="register-password" class="text-body-sm font-medium text-neutral-800">
              Password
            </label>
            <input
              id="register-password"
              v-model="password"
              type="password"
              placeholder="Min. 8 characters"
              autocomplete="new-password"
              :aria-invalid="!!errors.password"
              :aria-describedby="errors.password ? 'register-password-error' : undefined"
              :class="[
                'w-full bg-white border border-neutral-200 rounded-[--radius-md] px-4 py-3 text-body text-text-primary placeholder:text-text-muted outline-none focus:ring-2 focus:ring-primary-400/30 focus:border-primary-500 transition',
                errors.password ? 'border-error focus:border-error focus:ring-error/20' : '',
              ]"
            >
            <p
              v-if="errors.password"
              id="register-password-error"
              role="alert"
              class="mt-1 text-caption text-error"
            >
              {{ errors.password }}
            </p>
          </div>

          <!-- Confirm Password -->
          <div :data-error="!!errors.confirmPassword">
            <label for="register-confirm-password" class="text-body-sm font-medium text-neutral-800">
              Confirm password
            </label>
            <input
              id="register-confirm-password"
              v-model="confirmPassword"
              type="password"
              placeholder="Repeat your password"
              autocomplete="new-password"
              :aria-invalid="!!errors.confirmPassword"
              :aria-describedby="errors.confirmPassword ? 'register-confirm-password-error' : undefined"
              :class="[
                'w-full bg-white border border-neutral-200 rounded-[--radius-md] px-4 py-3 text-body text-text-primary placeholder:text-text-muted outline-none focus:ring-2 focus:ring-primary-400/30 focus:border-primary-500 transition',
                errors.confirmPassword ? 'border-error focus:border-error focus:ring-error/20' : '',
              ]"
            >
            <p
              v-if="errors.confirmPassword"
              id="register-confirm-password-error"
              role="alert"
              class="mt-1 text-caption text-error"
            >
              {{ errors.confirmPassword }}
            </p>
          </div>

          <!-- Phone -->
          <div :data-error="!!errors.phone">
            <label for="register-phone" class="text-body-sm font-medium text-neutral-800">
              Phone number
            </label>
            <input
              id="register-phone"
              v-model="phone"
              type="tel"
              placeholder="+33 6 12 34 56 78"
              autocomplete="tel"
              :aria-invalid="!!errors.phone"
              :aria-describedby="errors.phone ? 'register-phone-error' : undefined"
              :class="[
                'w-full bg-white border border-neutral-200 rounded-[--radius-md] px-4 py-3 text-body text-text-primary placeholder:text-text-muted outline-none focus:ring-2 focus:ring-primary-400/30 focus:border-primary-500 transition',
                errors.phone ? 'border-error focus:border-error focus:ring-error/20' : '',
              ]"
            >
            <p
              v-if="errors.phone"
              id="register-phone-error"
              role="alert"
              class="mt-1 text-caption text-error"
            >
              {{ errors.phone }}
            </p>
          </div>
        </div>

        <!-- Customer-specific fields -->
        <div v-if="activeTab === 'customer'" class="mt-4">
          <fieldset class="space-y-4">
            <legend class="text-body-sm font-semibold text-text-primary mb-3">
              Delivery address
            </legend>

            <!-- Address Label -->
            <div :data-error="!!errors.addressLabel">
              <label for="register-address-label" class="text-body-sm font-medium text-neutral-800">
                Address label
              </label>
              <input
                id="register-address-label"
                v-model="addressLabel"
                type="text"
                placeholder="Home, Office..."
                :aria-invalid="!!errors.addressLabel"
                :aria-describedby="errors.addressLabel ? 'register-address-label-error' : undefined"
                :class="[
                  'w-full bg-white border border-neutral-200 rounded-[--radius-md] px-4 py-3 text-body text-text-primary placeholder:text-text-muted outline-none focus:ring-2 focus:ring-primary-400/30 focus:border-primary-500 transition',
                  errors.addressLabel ? 'border-error focus:border-error focus:ring-error/20' : '',
                ]"
              >
              <p
                v-if="errors.addressLabel"
                id="register-address-label-error"
                role="alert"
                class="mt-1 text-caption text-error"
              >
                {{ errors.addressLabel }}
              </p>
            </div>

            <!-- Street -->
            <div :data-error="!!errors.street">
              <label for="register-street" class="text-body-sm font-medium text-neutral-800">
                Street
              </label>
              <input
                id="register-street"
                v-model="street"
                type="text"
                placeholder="123 Rue de la Paix"
                autocomplete="street-address"
                :aria-invalid="!!errors.street"
                :aria-describedby="errors.street ? 'register-street-error' : undefined"
                :class="[
                  'w-full bg-white border border-neutral-200 rounded-[--radius-md] px-4 py-3 text-body text-text-primary placeholder:text-text-muted outline-none focus:ring-2 focus:ring-primary-400/30 focus:border-primary-500 transition',
                  errors.street ? 'border-error focus:border-error focus:ring-error/20' : '',
                ]"
              >
              <p
                v-if="errors.street"
                id="register-street-error"
                role="alert"
                class="mt-1 text-caption text-error"
              >
                {{ errors.street }}
              </p>
            </div>

            <!-- City + Zip Code row -->
            <div class="grid grid-cols-2 gap-3">
              <div :data-error="!!errors.city">
                <label for="register-city" class="text-body-sm font-medium text-neutral-800">
                  City
                </label>
                <input
                  id="register-city"
                  v-model="city"
                  type="text"
                  placeholder="Paris"
                  autocomplete="address-level2"
                  :aria-invalid="!!errors.city"
                  :aria-describedby="errors.city ? 'register-city-error' : undefined"
                  :class="[
                    'w-full bg-white border border-neutral-200 rounded-[--radius-md] px-4 py-3 text-body text-text-primary placeholder:text-text-muted outline-none focus:ring-2 focus:ring-primary-400/30 focus:border-primary-500 transition',
                    errors.city ? 'border-error focus:border-error focus:ring-error/20' : '',
                  ]"
                >
                <p
                  v-if="errors.city"
                  id="register-city-error"
                  role="alert"
                  class="mt-1 text-caption text-error"
                >
                  {{ errors.city }}
                </p>
              </div>

              <div :data-error="!!errors.zipCode">
                <label for="register-zipcode" class="text-body-sm font-medium text-neutral-800">
                  Zip code
                </label>
                <input
                  id="register-zipcode"
                  v-model="zipCode"
                  type="text"
                  placeholder="75001"
                  autocomplete="postal-code"
                  :aria-invalid="!!errors.zipCode"
                  :aria-describedby="errors.zipCode ? 'register-zipcode-error' : undefined"
                  :class="[
                    'w-full bg-white border border-neutral-200 rounded-[--radius-md] px-4 py-3 text-body text-text-primary placeholder:text-text-muted outline-none focus:ring-2 focus:ring-primary-400/30 focus:border-primary-500 transition',
                    errors.zipCode ? 'border-error focus:border-error focus:ring-error/20' : '',
                  ]"
                >
                <p
                  v-if="errors.zipCode"
                  id="register-zipcode-error"
                  role="alert"
                  class="mt-1 text-caption text-error"
                >
                  {{ errors.zipCode }}
                </p>
              </div>
            </div>
          </fieldset>
        </div>

        <!-- Rider-specific fields -->
        <div v-if="activeTab === 'rider'" class="mt-4">
          <fieldset class="space-y-4">
            <legend class="text-body-sm font-semibold text-text-primary mb-3">
              Rider information
            </legend>

            <!-- Vehicle Type -->
            <div :data-error="!!errors.vehicleType">
              <label class="text-body-sm font-medium text-neutral-800">
                Vehicle type
              </label>
              <div
                role="radiogroup"
                aria-label="Vehicle type"
                class="grid grid-cols-3 gap-3"
              >
                <label
                  v-for="option in vehicleOptions"
                  :key="option.value"
                  :for="`vehicle-${option.value}`"
                  class="relative flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 px-3 py-4 transition-all hover:border-primary-300 hover:bg-primary-50/50"
                  :class="[
                    vehicleType === option.value
                      ? 'border-primary-500 bg-primary-50 shadow-sm'
                      : 'border-neutral-200 bg-white',
                  ]"
                >
                  <input
                    :id="`vehicle-${option.value}`"
                    v-model="vehicleType"
                    type="radio"
                    name="vehicleType"
                    :value="option.value"
                    class="sr-only"
                  >
                  <Icon
                    :name="option.icon"
                    class="size-6 transition-colors"
                    :class="[
                      vehicleType === option.value
                        ? 'text-primary-600'
                        : 'text-neutral-400',
                    ]"
                  />
                  <span
                    class="text-body-sm font-medium transition-colors"
                    :class="[
                      vehicleType === option.value
                        ? 'text-primary-700'
                        : 'text-text-muted',
                    ]"
                  >
                    {{ option.label }}
                  </span>
                  <!-- Active indicator -->
                  <div
                    v-if="vehicleType === option.value"
                    class="absolute -top-px -right-px flex size-5 items-center justify-center rounded-bl-lg rounded-tr-[10px] bg-primary-500"
                  >
                    <Icon name="ph:check-bold" class="size-3 text-white" />
                  </div>
                </label>
              </div>
              <p
                v-if="errors.vehicleType"
                id="register-vehicle-type-error"
                role="alert"
                class="mt-1 text-caption text-error"
              >
                {{ errors.vehicleType }}
              </p>
            </div>

            <!-- License Number -->
            <div :data-error="!!errors.licenseNumber">
              <label for="register-license" class="text-body-sm font-medium text-neutral-800">
                License number
              </label>
              <input
                id="register-license"
                v-model="licenseNumber"
                type="text"
                placeholder="AB-123-CD"
                :aria-invalid="!!errors.licenseNumber"
                :aria-describedby="errors.licenseNumber ? 'register-license-error' : undefined"
                :class="[
                  'w-full bg-white border border-neutral-200 rounded-[--radius-md] px-4 py-3 text-body text-text-primary placeholder:text-text-muted outline-none focus:ring-2 focus:ring-primary-400/30 focus:border-primary-500 transition',
                  errors.licenseNumber ? 'border-error focus:border-error focus:ring-error/20' : '',
                ]"
              >
              <p
                v-if="errors.licenseNumber"
                id="register-license-error"
                role="alert"
                class="mt-1 text-caption text-error"
              >
                {{ errors.licenseNumber }}
              </p>
            </div>

            <!-- Insurance Number -->
            <div :data-error="!!errors.insuranceNumber">
              <label for="register-insurance" class="text-body-sm font-medium text-neutral-800">
                Insurance number
              </label>
              <input
                id="register-insurance"
                v-model="insuranceNumber"
                type="text"
                placeholder="INS-2024-XXXX"
                :aria-invalid="!!errors.insuranceNumber"
                :aria-describedby="errors.insuranceNumber ? 'register-insurance-error' : undefined"
                :class="[
                  'w-full bg-white border border-neutral-200 rounded-[--radius-md] px-4 py-3 text-body text-text-primary placeholder:text-text-muted outline-none focus:ring-2 focus:ring-primary-400/30 focus:border-primary-500 transition',
                  errors.insuranceNumber ? 'border-error focus:border-error focus:ring-error/20' : '',
                ]"
              >
              <p
                v-if="errors.insuranceNumber"
                id="register-insurance-error"
                role="alert"
                class="mt-1 text-caption text-error"
              >
                {{ errors.insuranceNumber }}
              </p>
            </div>
          </fieldset>
        </div>
      </div>

      <!-- Submit Button -->
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
        {{ loading ? 'Creating account...' : 'Create account' }}
      </button>
    </form>

    <!-- Separator -->
    <div class="relative my-6 flex items-center">
      <div class="flex-1 h-px bg-neutral-200" />
      <span class="px-3 text-caption text-text-muted">or</span>
      <div class="flex-1 h-px bg-neutral-200" />
    </div>

    <!-- Google OAuth -->
    <button
      type="button"
      class="btn-glass bg-white w-full flex items-center justify-center gap-3 rounded-full px-6 py-2.5 text-body-sm font-medium text-text-primary capitalize"
      @click="handleGoogleOAuth"
    >
      <svg class="size-5" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
          fill="#4285F4"
        />
        <path
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          fill="#34A853"
        />
        <path
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          fill="#FBBC05"
        />
        <path
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          fill="#EA4335"
        />
      </svg>
      Continue with Google
    </button>

    <!-- Footer link -->
    <p class="mt-8 text-center text-body-sm text-text-muted">
      Already have an account?
      <NuxtLink
        to="/login"
        class="font-medium text-primary-600 transition-colors hover:text-primary-700"
      >
        Sign in
      </NuxtLink>
    </p>
  </div>
</template>
