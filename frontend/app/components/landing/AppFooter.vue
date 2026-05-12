<script setup lang="ts">
// Landing footer: brand block on the left, company/newsletter on the
// right. Newsletter input is currently static (no backend handler yet).
const companyLinks = [
  { label: 'À propos', href: '#' },
  { label: 'Carrières', href: '#' },
  { label: 'Conditions d\'utilisation', href: '#' },
  { label: 'Politique de confidentialité', href: '#' },
  { label: 'Nous contacter', href: '#' },
]

const socials = [
  { icon: 'ph:facebook-logo', href: '#', label: 'Facebook' },
  { icon: 'ph:linkedin-logo', href: '#', label: 'LinkedIn' },
  { icon: 'ph:x-logo', href: '#', label: 'X (Twitter)' },
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
          <div class="flex items-center gap-3">
            <a
              v-for="social in socials"
              :key="social.label"
              :href="social.href"
              :aria-label="social.label"
              class="size-10 rounded-full border border-neutral-900/25 flex items-center justify-center hover:border-neutral-900/50 hover:bg-neutral-50 transition-all"
            >
              <Icon :name="social.icon" class="size-5 text-neutral-800" />
            </a>
          </div>
        </div>

        <div class="flex flex-col sm:flex-row gap-12">
          <div class="flex flex-col gap-5">
            <p class="text-h4 font-medium text-neutral-800">Entreprise</p>
            <nav class="flex flex-col gap-4 text-body text-neutral-500 leading-body">
              <a
                v-for="link in companyLinks"
                :key="link.label"
                :href="link.href"
                class="hover:text-neutral-800 transition-colors"
              >
                {{ link.label }}
              </a>
            </nav>
          </div>
          <div class="flex flex-col gap-5 sm:w-80">
            <p class="text-h4 font-medium text-neutral-800">Newsletter</p>
            <p class="text-body-sm text-neutral-500 leading-body">Restez informé des derniers produits et offres.</p>
            <div class="bg-neutral-50 rounded-full flex items-center pl-4 pr-1.5 py-1.5">
              <input
                type="email"
                placeholder="Votre adresse e-mail"
                class="bg-transparent text-body-sm text-neutral-500 outline-none flex-1 placeholder:text-neutral-400"
              >
              <button class="bg-neutral-800 hover:bg-neutral-900 rounded-full p-3 transition-colors">
                <Icon name="ph:arrow-right" class="size-5 text-white" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="mt-8 pt-6 border-t border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p class="text-body-sm text-neutral-400">&copy; {{ year }} EzTech. Tous droits réservés.</p>
        <div class="flex items-center gap-6 text-body-sm text-neutral-400">
          <a href="#" class="hover:text-neutral-600 transition-colors">Confidentialité</a>
          <a href="#" class="hover:text-neutral-600 transition-colors">Conditions</a>
          <a href="#" class="hover:text-neutral-600 transition-colors">Cookies</a>
        </div>
      </div>
    </div>
  </footer>
</template>
