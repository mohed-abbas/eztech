<script setup lang="ts">
definePageMeta({
  layout: false,
})

useHead({
  title: 'EzTech — Rent Premium. Deliver Smart.',
  meta: [
    { name: 'description', content: 'Premium tech rental delivered in minutes. Browse, rent, and receive laptops, cameras, drones, and more — all from your phone.' },
  ],
})

const { user, isAuthenticated, logout } = useAuth()

// Fullscreen menu state
const menuOpen = ref(false)

// Navbar scroll state
const scrolled = ref(false)

// Body scroll lock when menu is open
watch(menuOpen, (open) => {
  if (import.meta.client) {
    document.body.style.overflow = open ? 'hidden' : ''
  }
})

onMounted(() => {
  const onScroll = () => {
    scrolled.value = window.scrollY > 20
  }
  window.addEventListener('scroll', onScroll, { passive: true })
  onUnmounted(() => {
    window.removeEventListener('scroll', onScroll)
    document.body.style.overflow = ''
  })
})

// Shared motion presets
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  visibleOnce: { opacity: 1, y: 0, transition: { duration: 600, delay, ease: 'easeOut' } },
})

const fadeScale = (delay = 0) => ({
  initial: { opacity: 0, scale: 0.96 },
  visibleOnce: { opacity: 1, scale: 1, transition: { duration: 700, delay, ease: 'easeOut' } },
})

const heroFadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 20 },
  enter: { opacity: 1, y: 0, transition: { duration: 700, delay, ease: 'easeOut' } },
})

const menuLinkMotion = (idx: number) => ({
  initial: { opacity: 0, y: 30 },
  enter: { opacity: 1, y: 0, transition: { duration: 500, delay: 200 + idx * 60, ease: 'easeOut' } },
})

// Products data
const featuredProducts = [
  { name: 'MacBook Pro M3', type: 'Laptop', price: '$25.00', icon1: 'ph:cpu', spec1: 'M3 Pro', icon2: 'ph:memory', spec2: '18GB', icon3: 'ph:hard-drive', spec3: '512GB', heroIcon: 'ph:laptop' },
  { name: 'Sony A7 IV', type: 'Camera', price: '$18.00', icon1: 'ph:aperture', spec1: '33MP', icon2: 'ph:film-strip', spec2: '4K 60', icon3: 'ph:crosshair', spec3: '693 AF', heroIcon: 'ph:camera' },
  { name: 'DJI Mavic 3', type: 'Drone', price: '$32.00', icon1: 'ph:timer', spec1: '46min', icon2: 'ph:video-camera', spec2: '5.1K', icon3: 'ph:wifi-high', spec3: '15km', heroIcon: 'ph:drone' },
  { name: 'iPad Pro M2', type: 'Tablet', price: '$15.00', icon1: 'ph:cpu', spec1: 'M2', icon2: 'ph:monitor', spec2: '12.9"', icon3: 'ph:pencil-simple', spec3: 'Pencil', heroIcon: 'ph:device-tablet' },
]

const features = [
  { icon: 'ph:lightning', title: 'Instant Delivery', desc: 'Get your tech delivered within hours. Same-day shipping available in 40+ cities nationwide.', bg: 'bg-surface-purple', hoverBg: 'group-hover:bg-primary-100', iconColor: 'text-primary-500' },
  { icon: 'ph:shield-check', title: 'Premium Protection', desc: 'Every rental includes full coverage insurance. No hidden fees, no surprises — just peace of mind.', bg: 'bg-surface-violet', hoverBg: 'group-hover:bg-accent-200', iconColor: 'text-accent-500' },
  { icon: 'ph:devices', title: 'Wide Catalog', desc: '250+ premium devices from laptops and cameras to drones and tablets — always the latest models.', bg: 'bg-surface-lavender', hoverBg: 'group-hover:bg-primary-100', iconColor: 'text-primary-600' },
  { icon: 'ph:arrows-clockwise', title: 'Flexible Returns', desc: 'Extend your rental or return early — no penalties. Schedule pickup at your convenience.', bg: 'bg-surface-lilac', hoverBg: 'group-hover:bg-primary-100', iconColor: 'text-primary-700' },
]

