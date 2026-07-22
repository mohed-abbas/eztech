<script setup lang="ts">
definePageMeta({ layout: 'default' })
useHead({ title: 'Service non disponible dans votre zone - EzTech' })
</script>

<template>
  <div class="min-h-screen bg-background flex items-center justify-center px-6 py-16">
    <div class="w-full max-w-lg text-center">
      <!-- Illustration -->
      <div class="relative mx-auto mb-8 flex size-32 items-center justify-center">
        <div class="absolute inset-0 rounded-full bg-primary-100/60 blur-2xl" />
        <div class="relative flex size-32 items-center justify-center rounded-full bg-surface-purple border border-primary-100">
          <Icon name="ph:map-pin-line" class="size-14 text-primary-600" />
        </div>
        <div class="absolute -bottom-1 -right-1 flex size-11 items-center justify-center rounded-full bg-white border border-neutral-200 shadow-sm">
          <Icon name="ph:clock-countdown" class="size-6 text-warning" />
        </div>
      </div>

      <h1 class="text-h2 font-semibold text-text-primary">
        Service pas encore disponible chez vous
      </h1>
      <p class="mx-auto mt-3 max-w-md text-body text-text-muted">
        Nous ne livrons pas encore dans votre zone. Nous couvrons actuellement
        Paris Centre et Paris Est, et nous étendons notre couverture rapidement.
      </p>

      <!-- Message d'attente (sans capture d'email tant que la liste d'attente n'est pas branchée) -->
      <Card class="mt-8 p-6">
        <div class="flex items-center justify-center gap-3 text-left">
          <div class="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-purple">
            <Icon name="ph:rocket-launch" class="size-5 text-primary-600" />
          </div>
          <p class="text-body-sm text-text-muted">
            De nouvelles zones ouvrent régulièrement. Repassez bientôt pour voir si
            la livraison est disponible chez vous.
          </p>
        </div>
      </Card>

      <!-- Retour accueil -->
      <div class="mt-8">
        <NuxtLink to="/">
          <Button variant="outline" size="pill" class="font-medium">
            <Icon name="ph:arrow-left" class="size-4" />
            Retour à l'accueil
          </Button>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
