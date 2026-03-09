<script setup lang="ts">
const route = useRoute()
const productId = route.params.id

definePageMeta({
  layout: 'default'
})
</script>

<template>
  <div class="min-h-screen flex items-center justify-center">
    <div class="text-center">
      <h1 class="text-3xl font-bold text-text-primary">Product Details</h1>
      <p class="mt-2 text-text-muted">Product #{{ productId }}</p>
    </div>
  </div>
</template>
