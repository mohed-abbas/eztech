<script setup lang="ts">
import { RETURN_STATUS_LABEL } from '~/stores/rider'

definePageMeta({ layout: 'default', middleware: 'auth' })
useHead({ title: 'Retours - EzTech' })

const auth = useAuthStore()
const rider = useRiderStore()

onMounted(async () => {
  auth.hydrate()
  if (auth.role !== 'rider') return navigateTo('/products')
  await Promise.all([rider.fetchProfile(), rider.fetchReturns()])
})

const busyId = ref<string | null>(null)
async function accept(id: string) {
  busyId.value = id
  try { await rider.acceptReturn(id) }
  catch (e) { rider.error = e instanceof Error ? e.message : 'Impossible d\'accepter ce retour' }
  finally { busyId.value = null }
}
async function complete(id: string) {
  busyId.value = id
  try { await rider.completeReturn(id) }
  catch (e) { rider.error = e instanceof Error ? e.message : 'Impossible de finaliser ce retour' }
  finally { busyId.value = null }
}

// "navigation vers le client" — open the pickup address in the device's maps app
function mapsUrl(r: { pickupAddress: string, pickupLat: number | null, pickupLng: number | null }) {
  if (r.pickupLat != null && r.pickupLng != null) return `https://www.google.com/maps/dir/?api=1&destination=${r.pickupLat},${r.pickupLng}`
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.pickupAddress)}`
}

function eur(n: number) { return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }) }
function fmtDate(iso: string | null) { return iso ? new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—' }
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-8 space-y-6">
    <h1 class="text-2xl font-bold text-text-primary">Retours à récupérer</h1>
    <p v-if="rider.error" class="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{{ rider.error }}</p>

    <Card v-if="rider.profile && !rider.isApproved">
      <CardContent class="py-8 text-center text-text-muted">
        <Icon name="ph:hourglass" class="mx-auto mb-3 size-10" />
        <p>Votre compte livreur doit être validé avant de pouvoir prendre des retours.</p>
      </CardContent>
    </Card>

    <template v-else>
      <!-- Returns assigned to me -->
      <section v-if="rider.returnsMine.length" class="space-y-3">
        <h2 class="text-lg font-semibold text-text-primary">Mes retours</h2>
        <Card v-for="r in rider.returnsMine" :key="r.id">
          <CardHeader>
            <CardTitle class="flex items-center justify-between text-base">
              <span>{{ r.reference }}</span>
              <span class="text-brand">{{ eur(r.riderFee) }}</span>
            </CardTitle>
            <CardDescription>{{ RETURN_STATUS_LABEL[r.status] }}<span v-if="r.scheduledFor"> · prévu le {{ fmtDate(r.scheduledFor) }}</span></CardDescription>
          </CardHeader>
          <CardContent class="text-sm">
            <div class="flex gap-2"><Icon name="ph:map-pin" class="size-4 mt-0.5 text-text-muted" /><span>{{ r.pickupAddress }}</span></div>
          </CardContent>
          <CardFooter class="gap-2">
            <Button v-if="r.status === 'accepted'" variant="outline" as-child>
              <a :href="mapsUrl(r)" target="_blank" rel="noopener"><Icon name="ph:navigation-arrow" class="mr-2 size-4" /> Itinéraire vers le client</a>
            </Button>
            <Button v-if="r.status === 'accepted'" :disabled="busyId === r.id" @click="complete(r.id)">
              <Icon name="ph:check-circle" class="mr-2 size-4" /> Retour récupéré
            </Button>
            <span v-else-if="r.status === 'completed'" class="text-sm text-emerald-600">Complété le {{ fmtDate(r.completedAt) }}</span>
          </CardFooter>
        </Card>
      </section>

      <!-- Available returns -->
      <section class="space-y-3">
        <h2 class="text-lg font-semibold text-text-primary">Disponibles ({{ rider.returnsAvailable.length }})</h2>
        <Card v-if="!rider.isOnline">
          <CardContent class="py-8 text-center text-text-muted">
            <Icon name="ph:moon" class="mx-auto mb-3 size-10" />
            <p>Passez en ligne depuis le <NuxtLink to="/rider/dashboard" class="text-brand underline">tableau de bord</NuxtLink> pour voir les retours disponibles.</p>
          </CardContent>
        </Card>
        <Card v-else-if="rider.returnsAvailable.length === 0">
          <CardContent class="py-8 text-center text-text-muted">
            <Icon name="ph:arrow-u-down-left" class="mx-auto mb-3 size-10" />
            <p>Aucun retour à récupérer pour le moment.</p>
          </CardContent>
        </Card>
        <Card v-for="r in rider.returnsAvailable" :key="r.id">
          <CardHeader>
            <CardTitle class="flex items-center justify-between text-base">
              <span>{{ r.reference }}</span>
              <span class="text-brand">{{ eur(r.riderFee) }}</span>
            </CardTitle>
            <CardDescription v-if="r.scheduledFor">Prévu le {{ fmtDate(r.scheduledFor) }}</CardDescription>
          </CardHeader>
          <CardContent class="text-sm">
            <div class="flex gap-2"><Icon name="ph:map-pin" class="size-4 mt-0.5 text-text-muted" /><span>{{ r.pickupAddress }}</span></div>
          </CardContent>
          <CardFooter>
            <Button :disabled="busyId === r.id" @click="accept(r.id)">Accepter le retour</Button>
          </CardFooter>
        </Card>
      </section>
    </template>
  </div>
</template>
