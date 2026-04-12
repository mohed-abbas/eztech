<script setup lang="ts">
import type { RegisterCustomerPayload, RegisterRiderPayload } from '~/stores/auth'
import { registerCustomerSchema, registerRiderSchema, zodErrorsToRecord } from '~/lib/schemas'

definePageMeta({
  layout: 'auth',
})

const auth = useAuthStore()
const { loading, isAuthenticated } = storeToRefs(auth)
const { register } = auth

// Redirect if already authenticated
watch(isAuthenticated, (val) => {
  if (val) navigateTo('/products')
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

function applyErrors(flat: Record<string, string>) {
  const keys = Object.keys(errors) as (keyof FormErrors)[]
  keys.forEach((k) => {
    errors[k] = flat[k] ?? ''
  })
}

function validate(): boolean {
  clearErrors()

  if (activeTab.value === 'customer') {
    const result = registerCustomerSchema.safeParse({
      name: name.value,
      email: email.value,
      password: password.value,
      confirmPassword: confirmPassword.value,
      phone: phone.value,
      addressLabel: addressLabel.value,
      street: street.value,
      city: city.value,
      zipCode: zipCode.value,
    })
    if (!result.success) {
      applyErrors(zodErrorsToRecord(result.error))
      return false
    }
    return true
  }

  const result = registerRiderSchema.safeParse({
    name: name.value,
    email: email.value,
    password: password.value,
    confirmPassword: confirmPassword.value,
    phone: phone.value,
    vehicleType: vehicleType.value,
    licenseNumber: licenseNumber.value,
    insuranceNumber: insuranceNumber.value,
  })
  if (!result.success) {
    applyErrors(zodErrorsToRecord(result.error))
    return false
  }
  return true
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
          <FormField id="register-name" label="Full name" :error="errors.name" :data-error="!!errors.name">
            <template #default="{ id: fieldId }">
              <Input :id="fieldId" v-model="name" type="text" placeholder="John Doe" autocomplete="name" :aria-invalid="!!errors.name" :aria-describedby="errors.name ? 'register-name-error' : undefined" />
            </template>
          </FormField>

          <!-- Email -->
          <FormField id="register-email" label="Email address" :error="errors.email" :data-error="!!errors.email">
            <template #default="{ id: fieldId }">
              <Input :id="fieldId" v-model="email" type="email" placeholder="john@example.com" autocomplete="email" :aria-invalid="!!errors.email" :aria-describedby="errors.email ? 'register-email-error' : undefined" />
            </template>
          </FormField>

          <!-- Password -->
          <FormField id="register-password" label="Password" :error="errors.password" :data-error="!!errors.password">
            <template #default="{ id: fieldId }">
              <Input :id="fieldId" v-model="password" type="password" placeholder="Min. 8 characters" autocomplete="new-password" :aria-invalid="!!errors.password" :aria-describedby="errors.password ? 'register-password-error' : undefined" />
            </template>
          </FormField>

          <!-- Confirm Password -->
          <FormField id="register-confirm-password" label="Confirm password" :error="errors.confirmPassword" :data-error="!!errors.confirmPassword">
            <template #default="{ id: fieldId }">
              <Input :id="fieldId" v-model="confirmPassword" type="password" placeholder="Repeat your password" autocomplete="new-password" :aria-invalid="!!errors.confirmPassword" :aria-describedby="errors.confirmPassword ? 'register-confirm-password-error' : undefined" />
            </template>
          </FormField>

          <!-- Phone -->
          <FormField id="register-phone" label="Phone number" :error="errors.phone" :data-error="!!errors.phone">
            <template #default="{ id: fieldId }">
              <Input :id="fieldId" v-model="phone" type="tel" placeholder="+33 6 12 34 56 78" autocomplete="tel" :aria-invalid="!!errors.phone" :aria-describedby="errors.phone ? 'register-phone-error' : undefined" />
            </template>
          </FormField>
        </div>

        <!-- Customer-specific fields -->
        <div v-if="activeTab === 'customer'" class="mt-4">
          <fieldset class="space-y-4">
            <legend class="text-body-sm font-semibold text-text-primary mb-3">
              Delivery address
            </legend>

            <!-- Address Label -->
            <FormField id="register-address-label" label="Address label" :error="errors.addressLabel" :data-error="!!errors.addressLabel">
              <template #default="{ id: fieldId }">
                <Input :id="fieldId" v-model="addressLabel" type="text" placeholder="Home, Office..." :aria-invalid="!!errors.addressLabel" :aria-describedby="errors.addressLabel ? 'register-address-label-error' : undefined" />
              </template>
            </FormField>

            <!-- Street -->
            <FormField id="register-street" label="Street" :error="errors.street" :data-error="!!errors.street">
              <template #default="{ id: fieldId }">
                <Input :id="fieldId" v-model="street" type="text" placeholder="123 Rue de la Paix" autocomplete="street-address" :aria-invalid="!!errors.street" :aria-describedby="errors.street ? 'register-street-error' : undefined" />
              </template>
            </FormField>

            <!-- City + Zip Code row -->
            <div class="grid grid-cols-2 gap-3">
              <FormField id="register-city" label="City" :error="errors.city" :data-error="!!errors.city">
                <template #default="{ id: fieldId }">
                  <Input :id="fieldId" v-model="city" type="text" placeholder="Paris" autocomplete="address-level2" :aria-invalid="!!errors.city" :aria-describedby="errors.city ? 'register-city-error' : undefined" />
                </template>
              </FormField>

              <FormField id="register-zipcode" label="Zip code" :error="errors.zipCode" :data-error="!!errors.zipCode">
                <template #default="{ id: fieldId }">
                  <Input :id="fieldId" v-model="zipCode" type="text" placeholder="75001" autocomplete="postal-code" :aria-invalid="!!errors.zipCode" :aria-describedby="errors.zipCode ? 'register-zipcode-error' : undefined" />
                </template>
              </FormField>
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
            <FormField id="register-license" label="License number" :error="errors.licenseNumber" :data-error="!!errors.licenseNumber">
              <template #default="{ id: fieldId }">
                <Input :id="fieldId" v-model="licenseNumber" type="text" placeholder="AB-123-CD" :aria-invalid="!!errors.licenseNumber" :aria-describedby="errors.licenseNumber ? 'register-license-error' : undefined" />
              </template>
            </FormField>

            <!-- Insurance Number -->
            <FormField id="register-insurance" label="Insurance number" :error="errors.insuranceNumber" :data-error="!!errors.insuranceNumber">
              <template #default="{ id: fieldId }">
                <Input :id="fieldId" v-model="insuranceNumber" type="text" placeholder="INS-2024-XXXX" :aria-invalid="!!errors.insuranceNumber" :aria-describedby="errors.insuranceNumber ? 'register-insurance-error' : undefined" />
              </template>
            </FormField>
          </fieldset>
        </div>
      </div>

      <!-- Submit Button -->
      <Button type="submit" variant="gradient" size="pill" class="w-full" :disabled="loading">
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
      </Button>
    </form>

    <!-- Separator -->
    <div class="relative my-6 flex items-center">
      <div class="flex-1 h-px bg-neutral-200" />
      <span class="px-3 text-caption text-text-muted">or</span>
      <div class="flex-1 h-px bg-neutral-200" />
    </div>

    <!-- Google OAuth -->
    <Button variant="glass" size="pill-sm" class="w-full gap-3" @click="handleGoogleOAuth">
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
    </Button>

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
