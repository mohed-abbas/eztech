<script setup lang="ts">
// Landing page. All the heavy lifting lives in the dedicated components
// under app/components/landing/ — this file just stitches them together
// in the right order and keeps the menu open/closed state at the top
// level so the navbar and the rest of the page don't fight over z-index.
definePageMeta({ layout: false, middleware: 'guest' })

useHead({
  title: 'EzTech — Location premium. Livraison intelligente.',
  meta: [
    {
      name: 'description',
      content: 'Location de matériel tech haut de gamme livré en quelques minutes. Parcourez, louez et recevez ordinateurs, appareils photo, drones et plus — depuis votre téléphone.',
    },
  ],
})

const menuOpen = ref(false)
</script>

<template>
  <div class="min-h-screen bg-background font-sans text-foreground overflow-x-hidden">
    <LandingAppNavbar v-model:open="menuOpen" />
    <LandingHeroSection />
    <LandingHowItWorksSection />
    <LandingFeaturesGrid />
    <LandingFeaturedProductsSection />
    <LandingStatsSection />
    <LandingTestimonialSection />
    <LandingCtaBanner />
    <LandingAppFooter />
  </div>
</template>
