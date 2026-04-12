<script setup lang="ts">
// Single-testimonial block with the world-map backdrop and scattered
// floating avatars. Decorative only — avatar positions are absolute so
// they line up with the map SVG behind them.
const { fadeUp } = useMotionPresets()

const avatars = [
  { src: '/assets/avatar-1.png', pos: 'left-[12%] top-[8%]', size: 'size-8', delay: '0s' },
  { src: '/assets/avatar-2.png', pos: 'right-[14%] top-[5%]', size: 'size-12', delay: '0.5s' },
  { src: '/assets/avatar-5.png', pos: 'left-[6%] top-[42%]', size: 'size-10', delay: '1s' },
  { src: '/assets/avatar-3.png', pos: 'right-[10%] top-[45%]', size: 'size-8', delay: '1.5s' },
  { src: '/assets/avatar-6.png', pos: 'left-[13%] bottom-[8%]', size: 'size-14', delay: '2s' },
  { src: '/assets/avatar-4.png', pos: 'right-[12%] bottom-[12%]', size: 'size-11', delay: '0.8s' },
]
</script>

<template>
  <section class="bg-white py-20 lg:py-28">
    <div class="mx-auto max-w-7xl px-6 lg:px-8">
      <div class="relative flex flex-col items-center gap-12">
        <h2 v-motion="fadeUp()" class="text-h1 font-medium leading-heading capitalize text-text-primary text-center max-w-lg">
          Trusted by Thousands of Users Worldwide
        </h2>

        <div v-motion="fadeUp(150)" class="relative w-full">
          <img
            src="/assets/testimonial-map-bg.png"
            alt=""
            aria-hidden="true"
            class="absolute inset-0 w-full h-full object-contain opacity-60 pointer-events-none"
          >

          <img
            v-for="avatar in avatars"
            :key="avatar.src"
            :src="avatar.src"
            alt=""
            :class="['absolute rounded-full ring-2 ring-white shadow-md object-cover avatar-float', avatar.size, avatar.pos]"
            :style="{ '--float-delay': avatar.delay }"
          >

          <div class="relative flex flex-col items-center gap-8 px-8 py-8 max-w-2xl mx-auto">
            <img
              src="/assets/avatar-main.png"
              alt="Cameron Williamson"
              class="size-28 rounded-full ring-4 ring-white shadow-lg object-cover"
            >

            <div class="flex items-start gap-4">
              <span class="text-h1 leading-none text-primary-300 font-serif shrink-0">&ldquo;</span>
              <blockquote class="text-h3 font-normal leading-body text-neutral-800 text-center">
                Finding premium tech gear used to be a headache. Now with EzTech, I can rent exactly what I need — in minutes. It's fast, clean, and always reliable.
              </blockquote>
              <span class="text-h1 leading-none text-primary-300 font-serif shrink-0">&rdquo;</span>
            </div>

            <div class="text-center">
              <p class="text-h3 font-medium text-neutral-800 leading-heading">Cameron Williamson</p>
              <p class="text-body text-neutral-500 leading-body">Business Professional, UAE</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
@keyframes avatarFloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}

.avatar-float {
  animation: avatarFloat 3s ease-in-out infinite;
  animation-delay: var(--float-delay, 0s);
}
</style>
