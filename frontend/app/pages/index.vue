<script setup lang="ts">
definePageMeta({
  layout: 'default'
})

const { user, isAuthenticated, logout } = useAuth()
</script>

<template>
  <div class="min-h-screen flex items-center justify-center">
    <div class="text-center">
      <h1 class="text-5xl font-bold text-text-primary mb-4">EzTech</h1>
      <p class="text-xl text-text-muted mb-8">Tech you need. Delivered in minutes.</p>
      <div class="flex items-center justify-center gap-4">
        <NuxtLink
          to="/products"
          class="inline-flex items-center gap-2 rounded-full bg-primary-500 px-6 py-3 text-white font-medium hover:bg-primary-600 transition-colors"
        >
          Browse Products
        </NuxtLink>
        <NuxtLink
          v-if="!isAuthenticated"
          to="/login"
          class="inline-flex items-center gap-2 rounded-full border border-primary-500 px-6 py-3 text-primary-500 font-medium hover:bg-primary-50 transition-colors"
        >
          Sign In
        </NuxtLink>
        <button
          v-else
          class="inline-flex items-center gap-2 rounded-full border border-error px-6 py-3 text-error font-medium hover:bg-error/5 transition-colors"
          @click="logout()"
        >
          Log out ({{ user?.name }})
        </button>
      </div>
    </div>
  </div>
</template>
