<script setup lang="ts">
// "Browse Smarter, Rent Faster" block: headline + CTA on the left,
// mixed card grid (mockup + two stat tiles) on the right.
const { fadeUp } = useMotionPresets()
</script>

<template>
  <section id="how-it-works" class="bg-white py-20 lg:py-28">
    <div class="mx-auto max-w-7xl px-6 lg:px-8">
      <div class="flex flex-col lg:flex-row items-start gap-12">
        <div class="flex flex-col gap-10 lg:w-5/12 shrink-0">
          <h2 v-motion="fadeUp()" class="text-h1 font-medium leading-heading capitalize text-text-primary">
            Explorez mieux, louez plus vite
          </h2>
          <p v-motion="fadeUp(100)" class="text-body-lg text-neutral-500/70 leading-body">
            Du projet du week-end au déplacement professionnel, EzTech vous permet de louer du matériel haut de gamme instantanément — avec disponibilité en temps réel, paiement fluide et suggestions intelligentes.
          </p>
          <NuxtLink
            v-motion="fadeUp(200)"
            class="btn-gradient-dark rounded-full px-6 py-3 text-body-sm font-medium text-white capitalize border border-white/10 w-fit transition-opacity hover:opacity-90"
            to="/products"
          >
            Commencer maintenant
          </NuxtLink>
        </div>

        <div class="flex items-center gap-4 lg:w-7/12">
          <div class="flex flex-col gap-6 w-1/2">
            <div v-motion="fadeUp(100)" class="relative bg-neutral-50 rounded-tl-feature w-full aspect-[324/292] overflow-hidden">
              <img
                src="/assets/phone-mockup.png"
                alt="EzTech app mockup"
                class="absolute left-1/4 -top-[15%] w-3/4 h-[120%] object-cover object-top"
              >
            </div>
            <div v-motion="fadeUp(200)" class="bg-neutral-100 rounded-br-feature p-5 flex flex-col gap-3">
              <div class="bg-neutral-200 rounded-full p-2 w-fit">
                <Icon name="ph:users" class="size-6 text-neutral-800" />
              </div>
              <div class="flex flex-col gap-2">
                <p class="text-h4 font-medium text-neutral-800 leading-heading">Locataires actifs</p>
                <p class="text-body text-neutral-500 leading-body">Rejoignez des milliers d'utilisateurs qui profitent d'EzTech au quotidien</p>
              </div>
            </div>
          </div>

          <div class="flex flex-col gap-4 w-1/2">
            <div v-motion="fadeUp(200)" class="bg-surface-lilac rounded-tr-feature p-5 flex flex-col gap-3">
              <p class="text-h2 font-medium text-neutral-800 leading-heading">250+</p>
              <div class="flex flex-col gap-2">
                <p class="text-h4 font-medium text-neutral-800 leading-heading">Produits disponibles</p>
                <p class="text-body text-neutral-500 leading-body">Ordinateurs, appareils photo, drones et plus — prêts à louer instantanément.</p>
              </div>
            </div>
            <div v-motion="fadeUp(300)" class="bg-surface-lavender rounded-br-feature p-5 flex flex-col gap-3">
              <p class="text-h2 font-medium text-neutral-800 leading-heading">40+</p>
              <div class="flex flex-col gap-2">
                <p class="text-h4 font-medium text-neutral-800 leading-heading">Villes couvertes</p>
                <p class="text-body text-neutral-500 leading-body">Livraison le jour même dans les grandes villes du pays.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
