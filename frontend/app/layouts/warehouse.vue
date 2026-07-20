<script setup lang="ts">
const links = [
  { to: '/warehouse/dashboard', label: 'Tableau de bord', icon: 'ph:gauge' },
  { to: '/warehouse/inventory', label: 'Inventaire', icon: 'ph:package' },
]
</script>

<template>
  <div class="min-h-screen bg-bg-muted">
    <TheAppBar />
    <main class="pt-16">
      <div class="mx-auto max-w-5xl px-4 pt-6">
        <nav class="flex gap-2 border-b border-border pb-3">
          <NuxtLink
            v-for="l in links"
            :key="l.to"
            :to="l.to"
            class="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-text-muted transition-colors hover:bg-neutral-100 hover:text-text-primary"
            active-class="bg-primary-50 text-primary-700"
          >
            <Icon :name="l.icon" class="size-4" />
            {{ l.label }}
          </NuxtLink>
        </nav>
      </div>
      <slot />
    </main>
  </div>
</template>
