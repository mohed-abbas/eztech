<script setup lang="ts">
// Hero block: headline, CTA pair, and the phone mockup flanked by four
// floating product cards. The card positioning is absolute to match the
// Figma layout — see the scoped styles below.
const { featuredProducts } = useLandingContent()
const { heroFadeUp } = useMotionPresets()

const leftCards = computed(() => featuredProducts.slice(0, 2))
const rightCards = computed(() => featuredProducts.slice(2, 4))
</script>

<template>
  <section class="hero-section relative bg-white overflow-x-clip pt-[72px]">
    <img
      src="/assets/hero-bg-pattern.svg"
      alt=""
      aria-hidden="true"
      class="absolute left-0 top-0 w-full h-[1182px] object-cover pointer-events-none select-none"
    >

    <div class="relative mx-auto max-w-[1240px] px-6">
      <div class="flex flex-col items-center pt-[36px] pb-0">
        <h1
          v-motion="heroFadeUp(100)"
          class="font-poppins font-semibold text-[clamp(2.5rem,5.5vw,76px)] leading-[1.2] capitalize text-[#1f2937] max-w-[605px] text-center"
        >
          Location premium. Livraison intelligente.
        </h1>

        <p
          v-motion="heroFadeUp(250)"
          class="mt-[22px] font-poppins font-normal text-[clamp(1rem,1.5vw,20px)] leading-[1.5] text-[rgba(68,69,78,0.7)] max-w-[749px] text-center"
        >
          La tech à portée de main. Parcourez, louez et recevez — directement depuis votre téléphone grâce à la plateforme de location intelligente EzTech.
        </p>

        <div v-motion="heroFadeUp(400)" class="mt-7 flex items-center gap-2.5">
          <NuxtLink
            to="/products"
            class="hero-btn-primary relative overflow-hidden rounded-[37px] border border-white px-6 py-3 font-poppins font-medium text-sm leading-[22px] text-white capitalize transition-opacity hover:opacity-90"
          >
            Commencer
          </NuxtLink>
          <NuxtLink
            to="/register"
            class="bg-white rounded-[71px] px-6 py-2.5 font-poppins font-medium text-sm leading-[22px] text-[#262730] capitalize shadow-[0px_-0.5px_1px_0px_rgba(0,0,0,0.15),0px_1px_1px_0px_rgba(0,0,0,0.3)] transition-colors hover:bg-neutral-50"
          >
            Découvrir
          </NuxtLink>
        </div>

        <!-- Phone mockup layered in front of the two card groups. -->
        <div
          v-motion="heroFadeUp(550)"
          class="hero-composite relative mt-10 w-full h-[420px] sm:h-[500px] lg:h-[595px]"
        >
          <div class="hero-cards-left hidden md:flex items-start gap-[25px] absolute z-0">
            <LandingHeroProductCard
              v-for="(product, idx) in leftCards"
              :key="product.name"
              :product="product"
              :class="idx === 0 ? 'hidden lg:flex' : ''"
            />
          </div>

          <div class="hero-cards-right hidden md:flex items-start gap-[25px] absolute z-0">
            <LandingHeroProductCard
              v-for="(product, idx) in rightCards"
              :key="product.name"
              :product="product"
              :class="idx === 1 ? 'hidden lg:flex' : ''"
            />
          </div>

          <div class="absolute top-0 left-1/2 -translate-x-1/2 z-10">
            <img
              src="/assets/CenterImage.png"
              alt="EzTech app interface showing product listings"
              width="350"
              height="595"
              class="w-[250px] sm:w-[300px] lg:w-[350px] h-auto drop-shadow-2xl"
            >
          </div>
        </div>
      </div>
    </div>

    <div class="h-[40px] lg:h-[60px]" />
  </section>
</template>

<style scoped>
.font-poppins { font-family: 'Poppins', sans-serif; }

.hero-btn-primary {
  background-image: linear-gradient(109.72deg, rgba(56, 57, 66, 0.7) 0%, rgb(38, 39, 48) 19.08%);
  box-shadow: inset 0px 3px 0px 0px rgba(255, 255, 255, 0.25);
}

/* Card groups sit roughly at phone-mid-height and flare outward. */
.hero-cards-left,
.hero-cards-right { top: 42%; }
.hero-cards-left { right: calc(50% + 200px); }
.hero-cards-right { left: calc(50% + 200px); }

/* Tighter offset on mid-width screens where the phone shrinks. */
@media (min-width: 768px) and (max-width: 1023px) {
  .hero-cards-left { right: calc(50% + 170px); }
  .hero-cards-right { left: calc(50% + 170px); }
}
</style>
