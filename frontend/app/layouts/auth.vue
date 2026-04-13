<template>
  <div class="min-h-screen flex">
    <!-- Left Panel — Branding (hidden on mobile) -->
    <div class="hidden lg:flex lg:w-5/12 relative overflow-hidden bg-section-dark flex-col justify-between p-10">
      <!-- Decorative blurs -->
      <div class="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-primary-500/20 blur-3xl" />
      <div class="pointer-events-none absolute -bottom-20 -left-20 size-80 rounded-full bg-primary-400/15 blur-2xl" />
      <div class="pointer-events-none absolute top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2 size-[500px] rounded-full bg-primary-600/10 blur-3xl" />

      <!-- Logo -->
      <div class="relative z-10">
        <NuxtLink to="/" class="flex items-center gap-3">
          <div class="flex size-10 items-center justify-center rounded-full bg-primary-500 text-white font-bold text-body-sm">
            Ez
          </div>
          <span class="text-h3 font-semibold text-white">EzTech</span>
        </NuxtLink>
      </div>

      <!-- Tagline -->
      <div class="relative z-10 max-w-sm">
        <h2 class="text-h1 font-semibold leading-heading text-white">
          Location premium.<br>Livraison intelligente.
        </h2>
        <p class="mt-4 text-body-lg text-neutral-400 leading-body">
          La location tech simplifiée. Parcourez, louez et recevez du matériel haut de gamme — depuis votre téléphone.
        </p>

        <!-- Stats row -->
        <div class="mt-8 flex items-center gap-8">
          <div>
            <p class="text-h2 font-medium text-white">250+</p>
            <p class="text-body-sm text-neutral-500">Produits</p>
          </div>
          <div class="h-10 w-px bg-neutral-700" />
          <div>
            <p class="text-h2 font-medium text-white">40+</p>
            <p class="text-body-sm text-neutral-500">Villes</p>
          </div>
          <div class="h-10 w-px bg-neutral-700" />
          <div>
            <p class="text-h2 font-medium text-white">10K+</p>
            <p class="text-body-sm text-neutral-500">Utilisateurs</p>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <p class="relative z-10 text-caption text-neutral-600">
        &copy; {{ new Date().getFullYear() }} EzTech. Tous droits réservés.
      </p>
    </div>

    <!-- Right Panel — Form Content -->
    <div class="flex-1 flex flex-col">
      <!-- Mobile header -->
      <div class="flex items-center justify-between p-6 lg:hidden">
        <NuxtLink to="/" class="flex items-center gap-2">
          <div class="flex size-9 items-center justify-center rounded-full bg-primary-500 text-white font-bold text-body-sm">
            Ez
          </div>
          <span class="text-h4 font-semibold text-text-primary">EzTech</span>
        </NuxtLink>
      </div>

      <!-- Centered form area -->
      <div class="flex-1 flex items-center justify-center px-6 py-8 sm:px-8">
        <div class="w-full max-w-md">
          <slot />
        </div>
      </div>
    </div>
  </div>
</template>
