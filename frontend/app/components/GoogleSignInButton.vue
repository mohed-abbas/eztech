<script setup lang="ts">
// Renders Google's official sign-in button and exchanges the returned ID token for an EzTech
// session via the auth store. Drops into login.vue and register.vue in place of the old
// placeholder button. Renders nothing when no client id is configured, so the page degrades
// cleanly rather than showing a dead button.
const props = defineProps<{ redirect?: string }>()

const auth = useAuthStore()
const { enabled, renderButton } = useGoogleIdentity()

const container = ref<HTMLElement | null>(null)
const error = ref('')

async function onCredential(credential: string) {
  error.value = ''
  try {
    await auth.loginWithGoogle(credential)
    await navigateTo(props.redirect || '/products')
  }
  catch (err: unknown) {
    error.value = err instanceof Error ? err.message : 'La connexion Google a échoué. Veuillez réessayer.'
  }
}

onMounted(async () => {
  if (!enabled.value || !container.value) return
  try {
    await renderButton(container.value, onCredential)
  }
  catch {
    error.value = 'Impossible de charger la connexion Google.'
  }
})
</script>

<template>
  <div v-if="enabled" class="w-full">
    <div ref="container" class="flex w-full justify-center" />
    <p v-if="error" class="mt-2 text-body-sm text-red-600">{{ error }}</p>
  </div>
</template>
