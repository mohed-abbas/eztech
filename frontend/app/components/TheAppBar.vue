<script setup lang="ts">
const route = useRoute()
const auth = useAuthStore()
const cart = useCartStore()
const { user, isAuthenticated, role } = storeToRefs(auth)
const { count: cartCount } = storeToRefs(cart)

const mobileOpen = ref(false)
const dropdownOpen = ref(false)
const dropdownRef = ref<HTMLDivElement | null>(null)

const navItems = computed(() => {
  const items: { label: string, to: string, icon: string }[] = [
    { label: 'Produits', to: '/products', icon: 'ph:package' },
  ]

  if (role.value === 'customer') {
    items.push({ label: 'Mes commandes', to: '/orders', icon: 'ph:receipt' })
  }

  if (role.value === 'rider') {
    items.push(
      { label: 'Tableau de bord', to: '/rider/dashboard', icon: 'ph:gauge' },
      { label: 'Livraisons', to: '/rider/deliveries', icon: 'ph:truck' },
    )
  }

  if (role.value === 'admin') {
    items.push({ label: 'Commandes', to: '/orders', icon: 'ph:receipt' })
  }

  return items
})

const initials = computed(() => {
  if (!user.value?.name) return '?'
  return user.value.name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
})

const showCart = computed(() => role.value === 'customer')

function isActive(path: string): boolean {
  if (path === '/products') return route.path === '/products' || route.path.startsWith('/products/')
  if (path === '/orders') return route.path === '/orders' || route.path.startsWith('/orders/')
  return route.path.startsWith(path)
}

function handleLogout() {
  dropdownOpen.value = false
  mobileOpen.value = false
  auth.logout()
}

function closeMobile() {
  mobileOpen.value = false
}

function onClickOutsideDropdown(e: Event) {
  if (dropdownRef.value && !dropdownRef.value.contains(e.target as Node)) {
    dropdownOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', onClickOutsideDropdown)
  auth.hydrate()
  cart.hydrate()
})

onUnmounted(() => {
  document.removeEventListener('click', onClickOutsideDropdown)
})

watch(() => route.path, () => {
  mobileOpen.value = false
  dropdownOpen.value = false
})
</script>

