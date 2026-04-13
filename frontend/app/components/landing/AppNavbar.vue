<script setup lang="ts">
// Landing navbar with the fullscreen burger menu. Uses v-model so the
// parent can still know when the menu is open (for z-index coordination
// with teleported overlays, etc.).
const menuOpen = defineModel<boolean>('open', { default: false })

const auth = useAuthStore()
const { isAuthenticated } = storeToRefs(auth)
const { logout } = auth

const { scrolled } = useScrollState(20)
useBodyScrollLock(menuOpen)

const { navLinks } = useLandingContent()

const menuLinks = computed(() => [
  ...navLinks,
  ...(isAuthenticated.value
    ? [{ label: 'Profil', href: '/profile' }]
    : [{ label: 'Connexion', href: '/login' }, { label: 'Inscription', href: '/register' }]),
])

const menuLinkMotion = (idx: number) => ({
  initial: { opacity: 0, y: 30 },
  enter: { opacity: 1, y: 0, transition: { duration: 500, delay: 200 + idx * 60, ease: 'easeOut' } },
})

function closeMenu() {
  menuOpen.value = false
}

function handleLogout() {
  logout()
  closeMenu()
}
</script>

<template>
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
      <NuxtLink to="/" class="relative flex items-center gap-2.5 group" @click="closeMenu">
        <div class="size-9 rounded-full bg-primary-500 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
          <Icon name="ph:package" class="size-4 text-white" />
        </div>
        <span :class="['text-h3 font-semibold transition-colors duration-300', menuOpen ? 'text-white' : 'text-neutral-900']">
          EzTech
        </span>
      </NuxtLink>

      <button
        :class="['relative flex flex-col items-center justify-center size-12 gap-[7px] rounded-full transition-colors', menuOpen ? '' : 'hover:bg-neutral-100']"
        aria-label="Toggle menu"
        @click="menuOpen = !menuOpen"
      >
        <span :class="['block w-7 h-[2.5px] rounded-full origin-center transition-all duration-400 ease-[cubic-bezier(0.76,0,0.24,1)]', menuOpen ? 'bg-white rotate-45 translate-y-[4.75px]' : 'bg-neutral-800']" />
        <span :class="['block w-7 h-[2.5px] rounded-full origin-center transition-all duration-400 ease-[cubic-bezier(0.76,0,0.24,1)]', menuOpen ? 'bg-white -rotate-45 -translate-y-[4.75px]' : 'bg-neutral-800']" />
      </button>
    </div>
  </header>

  <Teleport to="body">
    <Transition
      enter-active-class="menu-enter-active"
      enter-from-class="menu-enter-from"
      enter-to-class="menu-enter-to"
      leave-active-class="menu-leave-active"
      leave-from-class="menu-leave-from"
      leave-to-class="menu-leave-to"
    >
      <div v-if="menuOpen" class="fixed inset-0 z-[60] bg-primary-600 flex flex-col">
        <div class="h-[84px] shrink-0" />

        <nav class="flex-1 flex flex-col justify-center px-8 sm:px-12 lg:px-20 overflow-y-auto">
          <div class="max-w-5xl w-full">
            <NuxtLink
              v-for="(link, idx) in menuLinks"
              :key="link.label"
              v-motion="menuLinkMotion(idx)"
              :to="link.href"
              class="group flex items-center gap-4 py-4 sm:py-5 border-b border-white/15"
              @click="closeMenu"
            >
              <span class="font-poppins font-medium text-3xl sm:text-4xl lg:text-5xl text-primary-200 group-hover:text-white transition-all duration-300 group-hover:translate-x-2">
                {{ link.label }}
              </span>
              <Icon
                name="ph:arrow-right"
                class="size-6 sm:size-8 text-primary-300 opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300"
              />
            </NuxtLink>

            <button
              v-if="isAuthenticated"
              v-motion="menuLinkMotion(menuLinks.length)"
              class="group flex items-center gap-4 py-4 sm:py-5 border-b border-white/15 w-full text-left"
              @click="handleLogout"
            >
              <span class="font-poppins font-medium text-3xl sm:text-4xl lg:text-5xl text-red-200 group-hover:text-red-100 transition-all duration-300 group-hover:translate-x-2">
                Déconnexion
              </span>
            </button>
          </div>
        </nav>

        <div class="px-8 sm:px-12 lg:px-20 py-8 text-primary-200/60 text-sm font-poppins">
          &copy; {{ new Date().getFullYear() }} EzTech. Tous droits réservés.
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.font-poppins { font-family: 'Poppins', sans-serif; }

.duration-400 { transition-duration: 400ms; }

.menu-enter-active { transition: clip-path 500ms cubic-bezier(0.76, 0, 0.24, 1); }
.menu-leave-active { transition: clip-path 400ms cubic-bezier(0.76, 0, 0.24, 1); }
.menu-enter-from,
.menu-leave-to { clip-path: inset(0 0 100% 0); }
.menu-enter-to,
.menu-leave-from { clip-path: inset(0 0 0 0); }
</style>
