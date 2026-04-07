<script setup>
const route = useRoute();
const productId = route.params.id;
const productData = ref(null);
useHead({
  title: `Product ${productId} - EZTech`,
});

onMounted(async () => {
  try {
    const { data, status } = await useFetch(
      `/api/products/${productId}`,
    );
    productData.value = data.value;

  } catch (err) {
    console.error("Error fetching product data:", err);
  }
});
</script>

<template>
  <div class="min-h-screen flex items-center justify-center">
    <div class="text-center">
      <h1 class="text-3xl font-bold text-text-primary">Product Details</h1>
      <p class="mt-2 text-text-muted">Product #{{ productId }}</p>
      <div v-if="productData" class="mt-4">
        <h2 class="text-2xl font-semibold">{{ productData.name }}</h2>
        <p class="text-lg">${{ productData.price.toFixed(2) }}</p>
        <p class="text-text-muted">{{ productData.description }}</p>
      </div>
    </div>
    <div v-if="!productData" class="mt-4">
      <p class="text-text-muted">Product not found.</p>
    </div>
  </div>
</template>
