<script setup lang="ts">
import {
  profilePersonalSchema,
  profilePasswordSchema,
  profileAddressSchema,
  profileVehicleSchema,
  zodErrorsToRecord,
} from '~/lib/schemas'

definePageMeta({
  layout: 'default',
  middleware: 'auth',
})

useHead({
  title: 'My Profile — EzTech',
  meta: [
    { name: 'description', content: 'Manage your EzTech profile, addresses, and account settings.' },
  ],
})

const auth = useAuthStore()
const { user, loading } = storeToRefs(auth)
const { fadeUp, heroFadeUp } = useMotionPresets()

const vehicleOptions = [
  { value: 'bicycle', label: 'Bicycle', icon: 'ph:bicycle' },
  { value: 'scooter', label: 'Scooter', icon: 'ph:motorcycle' },
  { value: 'car', label: 'Car', icon: 'ph:car' },
] as const

const initials = computed(() => {
  const name = user.value?.name?.trim()
  if (!name) return '?'
  return name
    .split(' ')
    .filter(Boolean)
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
})

const memberSince = computed(() => {
  if (!user.value?.createdAt) return ''
  return new Date(user.value.createdAt).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
})

const roleBadge = computed(() => {
  const role = user.value?.role
  if (role === 'rider') return { label: 'Rider', class: 'bg-accent-100 text-accent-700' }
  if (role === 'admin') return { label: 'Admin', class: 'bg-neutral-800 text-white' }
  return { label: 'Customer', class: 'bg-primary-100 text-primary-700' }
})

// ── Success feedback ──
const successMessage = ref('')
function flashSuccess(msg: string) {
  successMessage.value = msg
  setTimeout(() => { successMessage.value = '' }, 3000)
}

// ── Personal Info ──
const editingPersonal = ref(false)
const personalForm = reactive({ name: '', email: '', phone: '' })
const personalErrors = reactive<Record<string, string>>({})
const savingPersonal = ref(false)

function startEditingPersonal() {
  if (!user.value) return
  personalForm.name = user.value.name
  personalForm.email = user.value.email
  personalForm.phone = user.value.phone
  Object.keys(personalErrors).forEach(k => delete personalErrors[k])
  editingPersonal.value = true
}

function cancelEditingPersonal() {
  editingPersonal.value = false
  Object.keys(personalErrors).forEach(k => delete personalErrors[k])
}

async function savePersonal() {
  const result = profilePersonalSchema.safeParse(personalForm)
  if (!result.success) {
    const flat = zodErrorsToRecord(result.error)
    Object.assign(personalErrors, flat)
    return
  }
  if (!user.value) return
  savingPersonal.value = true
  const snapshot = { name: user.value.name, email: user.value.email, phone: user.value.phone }
  try {
    await new Promise(r => setTimeout(r, 400))
    user.value.name = personalForm.name.trim()
    user.value.email = personalForm.email.trim()
    user.value.phone = personalForm.phone.trim()
    auth.persist()
    editingPersonal.value = false
    flashSuccess('Personal information updated.')
  }
  catch {
    user.value.name = snapshot.name
    user.value.email = snapshot.email
    user.value.phone = snapshot.phone
    flashSuccess('Failed to save personal information.')
  }
  finally {
    savingPersonal.value = false
  }
}

function clearPersonalError(field: string) {
  delete personalErrors[field]
}

// ── Addresses (customer) ──
const editingAddress = ref<string | null>(null)
const addressForm = reactive({ label: '', street: '', city: '', zipCode: '' })
const addressErrors = reactive<Record<string, string>>({})
const savingAddress = ref(false)

function startAddAddress() {
  addressForm.label = ''
  addressForm.street = ''
  addressForm.city = ''
  addressForm.zipCode = ''
  Object.keys(addressErrors).forEach(k => delete addressErrors[k])
  editingAddress.value = 'new'
}

function startEditAddress(id: string) {
  const addr = user.value?.addresses.find(a => a.id === id)
  if (!addr) return
  addressForm.label = addr.label
  addressForm.street = addr.street
  addressForm.city = addr.city
  addressForm.zipCode = addr.zipCode
  Object.keys(addressErrors).forEach(k => delete addressErrors[k])
  editingAddress.value = id
}

function cancelEditingAddress() {
  editingAddress.value = null
  Object.keys(addressErrors).forEach(k => delete addressErrors[k])
}

