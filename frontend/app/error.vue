<script setup lang="ts">
import type { NuxtError } from '#app'

// error.vue rend HORS de l'arbre de layouts habituel : on ré-enveloppe explicitement
// dans le layout `default` pour conserver la barre d'application et la navigation.
const props = defineProps<{ error: NuxtError }>()

const statusCode = computed(() => Number(props.error?.statusCode ?? 500))
const isNotFound = computed(() => statusCode.value === 404)

const title = computed(() =>
  isNotFound.value ? 'Page introuvable' : 'Une erreur est survenue',
)

const description = computed(() =>
  isNotFound.value
    ? "Cette page n'existe pas ou a été déplacée. Vérifiez l'adresse ou repartez du catalogue."
    : "Un problème est survenu de notre côté. Réessayez dans un instant — si cela persiste, contactez le support.",
)

useHead({ title: computed(() => `${title.value} - EzTech`) })

// clearError vide l'état d'erreur ET navigue : c'est la seule façon propre de sortir
// d'une page d'erreur dans Nuxt (un simple navigateTo laisserait l'erreur affichée).
function goHome() {
  clearError({ redirect: '/' })
}

function goProducts() {
  clearError({ redirect: '/products' })
}
</script>

<template>
  <NuxtLayout name="default">
    <div class="min-h-[70vh] bg-background flex items-center justify-center px-6 py-16">
      <div class="w-full max-w-lg text-center">
        <!-- Illustration -->
        <div class="relative mx-auto mb-8 flex size-32 items-center justify-center">
          <div class="absolute inset-0 rounded-full bg-primary-100/60 blur-2xl" />
          <div class="relative flex size-32 items-center justify-center rounded-full bg-surface-purple border border-primary-100">
            <Icon
              :name="isNotFound ? 'ph:compass' : 'ph:warning-octagon'"
              class="size-14 text-primary-600"
            />
          </div>
          <div class="absolute -bottom-1 -right-1 flex size-11 items-center justify-center rounded-full bg-white border border-neutral-200 shadow-sm">
            <span class="text-body-sm font-semibold text-text-muted">{{ statusCode }}</span>
          </div>
        </div>

        <h1 class="text-h2 font-semibold text-text-primary">
          {{ title }}
        </h1>
        <p class="mx-auto mt-3 max-w-md text-body text-text-muted">
          {{ description }}
        </p>

        <!-- Détail technique (utile en dev / au support), jamais de stack trace -->
        <Card v-if="error?.message" class="mt-8 p-5">
          <div class="flex items-start gap-3 text-left">
            <div class="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-purple">
              <Icon name="ph:info" class="size-4 text-primary-600" />
            </div>
            <div class="min-w-0">
              <p class="text-caption font-medium text-text-muted">Détail</p>
              <p class="mt-0.5 break-words text-body-sm text-text-secondary">
                {{ error.message }}
              </p>
            </div>
          </div>
        </Card>

        <!-- Actions -->
        <div class="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button variant="gradient" size="pill" class="font-semibold" @click="goHome">
            <Icon name="ph:house" class="size-4" />
            Retour à l'accueil
          </Button>
          <Button variant="outline" size="pill" class="font-medium" @click="goProducts">
            <Icon name="ph:squares-four" class="size-4" />
            Voir le catalogue
          </Button>
        </div>
      </div>
    </div>
  </NuxtLayout>
</template>