const navLinks = [
  { label: 'Products', href: '/products' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Pricing', href: '#pricing' },
]

const menuLinks = computed(() => [
  ...navLinks,
  ...(isAuthenticated.value
    ? [{ label: 'Profile', href: '/profile' }]
    : [{ label: 'Sign In', href: '/login' }, { label: 'Get Started', href: '/register' }]),
])
</script>

<template>
  <div class="min-h-screen bg-background font-sans text-foreground overflow-x-hidden">
    <!-- ═══════════════════════════════════════════
         NAVBAR — Logo + Burger only
         ═══════════════════════════════════════════ -->
    <header
      :class="[
        'fixed top-0 inset-x-0 transition-all duration-300',
        menuOpen ? 'z-[70]' : 'z-50',
        scrolled && !menuOpen
          ? 'bg-white/80 backdrop-blur-md border-b border-neutral-200/60 shadow-sm'
          : 'bg-transparent',
      ]"
    >
      <div class="mx-auto max-w-7xl flex items-center justify-between px-6 lg:px-8 py-5">
        <!-- Logo -->
        <NuxtLink to="/" class="relative flex items-center gap-2.5 group" @click="menuOpen = false">
          <div class="size-9 rounded-full bg-primary-500 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
            <Icon name="ph:package" class="size-4 text-white" />
          </div>
          <span :class="['text-h3 font-semibold transition-colors duration-300', menuOpen ? 'text-white' : 'text-neutral-900']">EzTech</span>
        </NuxtLink>

        <!-- Burger / Close button -->
        <button
          :class="['burger-btn relative flex flex-col items-center justify-center size-12 gap-[7px] rounded-full transition-colors', menuOpen ? '' : 'hover:bg-neutral-100']"
          aria-label="Toggle menu"
          @click="menuOpen = !menuOpen"
        >
          <span :class="['block w-7 h-[2.5px] rounded-full origin-center transition-all duration-400 ease-[cubic-bezier(0.76,0,0.24,1)]', menuOpen ? 'bg-white rotate-45 translate-y-[4.75px]' : 'bg-neutral-800']" />
          <span :class="['block w-7 h-[2.5px] rounded-full origin-center transition-all duration-400 ease-[cubic-bezier(0.76,0,0.24,1)]', menuOpen ? 'bg-white -rotate-45 -translate-y-[4.75px]' : 'bg-neutral-800']" />
        </button>
      </div>
    </header>

    <!-- ═══════════════════════════════════════════
         FULLSCREEN MENU OVERLAY
         ═══════════════════════════════════════════ -->
    <Teleport to="body">
      <Transition
        enter-active-class="menu-enter-active"
        enter-from-class="menu-enter-from"
        enter-to-class="menu-enter-to"
        leave-active-class="menu-leave-active"
        leave-from-class="menu-leave-from"
        leave-to-class="menu-leave-to"
      >
        <div
          v-if="menuOpen"
          class="fixed inset-0 z-[60] bg-primary-600 flex flex-col"
        >
          <!-- Spacer for navbar height -->
          <div class="h-[84px] shrink-0" />

          <!-- Menu content -->
          <nav class="flex-1 flex flex-col justify-center px-8 sm:px-12 lg:px-20 overflow-y-auto">
            <div class="max-w-5xl w-full">
              <NuxtLink
                v-for="(link, idx) in menuLinks"
                :key="link.label"
                v-motion="menuLinkMotion(idx)"
                :to="link.href"
                class="group flex items-center gap-4 py-4 sm:py-5 border-b border-white/15"
                @click="menuOpen = false"
              >
                <span class="font-poppins font-medium text-3xl sm:text-4xl lg:text-5xl text-primary-200 group-hover:text-white transition-all duration-300 group-hover:translate-x-2">
                  {{ link.label }}
                </span>
                <Icon
                  name="ph:arrow-right"
                  class="size-6 sm:size-8 text-primary-300 opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300"
                />
              </NuxtLink>

              <!-- Logout if authenticated -->
              <button
                v-if="isAuthenticated"
                v-motion="menuLinkMotion(menuLinks.length)"
                class="group flex items-center gap-4 py-4 sm:py-5 border-b border-white/15 w-full text-left"
                @click="logout(); menuOpen = false"
              >
                <span class="font-poppins font-medium text-3xl sm:text-4xl lg:text-5xl text-red-200 group-hover:text-red-100 transition-all duration-300 group-hover:translate-x-2">
                  Log out
                </span>
              </button>
            </div>
          </nav>

          <!-- Footer -->
          <div class="px-8 sm:px-12 lg:px-20 py-8 text-primary-200/60 text-sm font-poppins">
            &copy; {{ new Date().getFullYear() }} EzTech. All rights reserved.
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ═══════════════════════════════════════════
         HERO SECTION (Figma: 186:2)
         ═══════════════════════════════════════════ -->
    <section class="hero-section relative bg-white overflow-x-clip pt-[72px]">
      <!-- Geometric background pattern from Figma -->
      <img
        src="/assets/hero-bg-pattern.svg"
        alt=""
        aria-hidden="true"
        class="absolute left-0 top-0 w-full h-[1182px] object-cover pointer-events-none select-none"
      />

      <div class="relative mx-auto max-w-[1240px] px-6">
        <!-- Hero content -->
        <div class="flex flex-col items-center pt-[36px] pb-0">
          <!-- Heading -->
          <h1
            v-motion="heroFadeUp(100)"
            class="font-poppins font-semibold text-[clamp(2.5rem,5.5vw,76px)] leading-[1.2] capitalize text-[#1f2937] max-w-[605px] text-center"
          >
            Rent Premium. Deliver Smart.
          </h1>

          <!-- Description -->
          <p
            v-motion="heroFadeUp(250)"
            class="mt-[22px] font-poppins font-normal text-[clamp(1rem,1.5vw,20px)] leading-[1.5] text-[rgba(68,69,78,0.7)] max-w-[749px] text-center"
          >
            Experience tech at your fingertips. Browse, rent, and receive — all from your phone with EzTech's intelligent rental platform.
          </p>

          <!-- CTA buttons -->
          <div
            v-motion="heroFadeUp(400)"
            class="mt-7 flex items-center gap-2.5"
          >
            <NuxtLink
              to="/products"
              class="hero-btn-primary relative overflow-hidden rounded-[37px] border border-white px-6 py-3 font-poppins font-medium text-sm leading-[22px] text-white capitalize transition-opacity hover:opacity-90"
            >
              Get Started
            </NuxtLink>
            <NuxtLink
              to="/register"
              class="bg-white rounded-[71px] px-6 py-2.5 font-poppins font-medium text-sm leading-[22px] text-[#262730] capitalize shadow-[0px_-0.5px_1px_0px_rgba(0,0,0,0.15),0px_1px_1px_0px_rgba(0,0,0,0.3)] transition-colors hover:bg-neutral-50"
            >
              Explore Demo
            </NuxtLink>
          </div>

          <!-- Phone mockup + Product cards composite (Figma layout) -->
          <div
            v-motion="heroFadeUp(550)"
            class="hero-composite relative mt-10 w-full h-[420px] sm:h-[500px] lg:h-[595px]"
          >
            <!-- Left card group (behind phone, z-0) -->
            <div class="hero-cards-left hidden md:flex items-start gap-[25px] absolute z-0">
              <div
                v-for="product in featuredProducts.slice(0, 2)"
                :key="product.name"
                :class="[
                  'hero-product-card flex flex-col w-[290px] shrink-0 bg-[#f9fafb] border-[0.74px] border-[#e5e7eb] rounded-[9px] p-[15px] shadow-[0_0_50px_0_rgba(0,0,0,0.1)]',
                  product === featuredProducts[0] ? 'hidden lg:flex' : '',
                ]"
              >
                <div class="flex flex-col gap-3 w-full">
                  <div class="flex flex-col gap-[9px]">
                    <div class="leading-[1.4]">
                      <p class="font-urbanist font-semibold text-[17.8px] text-[#1f2937]">{{ product.name }}</p>
                      <p class="font-urbanist font-medium text-[11.87px] text-[#6b7280]">{{ product.type }}</p>
                    </div>
                    <div class="h-[111px] w-full bg-neutral-100 rounded-md flex items-center justify-center overflow-hidden">
                      <Icon :name="product.heroIcon" class="size-16 text-neutral-300" />
                    </div>
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-1">
                        <Icon :name="product.icon1" class="size-[18px] text-[#6b7280]" />
                        <span class="font-urbanist font-medium text-[11.87px] leading-[1.4] text-[#6b7280]">{{ product.spec1 }}</span>
                      </div>
                      <div class="flex items-center gap-1">
                        <Icon :name="product.icon2" class="size-[18px] text-[#6b7280]" />
                        <span class="font-urbanist font-medium text-[11.87px] leading-[1.4] text-[#6b7280]">{{ product.spec2 }}</span>
                      </div>
                      <div class="flex items-center gap-1">
                        <Icon :name="product.icon3" class="size-[18px] text-[#6b7280]" />
                        <span class="font-urbanist font-medium text-[11.87px] leading-[1.4] text-[#6b7280]">{{ product.spec3 }}</span>
                      </div>
                    </div>
                  </div>
                  <hr class="border-[#e5e7eb]">
                  <div class="flex items-center justify-between">
                    <div class="flex items-end leading-[1.4]">
                      <span class="font-urbanist font-semibold text-[23.74px] text-[#1f2937]">{{ product.price }}/</span>
                      <span class="font-urbanist font-medium text-[11.87px] text-[#6b7280]">Day</span>
                    </div>
                    <NuxtLink
                      to="/products"
                      class="bg-[#1f2937] hover:bg-[#111827] rounded-full px-[15px] py-[9px] font-urbanist font-medium text-[14.84px] leading-[1.4] text-white transition-colors"
                    >
                      Rent Now
                    </NuxtLink>
                  </div>
                </div>
              </div>
            </div>

            <!-- Right card group (behind phone, z-0) -->
            <div class="hero-cards-right hidden md:flex items-start gap-[25px] absolute z-0">
              <div
                v-for="product in featuredProducts.slice(2, 4)"
                :key="product.name"
                :class="[
                  'hero-product-card flex flex-col w-[290px] shrink-0 bg-[#f9fafb] border-[0.74px] border-[#e5e7eb] rounded-[9px] p-[15px] shadow-[0_0_50px_0_rgba(0,0,0,0.1)]',
                  product === featuredProducts[3] ? 'hidden lg:flex' : '',
                ]"
              >
                <div class="flex flex-col gap-3 w-full">
                  <div class="flex flex-col gap-[9px]">
                    <div class="leading-[1.4]">
                      <p class="font-urbanist font-semibold text-[17.8px] text-[#1f2937]">{{ product.name }}</p>
                      <p class="font-urbanist font-medium text-[11.87px] text-[#6b7280]">{{ product.type }}</p>
                    </div>
                    <div class="h-[111px] w-full bg-neutral-100 rounded-md flex items-center justify-center overflow-hidden">
                      <Icon :name="product.heroIcon" class="size-16 text-neutral-300" />
                    </div>
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-1">
                        <Icon :name="product.icon1" class="size-[18px] text-[#6b7280]" />
                        <span class="font-urbanist font-medium text-[11.87px] leading-[1.4] text-[#6b7280]">{{ product.spec1 }}</span>
                      </div>
                      <div class="flex items-center gap-1">
                        <Icon :name="product.icon2" class="size-[18px] text-[#6b7280]" />
                        <span class="font-urbanist font-medium text-[11.87px] leading-[1.4] text-[#6b7280]">{{ product.spec2 }}</span>
                      </div>
                      <div class="flex items-center gap-1">
                        <Icon :name="product.icon3" class="size-[18px] text-[#6b7280]" />
                        <span class="font-urbanist font-medium text-[11.87px] leading-[1.4] text-[#6b7280]">{{ product.spec3 }}</span>
                      </div>
                    </div>
                  </div>
                  <hr class="border-[#e5e7eb]">
                  <div class="flex items-center justify-between">
                    <div class="flex items-end leading-[1.4]">
                      <span class="font-urbanist font-semibold text-[23.74px] text-[#1f2937]">{{ product.price }}/</span>
                      <span class="font-urbanist font-medium text-[11.87px] text-[#6b7280]">Day</span>
                    </div>
                    <NuxtLink
                      to="/products"
                      class="bg-[#1f2937] hover:bg-[#111827] rounded-full px-[15px] py-[9px] font-urbanist font-medium text-[14.84px] leading-[1.4] text-white transition-colors"
                    >
                      Rent Now
                    </NuxtLink>
                  </div>
                </div>
              </div>
            </div>

            <!-- Phone mockup (center, in front of cards, z-10) -->
            <div class="absolute top-0 left-1/2 -translate-x-1/2 z-10">
              <img
                src="/assets/CenterImage.png"
                alt="EzTech app interface showing product listings"
                width="350"
                height="595"
                class="w-[250px] sm:w-[300px] lg:w-[350px] h-auto drop-shadow-2xl"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Spacer -->
      <div class="h-[40px] lg:h-[60px]" />
    </section>

    <!-- ═══════════════════════════════════════════
         FEATURE SECTION — Two Column
         ═══════════════════════════════════════════ -->
    <section id="how-it-works" class="bg-white py-20 lg:py-28">
      <div class="mx-auto max-w-7xl px-6 lg:px-8">
        <div class="flex flex-col lg:flex-row items-start gap-12">
          <!-- Left — Text + CTA -->
          <div class="flex flex-col gap-10 lg:w-5/12 shrink-0">
            <h2 v-motion="fadeUp()" class="text-h1 font-medium leading-heading capitalize text-text-primary">
              Browse Smarter, Rent Faster
            </h2>
            <p v-motion="fadeUp(100)" class="text-body-lg text-neutral-500/70 leading-body">
              From weekend projects to business trips, EzTech helps you rent premium equipment instantly — with real-time availability, seamless checkout, and smart suggestions.
            </p>
            <NuxtLink
              v-motion="fadeUp(200)"
              class="btn-gradient-dark rounded-full px-6 py-3 text-body-sm font-medium text-white capitalize border border-white/10 w-fit transition-opacity hover:opacity-90"
              to="/products"
            >
              Get Started Now
            </NuxtLink>
          </div>

          <!-- Right — Cards grid -->
          <div class="flex items-center gap-4 lg:w-7/12">
            <!-- Column 1: phone mockup + info card -->
            <div class="flex flex-col gap-6 w-1/2">
              <div v-motion="fadeUp(100)" class="relative bg-neutral-50 rounded-tl-feature w-full aspect-[324/292] overflow-hidden">
                <img
                  src="/assets/phone-mockup.png"
                  alt="EzTech app mockup"
                  class="absolute left-1/4 -top-[15%] w-3/4 h-[120%] object-cover object-top"
                />
              </div>
              <div v-motion="fadeUp(200)" class="bg-neutral-100 rounded-br-feature p-5 flex flex-col gap-3">
                <div class="bg-neutral-200 rounded-full p-2 w-fit">
                  <Icon name="ph:users" class="size-6 text-neutral-800" />
                </div>
                <div class="flex flex-col gap-2">
                  <p class="text-h4 font-medium text-neutral-800 leading-heading">Active Renters</p>
                  <p class="text-body text-neutral-500 leading-body">Join thousands of users enjoying EzTech daily</p>
                </div>
              </div>
            </div>

            <!-- Column 2: stat cards -->
            <div class="flex flex-col gap-4 w-1/2">
              <div v-motion="fadeUp(200)" class="bg-surface-lilac rounded-tr-feature p-5 flex flex-col gap-3">
                <p class="text-h2 font-medium text-neutral-800 leading-heading">250+</p>
                <div class="flex flex-col gap-2">
                  <p class="text-h4 font-medium text-neutral-800 leading-heading">Products Available</p>
                  <p class="text-body text-neutral-500 leading-body">Laptops, cameras, drones, and more — ready to rent instantly.</p>
                </div>
              </div>
              <div v-motion="fadeUp(300)" class="bg-surface-lavender rounded-br-feature p-5 flex flex-col gap-3">
                <p class="text-h2 font-medium text-neutral-800 leading-heading">40+</p>
                <div class="flex flex-col gap-2">
                  <p class="text-h4 font-medium text-neutral-800 leading-heading">Cities Covered</p>
                  <p class="text-body text-neutral-500 leading-body">Same-day delivery across major cities nationwide.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══════════════════════════════════════════
         SERVICE FEATURES — 2x2 Grid
         ═══════════════════════════════════════════ -->
    <section class="bg-neutral-50 py-20 lg:py-28">
      <div class="mx-auto max-w-7xl px-6 lg:px-8">
        <!-- Section header -->
        <div class="text-center mb-14">
          <h2 v-motion="fadeUp()" class="text-h1 font-medium leading-heading capitalize text-text-primary">
            Why EzTech?
          </h2>
          <p v-motion="fadeUp(100)" class="mt-4 text-body-lg text-neutral-500/70 leading-body max-w-2xl mx-auto">
            Everything you need for a seamless tech rental experience — from instant delivery to premium protection.
          </p>
        </div>

        <!-- Feature cards grid -->
        <div class="grid gap-6 sm:grid-cols-2">
          <div
            v-for="(feature, idx) in features"
            :key="feature.title"
            v-motion="fadeUp(idx * 100)"
            class="group rounded-2xl border border-border bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-md hover:border-primary-200"
          >
            <div :class="['mb-4 flex size-12 items-center justify-center rounded-xl transition-colors duration-300', feature.bg, feature.hoverBg, feature.iconColor]">
              <Icon :name="feature.icon" class="size-6" />
            </div>
            <h3 class="text-h4 font-semibold text-text-primary">{{ feature.title }}</h3>
            <p class="mt-2 text-body-sm text-text-secondary leading-body">{{ feature.desc }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══════════════════════════════════════════
         FEATURED PRODUCTS
         ═══════════════════════════════════════════ -->
    <section id="pricing" class="bg-white py-20 lg:py-28">
      <div class="mx-auto max-w-7xl px-6 lg:px-8">
        <!-- Section header -->
        <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-12">
          <div>
            <h2 v-motion="fadeUp()" class="text-h1 font-medium leading-heading capitalize text-text-primary">
              Featured Equipment
            </h2>
            <p v-motion="fadeUp(100)" class="mt-3 text-body-lg text-neutral-500/70 leading-body max-w-lg">
              Premium tech from top brands, available for daily or weekly rentals.
            </p>
          </div>
          <NuxtLink
            v-motion="fadeUp(200)"
            class="btn-glass bg-white rounded-full px-5 py-2.5 text-body-sm font-medium text-text-primary capitalize hover:bg-neutral-50 transition-colors shrink-0"
            to="/products"
          >
            View All Products
          </NuxtLink>
        </div>

        <!-- Product cards -->
        <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div
            v-for="(product, idx) in featuredProducts"
            :key="product.name"
            v-motion="fadeUp(idx * 80)"
            class="bg-neutral-50 border border-neutral-200 rounded-xl p-4 shadow-[0_0_50px_0_rgba(0,0,0,0.1)] transition-all duration-300 hover:border-primary-300 hover:shadow-[0_0_50px_0_rgba(139,92,246,0.12)]"
          >
            <div class="leading-[1.4]">
              <p class="text-[18px] font-semibold text-neutral-800">{{ product.name }}</p>
              <p class="text-caption font-medium text-neutral-500">{{ product.type }}</p>
            </div>
            <div class="h-28 w-full my-3 bg-neutral-100 rounded-md flex items-center justify-center">
              <Icon :name="product.heroIcon" class="size-12 text-neutral-300" />
            </div>
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-1">
                <Icon :name="product.icon1" class="size-4.5 text-neutral-500" />
                <span class="text-caption font-medium text-neutral-500">{{ product.spec1 }}</span>
              </div>
              <div class="flex items-center gap-1">
                <Icon :name="product.icon2" class="size-4.5 text-neutral-500" />
                <span class="text-caption font-medium text-neutral-500">{{ product.spec2 }}</span>
              </div>
              <div class="flex items-center gap-1">
                <Icon :name="product.icon3" class="size-4.5 text-neutral-500" />
                <span class="text-caption font-medium text-neutral-500">{{ product.spec3 }}</span>
              </div>
            </div>
            <hr class="border-neutral-200">
            <div class="flex items-center justify-between mt-3">
              <div class="flex items-end leading-[1.4]">
                <span class="text-h3 font-semibold text-neutral-800">{{ product.price }}/</span>
                <span class="text-caption font-medium text-neutral-500">Day</span>
              </div>
              <NuxtLink to="/products" class="bg-neutral-800 hover:bg-neutral-900 rounded-full px-4 py-2 text-body-sm font-medium text-white transition-colors">
                Rent Now
              </NuxtLink>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══════════════════════════════════════════
         STATS SECTION
         ═══════════════════════════════════════════ -->
    <section class="bg-neutral-50 py-20 lg:py-24">
      <div class="mx-auto max-w-7xl px-6 lg:px-8">
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div v-motion="fadeUp(0)" class="rounded-tl-feature bg-surface-purple p-5">
            <p class="text-h2 font-medium leading-heading text-neutral-800">250+</p>
            <div class="mt-3 flex flex-col gap-2">
              <p class="text-h4 font-medium text-neutral-800">Products</p>
              <p class="text-body text-neutral-500 leading-body">Laptops, cameras, drones, and more.</p>
            </div>
          </div>
          <div v-motion="fadeUp(100)" class="rounded-tr-feature bg-surface-lilac p-5">
            <p class="text-h2 font-medium leading-heading text-neutral-800">40+</p>
            <div class="mt-3 flex flex-col gap-2">
              <p class="text-h4 font-medium text-neutral-800">Cities</p>
              <p class="text-body text-neutral-500 leading-body">Same-day delivery across major cities.</p>
            </div>
          </div>
          <div v-motion="fadeUp(200)" class="rounded-bl-feature bg-surface-lavender p-5">
            <p class="text-h2 font-medium leading-heading text-neutral-800">10K+</p>
            <div class="mt-3 flex flex-col gap-2">
              <p class="text-h4 font-medium text-neutral-800">Users</p>
              <p class="text-body text-neutral-500 leading-body">Active renters on the platform.</p>
            </div>
          </div>
          <div v-motion="fadeUp(300)" class="rounded-br-feature bg-surface-violet p-5">
            <p class="text-h2 font-medium leading-heading text-neutral-800">4.9</p>
            <div class="mt-3 flex flex-col gap-2">
              <p class="text-h4 font-medium text-neutral-800">Rating</p>
              <p class="text-body text-neutral-500 leading-body">Average user satisfaction score.</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══════════════════════════════════════════
         TESTIMONIAL
         ═══════════════════════════════════════════ -->
    <section class="bg-white py-20 lg:py-28">
      <div class="mx-auto max-w-7xl px-6 lg:px-8">
        <div class="relative flex flex-col items-center gap-12">
          <!-- Section heading -->
          <h2 v-motion="fadeUp()" class="text-h1 font-medium leading-heading capitalize text-text-primary text-center max-w-lg">
            Trusted by Thousands of Users Worldwide
          </h2>

          <!-- Testimonial area with map background -->
          <div v-motion="fadeUp(150)" class="relative w-full">
            <!-- World map background -->
            <img
              src="/assets/testimonial-map-bg.png"
              alt=""
              aria-hidden="true"
              class="absolute inset-0 w-full h-full object-contain opacity-60 pointer-events-none"
            />

            <!-- Scattered avatars (decorative) -->
            <img src="/assets/avatar-1.png" alt="" class="absolute size-8 rounded-full ring-2 ring-white shadow-md left-[12%] top-[8%] object-cover avatar-float" style="--float-delay: 0s" />
            <img src="/assets/avatar-2.png" alt="" class="absolute size-12 rounded-full ring-2 ring-white shadow-md right-[14%] top-[5%] object-cover avatar-float" style="--float-delay: 0.5s" />
            <img src="/assets/avatar-5.png" alt="" class="absolute size-10 rounded-full ring-2 ring-white shadow-md left-[6%] top-[42%] object-cover avatar-float" style="--float-delay: 1s" />
            <img src="/assets/avatar-3.png" alt="" class="absolute size-8 rounded-full ring-2 ring-white shadow-md right-[10%] top-[45%] object-cover avatar-float" style="--float-delay: 1.5s" />
            <img src="/assets/avatar-6.png" alt="" class="absolute size-14 rounded-full ring-2 ring-white shadow-md left-[13%] bottom-[8%] object-cover avatar-float" style="--float-delay: 2s" />
            <img src="/assets/avatar-4.png" alt="" class="absolute size-11 rounded-full ring-2 ring-white shadow-md right-[12%] bottom-[12%] object-cover avatar-float" style="--float-delay: 0.8s" />

            <!-- Center content -->
            <div class="relative flex flex-col items-center gap-8 px-8 py-8 max-w-2xl mx-auto">
              <!-- Main avatar -->
              <img
                src="/assets/avatar-main.png"
                alt="Cameron Williamson"
                class="size-28 rounded-full ring-4 ring-white shadow-lg object-cover"
              />

              <!-- Quote -->
              <div class="flex items-start gap-4">
                <span class="text-h1 leading-none text-primary-300 font-serif shrink-0">&ldquo;</span>
                <blockquote class="text-h3 font-normal leading-body text-neutral-800 text-center">
                  Finding premium tech gear used to be a headache. Now with EzTech, I can rent exactly what I need — in minutes. It's fast, clean, and always reliable.
                </blockquote>
                <span class="text-h1 leading-none text-primary-300 font-serif shrink-0">&rdquo;</span>
              </div>

              <!-- Author -->
              <div class="text-center">
                <p class="text-h3 font-medium text-neutral-800 leading-heading">Cameron Williamson</p>
                <p class="text-body text-neutral-500 leading-body">Business Professional, UAE</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══════════════════════════════════════════
         CTA BANNER
         ═══════════════════════════════════════════ -->
    <section class="px-6 lg:px-8 pb-20 lg:pb-28">
      <div
        v-motion="fadeScale()"
        class="mx-auto max-w-7xl bg-section-dark rounded-3xl py-16 flex flex-col items-center gap-6 text-center px-8 relative overflow-hidden"
      >
        <!-- Decorative blurs -->
        <div class="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full bg-primary-500/15 blur-3xl" />
        <div class="pointer-events-none absolute -bottom-16 -left-16 size-64 rounded-full bg-primary-400/10 blur-2xl" />

        <div class="relative flex flex-col gap-3 items-center">
          <h2 class="text-h1 sm:text-[3.5rem] font-medium leading-heading text-white max-w-md">
            Let's get your tech — delivered in style.
          </h2>
          <p class="text-body-lg font-light text-neutral-300 leading-body">
            Join thousands of users who trust EzTech for premium, hassle-free rentals.
          </p>
        </div>
        <NuxtLink
          to="/register"
          class="relative bg-white rounded-full px-5 py-2.5 flex items-center gap-2.5 text-body font-medium text-neutral-800 hover:bg-neutral-50 transition-colors"
        >
          Get Started Now
          <Icon name="ph:arrow-right" class="size-5" />
        </NuxtLink>
      </div>
    </section>

    <!-- ═══════════════════════════════════════════
         FOOTER
         ═══════════════════════════════════════════ -->
    <footer class="px-6 lg:px-8 pb-8">
      <div class="mx-auto max-w-7xl rounded-3xl border border-neutral-200 bg-white p-8 lg:p-10">
        <div class="flex flex-col lg:flex-row items-start justify-between gap-8">
          <!-- Left: brand -->
          <div class="max-w-md flex flex-col gap-5">
            <NuxtLink to="/" class="flex items-center gap-2">
              <div class="size-9 rounded-full bg-primary-500 flex items-center justify-center">
                <Icon name="ph:package" class="size-4 text-white" />
              </div>
              <span class="text-h3 font-semibold text-neutral-900">EzTech</span>
            </NuxtLink>
            <p class="text-body text-neutral-600 leading-body capitalize">
              EzTech is a premium tech rental platform, making laptops, cameras, and equipment accessible with just a few taps.
            </p>
            <div class="flex items-center gap-3">
              <a href="#" class="size-10 rounded-full border border-neutral-900/25 flex items-center justify-center hover:border-neutral-900/50 hover:bg-neutral-50 transition-all">
                <Icon name="ph:facebook-logo" class="size-5 text-neutral-800" />
              </a>
              <a href="#" class="size-10 rounded-full border border-neutral-900/25 flex items-center justify-center hover:border-neutral-900/50 hover:bg-neutral-50 transition-all">
                <Icon name="ph:linkedin-logo" class="size-5 text-neutral-800" />
              </a>
              <a href="#" class="size-10 rounded-full border border-neutral-900/25 flex items-center justify-center hover:border-neutral-900/50 hover:bg-neutral-50 transition-all">
                <Icon name="ph:x-logo" class="size-5 text-neutral-800" />
              </a>
            </div>
          </div>

          <!-- Right: links + newsletter -->
          <div class="flex flex-col sm:flex-row gap-12">
            <div class="flex flex-col gap-5">
              <p class="text-h4 font-medium text-neutral-800">Company</p>
              <nav class="flex flex-col gap-4 text-body text-neutral-500 leading-body">
                <a href="#" class="hover:text-neutral-800 transition-colors">About Us</a>
                <a href="#" class="hover:text-neutral-800 transition-colors">Careers</a>
                <a href="#" class="hover:text-neutral-800 transition-colors">Terms of Service</a>
                <a href="#" class="hover:text-neutral-800 transition-colors">Privacy Policy</a>
                <a href="#" class="hover:text-neutral-800 transition-colors">Contact Us</a>
              </nav>
            </div>
            <div class="flex flex-col gap-5 sm:w-80">
              <p class="text-h4 font-medium text-neutral-800">Newsletter</p>
              <p class="text-body-sm text-neutral-500 leading-body">Stay updated with the latest products and offers.</p>
              <div class="bg-neutral-50 rounded-full flex items-center pl-4 pr-1.5 py-1.5">
                <input
                  type="email"
                  placeholder="Enter Your Email"
                  class="bg-transparent text-body-sm text-neutral-500 outline-none flex-1 placeholder:text-neutral-400"
                />
                <button class="bg-neutral-800 hover:bg-neutral-900 rounded-full p-3 transition-colors">
                  <Icon name="ph:arrow-right" class="size-5 text-white" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Bottom bar -->
        <div class="mt-8 pt-6 border-t border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p class="text-body-sm text-neutral-400">&copy; {{ new Date().getFullYear() }} EzTech. All rights reserved.</p>
          <div class="flex items-center gap-6 text-body-sm text-neutral-400">
            <a href="#" class="hover:text-neutral-600 transition-colors">Privacy</a>
            <a href="#" class="hover:text-neutral-600 transition-colors">Terms</a>
            <a href="#" class="hover:text-neutral-600 transition-colors">Cookies</a>
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
/* --- Figma Hero Section Styles --- */

/* Poppins & Urbanist fonts (loaded via @nuxt/fonts) */
.font-poppins {
  font-family: 'Poppins', sans-serif;
}

.font-urbanist {
  font-family: 'Urbanist', sans-serif;
}

/* Primary gradient CTA button matching Figma exactly */
.hero-btn-primary {
  background-image: linear-gradient(109.72deg, rgba(56, 57, 66, 0.7) 0%, rgb(38, 39, 48) 19.08%);
  box-shadow: inset 0px 3px 0px 0px rgba(255, 255, 255, 0.25);
}

/* --- Hero card groups: absolute positioning matching Figma layout --- */

/* Both card groups: positioned 42% from top (cards start at 252/595 of phone height) */
.hero-cards-left,
.hero-cards-right {
  top: 42%;
}

/* Left group: right edge stops at calc(50% + 200px) from container center */
.hero-cards-left {
  right: calc(50% + 200px);
 /**-webkit-mask-image: linear-gradient(to right, transparent 0%, black 35%);
  mask-image: linear-gradient(to right, transparent 0%, black 35%);**/
}

/* Right group: left edge starts at calc(50% + 200px) from container center */
.hero-cards-right {
  left: calc(50% + 200px);
  /**
  -webkit-mask-image: linear-gradient(to left, transparent 0%, black 35%);
  mask-image: linear-gradient(to left, transparent 0%, black 35%);**/
}

/* md breakpoint: tighter offset for smaller phone (300px → half = 150px + 20px gap) */
@media (min-width: 768px) and (max-width: 1023px) {
  .hero-cards-left {
    right: calc(50% + 170px);
  }
  .hero-cards-right {
    left: calc(50% + 170px);
  }
}

/* --- Burger bar transition timing --- */
.duration-400 {
  transition-duration: 400ms;
}

/* --- Fullscreen menu overlay animations --- */
.menu-enter-active {
  transition: clip-path 500ms cubic-bezier(0.76, 0, 0.24, 1);
}
.menu-leave-active {
  transition: clip-path 400ms cubic-bezier(0.76, 0, 0.24, 1);
}
.menu-enter-from,
.menu-leave-to {
  clip-path: inset(0 0 100% 0);
}
.menu-enter-to,
.menu-leave-from {
  clip-path: inset(0 0 0 0);
}

/* Menu links are animated via v-motion, no CSS opacity/transform needed */

/* --- Avatar floating (decorative) --- */
@keyframes avatarFloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}

.avatar-float {
  animation: avatarFloat 3s ease-in-out infinite;
  animation-delay: var(--float-delay, 0s);
}
</style>