async function saveAddress() {
  const result = profileAddressSchema.safeParse(addressForm)
  if (!result.success) {
    const flat = zodErrorsToRecord(result.error)
    Object.assign(addressErrors, flat)
    return
  }
  if (!user.value) return
  savingAddress.value = true
  const snapshotAddresses = user.value.addresses.map(a => ({ ...a }))
  const wasNew = editingAddress.value === 'new'
  try {
    await new Promise(r => setTimeout(r, 300))

    if (editingAddress.value === 'new') {
      user.value.addresses.push({
        id: `addr_${Date.now()}`,
        label: addressForm.label.trim(),
        street: addressForm.street.trim(),
        city: addressForm.city.trim(),
        zipCode: addressForm.zipCode.trim(),
      })
    }
    else {
      const addr = user.value.addresses.find(a => a.id === editingAddress.value)
      if (addr) {
        addr.label = addressForm.label.trim()
        addr.street = addressForm.street.trim()
        addr.city = addressForm.city.trim()
        addr.zipCode = addressForm.zipCode.trim()
      }
    }

    auth.persist()
    editingAddress.value = null
    flashSuccess(wasNew ? 'Address added.' : 'Address updated.')
  }
  catch {
    user.value.addresses = snapshotAddresses
    flashSuccess('Failed to save address.')
  }
  finally {
    savingAddress.value = false
  }
}

function removeAddress(id: string) {
  if (!user.value) return
  user.value.addresses = user.value.addresses.filter(a => a.id !== id)
  auth.persist()
  flashSuccess('Address removed.')
}

function clearAddressError(field: string) {
  delete addressErrors[field]
}

// ── Vehicle Info (rider) ──
const editingVehicle = ref(false)
const vehicleForm = reactive({ vehicleType: 'bicycle' as 'bicycle' | 'scooter' | 'car', licenseNumber: '', insuranceNumber: '' })
const vehicleErrors = reactive<Record<string, string>>({})
const savingVehicle = ref(false)

function startEditingVehicle() {
  if (!user.value) return
  vehicleForm.vehicleType = user.value.vehicleType ?? 'bicycle'
  vehicleForm.licenseNumber = user.value.licenseNumber ?? ''
  vehicleForm.insuranceNumber = user.value.insuranceNumber ?? ''
  Object.keys(vehicleErrors).forEach(k => delete vehicleErrors[k])
  editingVehicle.value = true
}

function cancelEditingVehicle() {
  editingVehicle.value = false
  Object.keys(vehicleErrors).forEach(k => delete vehicleErrors[k])
}

async function saveVehicle() {
  const result = profileVehicleSchema.safeParse(vehicleForm)
  if (!result.success) {
    const flat = zodErrorsToRecord(result.error)
    Object.assign(vehicleErrors, flat)
    return
  }
  if (!user.value) return
  savingVehicle.value = true
  const snapshot = {
    vehicleType: user.value.vehicleType,
    licenseNumber: user.value.licenseNumber,
    insuranceNumber: user.value.insuranceNumber,
  }
  try {
    await new Promise(r => setTimeout(r, 400))
    user.value.vehicleType = vehicleForm.vehicleType
    user.value.licenseNumber = vehicleForm.licenseNumber.trim()
    user.value.insuranceNumber = vehicleForm.insuranceNumber.trim()
    auth.persist()
    editingVehicle.value = false
    flashSuccess('Vehicle information updated.')
  }
  catch {
    user.value.vehicleType = snapshot.vehicleType
    user.value.licenseNumber = snapshot.licenseNumber
    user.value.insuranceNumber = snapshot.insuranceNumber
    flashSuccess('Failed to save vehicle information.')
  }
  finally {
    savingVehicle.value = false
  }
}

function clearVehicleError(field: string) {
  delete vehicleErrors[field]
}

// ── Security ──
const securityForm = reactive({ currentPassword: '', newPassword: '', confirmNewPassword: '' })
const securityErrors = reactive<Record<string, string>>({})
const savingPassword = ref(false)

async function changePassword() {
  Object.keys(securityErrors).forEach(k => delete securityErrors[k])
  const result = profilePasswordSchema.safeParse(securityForm)
  if (!result.success) {
    const flat = zodErrorsToRecord(result.error)
    Object.assign(securityErrors, flat)
    return
  }
  savingPassword.value = true
  await new Promise(r => setTimeout(r, 600))
  savingPassword.value = false
  securityForm.currentPassword = ''
  securityForm.newPassword = ''
  securityForm.confirmNewPassword = ''
  flashSuccess('Password changed successfully.')
}

