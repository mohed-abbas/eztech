<script setup lang="ts">
// Landing page. All the heavy lifting lives in the dedicated components
// under app/components/landing/ — this file just stitches them together
// in the right order and keeps the menu open/closed state at the top
// level so the navbar and the rest of the page don't fight over z-index.
definePageMeta({ layout: false })

const auth = useAuthStore()
auth.hydrate()
if (auth.isAuthenticated) {
  navigateTo('/products', { replace: true })
}

useHead({
  title: 'EzTech — Rent Premium. Deliver Smart.',
  meta: [
    {
      name: 'description',
      content: 'Premium tech rental delivered in minutes. Browse, rent, and receive laptops, cameras, drones, and more — all from your phone.',
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
