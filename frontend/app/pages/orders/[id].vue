<script setup lang="ts">
const route = useRoute()
const orderId = route.params.id

definePageMeta({
  layout: 'default'
})
</script>

<template>
  <div class="min-h-screen flex items-center justify-center">
    <div class="text-center">
      <h1 class="text-3xl font-bold text-text-primary">Order Tracking</h1>
      <p class="mt-2 text-text-muted">Order #{{ orderId }}</p>
    </div>
  </div>
</template>