function clearSecurityError(field: string) {
  delete securityErrors[field]
}

function vehicleIcon(type?: string) {
  if (type === 'scooter') return 'ph:motorcycle'
  if (type === 'car') return 'ph:car'
  return 'ph:bicycle'
}
</script>

<template>
  <div v-if="user" class="min-h-screen bg-neutral-50">
    <!-- ═══ Hero Banner ═══ -->
    <section class="relative overflow-hidden bg-section-dark px-4 pb-20 pt-10 sm:px-8 sm:pt-16 lg:pt-20">
      <div class="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-primary-500/20 blur-3xl" />
      <div class="pointer-events-none absolute -bottom-20 -left-20 size-80 rounded-full bg-primary-400/15 blur-2xl" />
      <div class="pointer-events-none absolute left-1/3 top-1/2 size-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-600/10 blur-3xl" />

      <div class="relative z-10 mx-auto flex max-w-3xl flex-col items-center text-center">
        <!-- Avatar -->
        <div v-motion="heroFadeUp(0)" class="group relative">
          <div
            v-if="user.avatar"
            class="size-20 overflow-hidden rounded-full ring-4 ring-primary-500/30 sm:size-24 lg:size-28"
          >
            <img :src="user.avatar" :alt="user.name" class="size-full object-cover">
          </div>
          <div
            v-else
            class="flex size-20 items-center justify-center rounded-full bg-primary-500 text-h2 font-bold text-white ring-4 ring-primary-500/30 sm:size-24 lg:size-28 sm:text-h1"
          >
            {{ initials }}
          </div>
          <button
            class="absolute bottom-0 right-0 flex size-8 items-center justify-center rounded-full bg-white shadow-md transition-transform hover:scale-110 sm:size-9"
            aria-label="Change avatar"
          >
            <Icon name="ph:camera" class="size-4 text-text-secondary sm:size-5" />
          </button>
        </div>

        <!-- Name & role -->
        <h1 v-motion="heroFadeUp(100)" class="mt-4 text-h3 font-bold text-white sm:text-h2">
          {{ user.name }}
        </h1>
        <div v-motion="heroFadeUp(200)" class="mt-3 flex items-center gap-3">
          <span
            class="rounded-full px-3 py-1 text-caption font-semibold"
            :class="roleBadge.class"
          >
            {{ roleBadge.label }}
          </span>
          <span class="text-caption text-neutral-500">Member since {{ memberSince }}</span>
        </div>
      </div>
    </section>

    <!-- ═══ Tab Content ═══ -->
    <div class="relative z-10 mx-auto -mt-10 max-w-3xl px-4 pb-16 sm:px-8 lg:px-0">
      <!-- Success toast -->
      <Transition name="slide-down">
        <div
          v-if="successMessage"
          class="mb-4 rounded-xl border border-success/20 bg-success/10 px-4 py-3 text-body-sm font-medium text-success"
        >
          <div class="flex items-center gap-2">
            <Icon name="ph:check-circle-fill" class="size-5" />
            {{ successMessage }}
          </div>
        </div>
      </Transition>

      <Tabs default-value="personal">
        <TabsList class="mb-6 w-full rounded-xl bg-surface-lilac p-1">
          <TabsTrigger value="personal" class="rounded-lg data-[state=active]:bg-white data-[state=active]:text-primary-700 data-[state=active]:shadow-sm">
            <Icon name="ph:user" class="mr-1.5 size-4" />
            Personal
          </TabsTrigger>
          <TabsTrigger v-if="user.role === 'customer'" value="addresses" class="rounded-lg data-[state=active]:bg-white data-[state=active]:text-primary-700 data-[state=active]:shadow-sm">
            <Icon name="ph:map-pin" class="mr-1.5 size-4" />
            Addresses
          </TabsTrigger>
          <TabsTrigger v-if="user.role === 'rider'" value="vehicle" class="rounded-lg data-[state=active]:bg-white data-[state=active]:text-primary-700 data-[state=active]:shadow-sm">
            <Icon name="ph:motorcycle" class="mr-1.5 size-4" />
            Vehicle
          </TabsTrigger>
          <TabsTrigger value="security" class="rounded-lg data-[state=active]:bg-white data-[state=active]:text-primary-700 data-[state=active]:shadow-sm">
            <Icon name="ph:shield-check" class="mr-1.5 size-4" />
            Security
          </TabsTrigger>
        </TabsList>

        <!-- ── Personal Info ── -->
        <TabsContent value="personal">
          <Card v-motion="fadeUp(0)" class="overflow-hidden">
            <CardHeader class="flex flex-row items-center justify-between px-6 py-5">
              <div>
                <CardTitle class="text-h4 font-semibold">Personal Information</CardTitle>
                <CardDescription class="mt-1">Manage your account details</CardDescription>
              </div>
              <Button
                v-if="!editingPersonal"
                variant="outline"
                size="sm"
                @click="startEditingPersonal"
              >
                <Icon name="ph:pencil-simple" class="size-4" />
                Edit
              </Button>
            </CardHeader>

            <CardContent class="px-6 pb-6">
              <!-- View mode -->
              <div v-if="!editingPersonal" class="space-y-4">
                <div class="flex items-center gap-4 rounded-xl bg-surface-purple p-4">
                  <div class="flex size-10 items-center justify-center rounded-lg bg-primary-100">
                    <Icon name="ph:user" class="size-5 text-primary-600" />
                  </div>
                  <div>
                    <p class="text-caption font-medium text-text-muted">Full name</p>
                    <p class="text-body font-medium text-text-primary">{{ user.name }}</p>
                  </div>
                </div>
                <div class="flex items-center gap-4 rounded-xl bg-surface-purple p-4">
                  <div class="flex size-10 items-center justify-center rounded-lg bg-primary-100">
                    <Icon name="ph:envelope" class="size-5 text-primary-600" />
                  </div>
                  <div>
                    <p class="text-caption font-medium text-text-muted">Email</p>
                    <p class="text-body font-medium text-text-primary">{{ user.email }}</p>
                  </div>
                </div>
                <div class="flex items-center gap-4 rounded-xl bg-surface-purple p-4">
                  <div class="flex size-10 items-center justify-center rounded-lg bg-primary-100">
                    <Icon name="ph:phone" class="size-5 text-primary-600" />
                  </div>
                  <div>
                    <p class="text-caption font-medium text-text-muted">Phone</p>
                    <p class="text-body font-medium text-text-primary">{{ user.phone }}</p>
                  </div>
                </div>
              </div>

              <!-- Edit mode -->
              <form v-else class="space-y-4" novalidate @submit.prevent="savePersonal">
                <FormField id="profile-name" label="Full name" :error="personalErrors.name">
                  <template #default="{ id: fieldId }">
                    <Input
                      :id="fieldId"
                      v-model="personalForm.name"
                      type="text"
                      placeholder="Your full name"
                      :aria-invalid="!!personalErrors.name || undefined"
                      @input="clearPersonalError('name')"
                    />
                  </template>
                </FormField>
                <FormField id="profile-email" label="Email" :error="personalErrors.email">
                  <template #default="{ id: fieldId }">
                    <Input
                      :id="fieldId"
                      v-model="personalForm.email"
                      type="email"
                      placeholder="you@example.com"
                      :aria-invalid="!!personalErrors.email || undefined"
                      @input="clearPersonalError('email')"
                    />
                  </template>
                </FormField>
                <FormField id="profile-phone" label="Phone" :error="personalErrors.phone">
                  <template #default="{ id: fieldId }">
                    <Input
                      :id="fieldId"
                      v-model="personalForm.phone"
                      type="tel"
                      placeholder="+33 6..."
                      :aria-invalid="!!personalErrors.phone || undefined"
                      @input="clearPersonalError('phone')"
                    />
                  </template>
                </FormField>

                <div class="flex items-center gap-3 pt-2">
                  <Button type="submit" variant="gradient" size="pill-sm" :disabled="savingPersonal">
                    {{ savingPersonal ? 'Saving...' : 'Save changes' }}
                  </Button>
                  <Button type="button" variant="ghost" size="pill-sm" @click="cancelEditingPersonal">
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <!-- ── Addresses (customer) ── -->
        <TabsContent v-if="user.role === 'customer'" value="addresses">
          <Card v-motion="fadeUp(0)" class="overflow-hidden">
            <CardHeader class="flex flex-row items-center justify-between px-6 py-5">
              <div>
                <CardTitle class="text-h4 font-semibold">Delivery Addresses</CardTitle>
                <CardDescription class="mt-1">Manage your delivery locations</CardDescription>
              </div>
              <Button
                v-if="editingAddress === null"
                variant="gradient"
                size="sm"
                @click="startAddAddress"
              >
                <Icon name="ph:plus" class="size-4" />
                Add
              </Button>
            </CardHeader>

            <CardContent class="px-6 pb-6">
              <!-- Address list -->
              <div v-if="user.addresses.length > 0 && editingAddress === null" class="space-y-3">
                <div
                  v-for="(addr, index) in user.addresses"
                  :key="addr.id"
                  v-motion="fadeUp(index * 80)"
                  class="group flex items-start justify-between rounded-xl bg-surface-purple p-4 transition-colors hover:bg-surface-lilac"
                >
                  <div class="flex items-start gap-4">
                    <div class="flex size-10 items-center justify-center rounded-lg bg-primary-100">
                      <Icon name="ph:map-pin" class="size-5 text-primary-600" />
                    </div>
                    <div>
                      <p class="text-body-sm font-semibold text-text-primary">{{ addr.label }}</p>
                      <p class="text-body-sm text-text-muted">{{ addr.street }}</p>
                      <p class="text-caption text-text-muted">{{ addr.zipCode }} {{ addr.city }}</p>
                    </div>
                  </div>
                  <div class="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button variant="ghost" size="icon-sm" @click="startEditAddress(addr.id)">
                      <Icon name="ph:pencil-simple" class="size-4 text-text-muted" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" @click="removeAddress(addr.id)">
                      <Icon name="ph:trash" class="size-4 text-error" />
                    </Button>
                  </div>
                </div>
              </div>

              <!-- Empty state -->
              <div v-else-if="user.addresses.length === 0 && editingAddress === null" class="py-8 text-center">
                <div class="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-surface-purple">
                  <Icon name="ph:map-pin" class="size-7 text-primary-400" />
                </div>
                <p class="text-body-sm font-medium text-text-secondary">No addresses yet</p>
                <p class="mt-1 text-caption text-text-muted">Add a delivery address to get started</p>
              </div>

              <!-- Address form (add/edit) -->
              <form v-if="editingAddress !== null" class="space-y-4" novalidate @submit.prevent="saveAddress">
                <div class="rounded-xl border border-primary-200 bg-surface-purple p-4">
                  <p class="mb-4 text-body-sm font-semibold text-text-primary">
                    {{ editingAddress === 'new' ? 'New address' : 'Edit address' }}
                  </p>
                  <div class="space-y-3">
                    <FormField id="addr-label" label="Label" :error="addressErrors.label">
                      <template #default="{ id: fieldId }">
                        <Input
                          :id="fieldId"
                          v-model="addressForm.label"
                          placeholder="Home, Office..."
                          :aria-invalid="!!addressErrors.label || undefined"
                          @input="clearAddressError('label')"
                        />
                      </template>
                    </FormField>
                    <FormField id="addr-street" label="Street" :error="addressErrors.street">
                      <template #default="{ id: fieldId }">
                        <Input
                          :id="fieldId"
                          v-model="addressForm.street"
                          placeholder="123 Rue de la Paix"
                          :aria-invalid="!!addressErrors.street || undefined"
                          @input="clearAddressError('street')"
                        />
                      </template>
                    </FormField>
                    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <FormField id="addr-city" label="City" :error="addressErrors.city">
                        <template #default="{ id: fieldId }">
                          <Input
                            :id="fieldId"
                            v-model="addressForm.city"
                            placeholder="Paris"
                            :aria-invalid="!!addressErrors.city || undefined"
                            @input="clearAddressError('city')"
                          />
                        </template>
                      </FormField>
                      <FormField id="addr-zip" label="Zip code" :error="addressErrors.zipCode">
                        <template #default="{ id: fieldId }">
                          <Input
                            :id="fieldId"
                            v-model="addressForm.zipCode"
                            placeholder="75001"
                            :aria-invalid="!!addressErrors.zipCode || undefined"
                            @input="clearAddressError('zipCode')"
                          />
                        </template>
                      </FormField>
                    </div>
                  </div>
                </div>
                <div class="flex items-center gap-3">
                  <Button type="submit" variant="gradient" size="pill-sm" :disabled="savingAddress">
                    {{ savingAddress ? 'Saving...' : (editingAddress === 'new' ? 'Add address' : 'Save changes') }}
                  </Button>
                  <Button type="button" variant="ghost" size="pill-sm" @click="cancelEditingAddress">
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <!-- ── Vehicle Info (rider) ── -->
        <TabsContent v-if="user.role === 'rider'" value="vehicle">
          <Card v-motion="fadeUp(0)" class="overflow-hidden">
            <CardHeader class="flex flex-row items-center justify-between px-6 py-5">
              <div>
                <CardTitle class="text-h4 font-semibold">Vehicle Information</CardTitle>
                <CardDescription class="mt-1">Your delivery vehicle details</CardDescription>
              </div>
              <Button
                v-if="!editingVehicle"
                variant="outline"
                size="sm"
                @click="startEditingVehicle"
              >
                <Icon name="ph:pencil-simple" class="size-4" />
                Edit
              </Button>
            </CardHeader>

            <CardContent class="px-6 pb-6">
              <!-- View mode -->
              <div v-if="!editingVehicle" class="space-y-4">
                <div class="flex items-center gap-4 rounded-xl bg-surface-violet p-4">
                  <div class="flex size-10 items-center justify-center rounded-lg bg-accent-100">
                    <Icon :name="vehicleIcon(user.vehicleType)" class="size-5 text-accent-600" />
                  </div>
                  <div>
                    <p class="text-caption font-medium text-text-muted">Vehicle type</p>
                    <p class="text-body font-medium capitalize text-text-primary">{{ user.vehicleType ?? '—' }}</p>
                  </div>
                </div>
                <div class="flex items-center gap-4 rounded-xl bg-surface-violet p-4">
                  <div class="flex size-10 items-center justify-center rounded-lg bg-accent-100">
                    <Icon name="ph:identification-card" class="size-5 text-accent-600" />
                  </div>
                  <div>
                    <p class="text-caption font-medium text-text-muted">License number</p>
                    <p class="text-body font-medium text-text-primary">{{ user.licenseNumber ?? '—' }}</p>
                  </div>
                </div>
                <div class="flex items-center gap-4 rounded-xl bg-surface-violet p-4">
                  <div class="flex size-10 items-center justify-center rounded-lg bg-accent-100">
                    <Icon name="ph:shield-check" class="size-5 text-accent-600" />
                  </div>
                  <div>
                    <p class="text-caption font-medium text-text-muted">Insurance number</p>
                    <p class="text-body font-medium text-text-primary">{{ user.insuranceNumber ?? '—' }}</p>
                  </div>
                </div>
              </div>

              <!-- Edit mode -->
              <form v-else class="space-y-5" novalidate @submit.prevent="saveVehicle">
                <!-- Vehicle type radio -->
                <div>
                  <label class="text-body-sm font-medium text-neutral-800">Vehicle type</label>
                  <div role="radiogroup" aria-label="Vehicle type" class="mt-2 grid grid-cols-3 gap-3">
                    <label
                      v-for="option in vehicleOptions"
                      :key="option.value"
                      :for="`profile-vehicle-${option.value}`"
                      class="relative flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 px-3 py-4 transition-all hover:border-primary-300 hover:bg-primary-50/50"
                      :class="[
                        vehicleForm.vehicleType === option.value
                          ? 'border-primary-500 bg-primary-50 shadow-sm'
                          : 'border-neutral-200 bg-white',
                      ]"
                    >
                      <input
                        :id="`profile-vehicle-${option.value}`"
                        v-model="vehicleForm.vehicleType"
                        type="radio"
                        name="profileVehicleType"
                        :value="option.value"
                        class="sr-only"
                      >
                      <Icon
                        :name="option.icon"
                        class="size-6 transition-colors"
                        :class="vehicleForm.vehicleType === option.value ? 'text-primary-600' : 'text-neutral-400'"
                      />
                      <span
                        class="text-body-sm font-medium transition-colors"
                        :class="vehicleForm.vehicleType === option.value ? 'text-primary-700' : 'text-text-muted'"
                      >
                        {{ option.label }}
                      </span>
                      <div
                        v-if="vehicleForm.vehicleType === option.value"
                        class="absolute -right-px -top-px flex size-5 items-center justify-center rounded-bl-lg rounded-tr-[10px] bg-primary-500"
                      >
                        <Icon name="ph:check-bold" class="size-3 text-white" />
                      </div>
                    </label>
                  </div>
                  <p v-if="vehicleErrors.vehicleType" role="alert" class="mt-1 text-caption text-error">
                    {{ vehicleErrors.vehicleType }}
                  </p>
                </div>

                <FormField id="profile-license" label="License number" :error="vehicleErrors.licenseNumber">
                  <template #default="{ id: fieldId }">
                    <Input
                      :id="fieldId"
                      v-model="vehicleForm.licenseNumber"
                      placeholder="AB-123-CD"
                      :aria-invalid="!!vehicleErrors.licenseNumber || undefined"
                      @input="clearVehicleError('licenseNumber')"
                    />
                  </template>
                </FormField>
                <FormField id="profile-insurance" label="Insurance number" :error="vehicleErrors.insuranceNumber">
                  <template #default="{ id: fieldId }">
                    <Input
                      :id="fieldId"
                      v-model="vehicleForm.insuranceNumber"
                      placeholder="INS-000-000"
                      :aria-invalid="!!vehicleErrors.insuranceNumber || undefined"
                      @input="clearVehicleError('insuranceNumber')"
                    />
                  </template>
                </FormField>

                <div class="flex items-center gap-3 pt-2">
                  <Button type="submit" variant="gradient" size="pill-sm" :disabled="savingVehicle">
                    {{ savingVehicle ? 'Saving...' : 'Save changes' }}
                  </Button>
                  <Button type="button" variant="ghost" size="pill-sm" @click="cancelEditingVehicle">
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <!-- ── Security ── -->
        <TabsContent value="security">
          <div class="space-y-6">
            <!-- Change password -->
            <Card v-motion="fadeUp(0)" class="overflow-hidden">
              <CardHeader class="px-6 py-5">
                <CardTitle class="text-h4 font-semibold">Change Password</CardTitle>
                <CardDescription class="mt-1">Update your account password</CardDescription>
              </CardHeader>
              <CardContent class="px-6 pb-6">
                <form class="space-y-4" novalidate @submit.prevent="changePassword">
                  <FormField id="sec-current" label="Current password" :error="securityErrors.currentPassword">
                    <template #default="{ id: fieldId }">
                      <Input
                        :id="fieldId"
                        v-model="securityForm.currentPassword"
                        type="password"
                        placeholder="Enter current password"
                        autocomplete="current-password"
                        :aria-invalid="!!securityErrors.currentPassword || undefined"
                        @input="clearSecurityError('currentPassword')"
                      />
                    </template>
                  </FormField>
                  <FormField id="sec-new" label="New password" :error="securityErrors.newPassword">
                    <template #default="{ id: fieldId }">
                      <Input
                        :id="fieldId"
                        v-model="securityForm.newPassword"
                        type="password"
                        placeholder="At least 8 characters"
                        autocomplete="new-password"
                        :aria-invalid="!!securityErrors.newPassword || undefined"
                        @input="clearSecurityError('newPassword')"
                      />
                    </template>
                  </FormField>
                  <FormField id="sec-confirm" label="Confirm new password" :error="securityErrors.confirmNewPassword">
                    <template #default="{ id: fieldId }">
                      <Input
                        :id="fieldId"
                        v-model="securityForm.confirmNewPassword"
                        type="password"
                        placeholder="Repeat new password"
                        autocomplete="new-password"
                        :aria-invalid="!!securityErrors.confirmNewPassword || undefined"
                        @input="clearSecurityError('confirmNewPassword')"
                      />
                    </template>
                  </FormField>
                  <div class="pt-2">
                    <Button type="submit" variant="gradient" size="pill-sm" :disabled="savingPassword">
                      {{ savingPassword ? 'Updating...' : 'Update password' }}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Separator />

            <!-- Danger zone -->
            <Card v-motion="fadeUp(100)" class="overflow-hidden border-error/20">
              <CardHeader class="bg-error/5 px-6 py-5">
                <CardTitle class="text-h4 font-semibold text-error">Danger Zone</CardTitle>
                <CardDescription class="mt-1">Irreversible account actions</CardDescription>
              </CardHeader>
              <CardContent class="px-6 py-5">
                <p class="mb-4 text-body-sm text-text-muted">
                  Once you delete your account, all your data, orders, and rental history will be permanently removed. This action cannot be undone.
                </p>
                <Button variant="destructive" size="pill-sm" disabled title="Account deletion coming in Phase 2">
                  <Icon name="ph:trash" class="size-4" />
                  Delete account
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  </div>
</template>

<style scoped>
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease;
}
.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