<template>
  <header class="fixed top-0 inset-x-0 z-50 h-16 bg-white/80 backdrop-blur-xl border-b border-neutral-200/60 shadow-sm">
    <div class="mx-auto max-w-7xl h-full flex items-center justify-between px-4 sm:px-6 lg:px-8">

      <!-- Left: Logo + Nav links -->
      <div class="flex items-center gap-8">
        <NuxtLink to="/products" class="flex items-center gap-2.5 group shrink-0">
          <div class="size-9 rounded-full bg-primary-500 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
            <Icon name="ph:package" class="size-4 text-white" />
          </div>
          <span class="text-lg font-semibold text-neutral-900 hidden sm:block">EzTech</span>
        </NuxtLink>

        <!-- Desktop nav links -->
        <nav class="hidden md:flex items-center gap-1">
          <NuxtLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            :class="isActive(item.to)
              ? 'text-primary-600 bg-primary-50'
              : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50'"
          >
            <Icon :name="item.icon" class="size-4" />
            {{ item.label }}
          </NuxtLink>
        </nav>
      </div>

      <!-- Right: Cart + Avatar + Mobile toggle -->
      <div class="flex items-center gap-2">

        <!-- Cart button (customers only) -->
        <NuxtLink
          v-if="showCart"
          to="/cart"
          class="relative flex items-center justify-center size-10 rounded-lg transition-colors"
          :class="isActive('/cart')
            ? 'text-primary-600 bg-primary-50'
            : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50'"
        >
          <Icon name="ph:shopping-cart" class="size-5" />
          <Transition
            enter-active-class="transition-all duration-300 ease-out"
            enter-from-class="scale-0 opacity-0"
            enter-to-class="scale-100 opacity-100"
            leave-active-class="transition-all duration-200 ease-in"
            leave-from-class="scale-100 opacity-100"
            leave-to-class="scale-0 opacity-0"
          >
            <span
              v-if="cartCount > 0"
              class="absolute -top-0.5 -right-0.5 flex items-center justify-center size-5 rounded-full bg-primary-500 text-[10px] font-bold text-white ring-2 ring-white"
            >
              {{ cartCount > 99 ? '99+' : cartCount }}
            </span>
          </Transition>
        </NuxtLink>

        <!-- Desktop avatar dropdown -->
        <div v-if="isAuthenticated" ref="dropdownRef" class="relative hidden md:block">
          <button
            class="flex items-center gap-2 rounded-full p-1 pr-3 transition-colors hover:bg-neutral-50"
            @click.stop="dropdownOpen = !dropdownOpen"
          >
            <div
              v-if="user?.avatar"
              class="size-8 rounded-full bg-cover bg-center ring-2 ring-primary-100"
              :style="{ backgroundImage: `url(${user.avatar})` }"
            />
            <div
              v-else
              class="size-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-semibold ring-2 ring-primary-50"
            >
              {{ initials }}
            </div>
            <Icon
              name="ph:caret-down"
              class="size-3.5 text-neutral-400 transition-transform duration-200"
              :class="dropdownOpen && 'rotate-180'"
            />
          </button>

          <!-- Dropdown menu -->
          <Transition
            enter-active-class="transition-all duration-200 ease-out"
            enter-from-class="opacity-0 scale-95 -translate-y-1"
            enter-to-class="opacity-100 scale-100 translate-y-0"
            leave-active-class="transition-all duration-150 ease-in"
            leave-from-class="opacity-100 scale-100 translate-y-0"
            leave-to-class="opacity-0 scale-95 -translate-y-1"
          >
            <div
              v-if="dropdownOpen"
              class="absolute right-0 top-full mt-2 w-64 rounded-xl bg-white border border-neutral-200/80 shadow-xl shadow-neutral-900/5 overflow-hidden"
            >
              <!-- User info header -->
              <div class="px-4 py-3 bg-neutral-50/80">
                <p class="text-sm font-semibold text-neutral-900 truncate">{{ user?.name }}</p>
                <p class="text-xs text-neutral-500 truncate">{{ user?.email }}</p>
                <span class="mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide bg-primary-100 text-primary-700">
                  {{ user?.role }}
                </span>
              </div>

              <Separator />

              <!-- Menu items -->
              <div class="py-1">
                <NuxtLink
                  to="/profile"
                  class="flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
                  @click="dropdownOpen = false"
                >
                  <Icon name="ph:user-circle" class="size-4 text-neutral-400" />
                  Profil
                </NuxtLink>

                <NuxtLink
                  v-if="role === 'customer'"
                  to="/orders"
                  class="flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
                  @click="dropdownOpen = false"
                >
                  <Icon name="ph:receipt" class="size-4 text-neutral-400" />
                  Mes commandes
                </NuxtLink>
              </div>

              <Separator />

              <div class="py-1">
                <button
                  class="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  @click="handleLogout"
                >
                  <Icon name="ph:sign-out" class="size-4" />
                  Déconnexion
                </button>
              </div>
            </div>
          </Transition>
        </div>

        <!-- Mobile hamburger -->
        <button
          class="md:hidden flex items-center justify-center size-10 rounded-lg text-neutral-500 hover:bg-neutral-50 transition-colors"
          aria-label="Ouvrir le menu"
          :aria-expanded="mobileOpen"
          aria-controls="mobile-menu"
          @click="mobileOpen = !mobileOpen"
        >
          <div class="flex flex-col items-center justify-center gap-[5px] w-5">
            <span
              class="block w-full h-[2px] rounded-full bg-current origin-center transition-all duration-300"
              :class="mobileOpen ? 'rotate-45 translate-y-[3.5px]' : ''"
            />
            <span
              class="block w-full h-[2px] rounded-full bg-current origin-center transition-all duration-300"
              :class="mobileOpen ? '-rotate-45 -translate-y-[3.5px]' : ''"
            />
          </div>
        </button>
      </div>
    </div>

    <!-- Mobile menu panel -->
    <Transition
      enter-active-class="transition-all duration-300 ease-out"
      enter-from-class="opacity-0 -translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition-all duration-200 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-2"
    >
      <div
        v-if="mobileOpen"
        id="mobile-menu"
        class="md:hidden absolute top-full inset-x-0 bg-white/95 backdrop-blur-xl border-b border-neutral-200/60 shadow-lg"
      >
        <nav class="px-4 py-3 space-y-1">
          <NuxtLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
            :class="isActive(item.to)
              ? 'text-primary-600 bg-primary-50'
              : 'text-neutral-600 hover:bg-neutral-50'"
            @click="closeMobile"
          >
            <Icon :name="item.icon" class="size-4" />
            {{ item.label }}
          </NuxtLink>
        </nav>

        <Separator />

        <!-- User section in mobile -->
        <div v-if="isAuthenticated" class="px-4 py-3">
          <div class="flex items-center gap-3 mb-3">
            <div
              v-if="user?.avatar"
              class="size-10 rounded-full bg-cover bg-center ring-2 ring-primary-100"
              :style="{ backgroundImage: `url(${user.avatar})` }"
            />
            <div
              v-else
              class="size-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-semibold"
            >
              {{ initials }}
            </div>
            <div class="min-w-0">
              <p class="text-sm font-semibold text-neutral-900 truncate">{{ user?.name }}</p>
              <p class="text-xs text-neutral-500 truncate">{{ user?.email }}</p>
            </div>
          </div>

          <div class="space-y-1">
            <NuxtLink
              to="/profile"
              class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-neutral-600 hover:bg-neutral-50 transition-colors"
              @click="closeMobile"
            >
              <Icon name="ph:user-circle" class="size-4 text-neutral-400" />
              Profil
            </NuxtLink>

            <button
              class="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
              @click="handleLogout"
            >
              <Icon name="ph:sign-out" class="size-4" />
              Déconnexion
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </header>
</template>
