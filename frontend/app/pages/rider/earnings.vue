<script setup lang="ts">
definePageMeta({ layout: 'default', middleware: 'auth' })
useHead({ title: 'Mes gains - EzTech' })

const auth = useAuthStore()
const rider = useRiderStore()

onMounted(async () => {
  auth.hydrate()
  if (auth.role !== 'rider') return navigateTo('/products')
  await rider.fetchEarnings()
})

function eur(n: number) { return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }) }
function fmt(iso: string | null) {
  return iso ? new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
}

const cards = computed(() => {
  const e = rider.earnings
  return [
    { label: "Aujourd'hui", icon: 'ph:sun', bucket: e?.today },
    { label: 'Cette semaine', icon: 'ph:calendar', bucket: e?.week },
    { label: 'Ce mois', icon: 'ph:calendar-blank', bucket: e?.month },
    { label: 'Total', icon: 'ph:trophy', bucket: e?.allTime },
  ]
})
</script>

<template>
  <div class="mx-auto max-w-4xl px-4 py-8 space-y-6">
    <h1 class="text-2xl font-bold text-text-primary">Mes gains</h1>

    <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <Card v-for="c in cards" :key="c.label">
        <CardContent class="p-4">
          <div class="flex items-center gap-2 text-text-muted text-sm"><Icon :name="c.icon" class="size-4" />{{ c.label }}</div>
          <p class="mt-1 text-2xl font-bold text-text-primary">{{ eur(c.bucket?.total ?? 0) }}</p>
          <p class="text-xs text-text-muted">{{ c.bucket?.deliveries ?? 0 }} livr. · {{ c.bucket?.returns ?? 0 }} retour(s)</p>
        </CardContent>
      </Card>
    </div>

    <Card>
      <CardHeader><CardTitle>Historique des courses</CardTitle></CardHeader>
      <CardContent class="p-0">
        <table v-if="rider.history.length" class="w-full text-sm">
          <thead class="border-b border-border text-left text-text-muted">
            <tr><th class="px-4 py-2">Type</th><th class="px-4 py-2">Référence</th><th class="px-4 py-2">Adresse</th><th class="px-4 py-2">Date</th><th class="px-4 py-2 text-right">Gain</th></tr>
          </thead>
          <tbody>
            <tr v-for="h in rider.history" :key="h.id" class="border-b border-border/50 last:border-0">
              <td class="px-4 py-2"><span class="rounded-full px-2 py-0.5 text-xs" :class="h.kind === 'return' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'">{{ h.kind === 'return' ? 'Retour' : 'Livraison' }}</span></td>
              <td class="px-4 py-2 font-medium">{{ h.reference }}</td>
              <td class="px-4 py-2 text-text-muted">{{ h.dropoffAddress ?? h.pickupAddress }}</td>
              <td class="px-4 py-2 text-text-muted">{{ fmt(h.completedAt) }}</td>
              <td class="px-4 py-2 text-right font-medium">{{ eur(h.riderFee) }}</td>
            </tr>
          </tbody>
        </table>
        <p v-else class="px-4 py-10 text-center text-text-muted">Aucune course effectuée pour l'instant.</p>
      </CardContent>
    </Card>
  </div>
</template>
