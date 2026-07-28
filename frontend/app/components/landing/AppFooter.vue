<script setup lang="ts">
// Landing footer. Every link here points at a route that exists — there are no
// placeholder anchors. The newsletter block was removed rather than faked: there
// is no subscription endpoint in the API, so an input that "accepted" an address
// and stored nothing would be a lie to the visitor. Add the block back the day
// POST /api/newsletter exists.
const catalogLinks = [
  { label: 'Catalogue', to: '/products' },
  { label: 'Comment ça marche', to: '/#how-it-works' },
  { label: 'Équipements à la une', to: '/#pricing' },
]

const accountLinks = [
  { label: 'Se connecter', to: '/login' },
  { label: 'Créer un compte', to: '/register' },
  { label: 'Mes commandes', to: '/orders' },
  { label: 'Mon profil', to: '/profile' },
]

const year = new Date().getFullYear()
</script>

<template>
  <footer class="px-6 lg:px-8 pb-8">
    <div class="mx-auto max-w-7xl rounded-3xl border border-neutral-200 bg-white p-8 lg:p-10">
      <div class="flex flex-col lg:flex-row items-start justify-between gap-8">
        <div class="max-w-md flex flex-col gap-5">
          <NuxtLink to="/" class="flex items-center gap-2">
            <div class="size-9 rounded-full bg-primary-500 flex items-center justify-center">
              <Icon name="ph:package" class="size-4 text-white" />
            </div>
            <span class="text-h3 font-semibold text-neutral-900">EzTech</span>
          </NuxtLink>
          <p class="text-body text-neutral-600 leading-body capitalize">
            EzTech est une plateforme de location tech haut de gamme, rendant ordinateurs, appareils photo et équipements accessibles en quelques clics.
          </p>
          <div class="flex items-center gap-2 text-body-sm text-neutral-500">
            <Icon name="ph:lightning" class="size-5 text-primary-500" />
            Livraison express en 30 minutes sur nos zones desservies.
          </div>
        </div>

        <div class="flex flex-col sm:flex-row gap-12">
          <div class="flex flex-col gap-5">
            <p class="text-h4 font-medium text-neutral-800">Explorer</p>
            <nav class="flex flex-col gap-4 text-body text-neutral-500 leading-body">
              <NuxtLink
                v-for="link in catalogLinks"
                :key="link.label"
                :to="link.to"
                class="hover:text-neutral-800 transition-colors"
              >
                {{ link.label }}
              </NuxtLink>
            </nav>
          </div>
          <div class="flex flex-col gap-5">
            <p class="text-h4 font-medium text-neutral-800">Mon compte</p>
            <nav class="flex flex-col gap-4 text-body text-neutral-500 leading-body">
              <NuxtLink
                v-for="link in accountLinks"
                :key="link.label"
                :to="link.to"
                class="hover:text-neutral-800 transition-colors"
              >
                {{ link.label }}
              </NuxtLink>
            </nav>
          </div>
        </div>
      </div>

      <div class="mt-8 pt-6 border-t border-neutral-200">
        <p class="text-body-sm text-neutral-400">&copy; {{ year }} EzTech. Tous droits réservés.</p>
      </div>
    </div>
  </footer>
</template>
