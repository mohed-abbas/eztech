<script setup lang="ts">
import type { ReturnItem } from '~/stores/warehouse'

definePageMeta({ layout: 'warehouse', middleware: ['auth', 'role'], role: 'warehouse_manager' })
useHead({ title: 'Retours a inspecter - EzTech' })

const wh = useWarehouseStore()

const notes = reactive<Record<string, string>>({})
const busyId = ref<string | null>(null)

onMounted(() => wh.fetchReturns())

async function inspect(r: ReturnItem, result: 'available' | 'damaged') {
  busyId.value = r.id
  try {
    await wh.processReturn(r.id, result, notes[r.id]?.trim() || undefined)
  }
  catch (e) {
    wh.error = e instanceof Error ? e.message : 'Inspection impossible'
  }
  finally {
    busyId.value = null
  }
}

function fmt(iso: string | null) {
  return iso ? new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'
}
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-8 space-y-6">
    <div>
      <h1 class="text-2xl font-bold text-text-primary">Retours a inspecter</h1>
      <p class="text-sm text-text-muted">Verifiez les articles retournes : remise en stock ou mise au rebut.</p>
    </div>

    <p v-if="wh.error" class="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{{ wh.error }}</p>

    <!-- File d'inspection -->
    <section class="space-y-3">
      <h2 class="text-lg font-semibold text-text-primary">A inspecter ({{ wh.returnsToInspect.length }})</h2>

      <Card v-if="!wh.returnsToInspect.length">
        <CardContent class="py-10 text-center text-text-muted">
          <Icon name="ph:package" class="mx-auto mb-3 size-10" />
          <p>Aucun retour en attente d'inspection.</p>
        </CardContent>
      </Card>

      <Card v-for="r in wh.returnsToInspect" :key="r.id" data-testid="return-card">
        <CardHeader>
          <CardTitle class="flex items-center justify-between text-base">
            <span>{{ r.reference }}</span>
            <span class="text-sm font-normal text-text-muted">collecte le {{ fmt(r.completedAt) }}</span>
          </CardTitle>
          <CardDescription>{{ r.pickupAddress }}</CardDescription>
        </CardHeader>
        <CardContent>
          <Input v-model="notes[r.id]" placeholder="Commentaire d'inspection (optionnel)" />
        </CardContent>
        <CardFooter class="gap-2">
          <Button :disabled="busyId === r.id" @click="inspect(r, 'available')">
            <Icon name="ph:check-circle" class="mr-2 size-4" /> Disponible (remettre en stock)
          </Button>
          <Button variant="outline" :disabled="busyId === r.id" @click="inspect(r, 'damaged')">
            <Icon name="ph:x-circle" class="mr-2 size-4" /> Endommage
          </Button>
        </CardFooter>
      </Card>
    </section>

    <!-- Traites recemment -->
    <section v-if="wh.returnsProcessed.length" class="space-y-3">
      <h2 class="text-lg font-semibold text-text-primary">Traites recemment</h2>
      <Card>
        <CardContent class="p-0">
          <table class="w-full text-sm">
            <thead class="border-b border-border text-left text-text-muted">
              <tr><th class="px-4 py-2">Reference</th><th class="px-4 py-2">Resultat</th><th class="px-4 py-2">Inspecte le</th></tr>
            </thead>
            <tbody>
              <tr v-for="r in wh.returnsProcessed" :key="r.id" class="border-b border-border/50 last:border-0">
                <td class="px-4 py-2 font-medium">{{ r.reference }}</td>
                <td class="px-4 py-2">
                  <span
                    class="rounded-full px-2 py-0.5 text-xs font-semibold"
                    :class="r.inspectionResult === 'available' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'"
                  >
                    {{ r.inspectionResult === 'available' ? 'Remis en stock' : 'Endommage' }}
                  </span>
                </td>
                <td class="px-4 py-2 text-text-muted">{{ fmt(r.inspectedAt) }}</td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>
    </section>
  </div>
</template>
