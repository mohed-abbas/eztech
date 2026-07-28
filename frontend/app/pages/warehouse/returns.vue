<script setup lang="ts">
import type { ReturnItem } from '~/stores/warehouse'

definePageMeta({ layout: 'warehouse', middleware: ['auth', 'role'], role: 'warehouse_manager' })
useHead({ title: 'Retours à inspecter - EzTech' })

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
    <div class="space-y-1">
      <h1 class="text-h2 font-bold text-text-primary">Retours à inspecter</h1>
      <p class="text-body-sm text-text-muted">Vérifiez les articles retournés : remise en stock ou mise au rebut.</p>
    </div>

    <ErrorState v-if="wh.error" variant="inline" :title="wh.error">
      <template #actions>
        <Button variant="ghost" size="sm" @click="wh.fetchReturns()">Réessayer</Button>
      </template>
    </ErrorState>

    <!-- File d'inspection -->
    <section class="space-y-3">
      <h2 class="text-h4 font-semibold text-text-primary">À inspecter ({{ wh.returnsToInspect.length }})</h2>

      <EmptyState
        v-if="!wh.returnsToInspect.length"
        title="Aucun retour en attente d'inspection."
        description="Les colis collectés par les livreurs apparaîtront ici."
      >
        <template #icon>
          <Icon name="ph:package" class="size-10 text-primary-500" />
        </template>
      </EmptyState>

      <!-- Card n'a ni padding ni gap vertical par defaut : chaque tranche pose le sien (cf. profile.vue). -->
      <Card v-for="r in wh.returnsToInspect" :key="r.id" data-testid="return-card">
        <CardHeader class="px-6 pb-4 pt-5">
          <CardTitle class="flex flex-wrap items-center justify-between gap-2 text-body">
            <span>{{ r.reference }}</span>
            <span class="text-body-sm font-normal text-text-muted">collecte le {{ fmt(r.completedAt) }}</span>
          </CardTitle>
          <CardDescription>{{ r.pickupAddress }}</CardDescription>
        </CardHeader>
        <CardContent class="px-6 pb-4">
          <Input v-model="notes[r.id]" placeholder="Commentaire d'inspection (optionnel)" />
        </CardContent>
        <CardFooter class="flex-wrap gap-2 px-6 pb-5">
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
      <h2 class="text-h4 font-semibold text-text-primary">Traites recemment</h2>
      <Card>
        <CardContent class="overflow-x-auto p-0">
          <table class="w-full text-body-sm">
            <thead class="border-b border-border text-left text-caption font-semibold uppercase tracking-wide text-text-muted">
              <tr><th class="px-5 py-3">Référence</th><th class="px-5 py-3">Résultat</th><th class="px-5 py-3">Inspecté le</th></tr>
            </thead>
            <tbody>
              <tr v-for="r in wh.returnsProcessed" :key="r.id" class="border-b border-border/50 align-middle last:border-0">
                <td class="px-5 py-3 font-medium text-text-primary">{{ r.reference }}</td>
                <td class="px-5 py-3">
                  <span
                    class="whitespace-nowrap rounded-full px-2 py-0.5 text-caption font-semibold"
                    :class="r.inspectionResult === 'available' ? 'bg-emerald-100 text-emerald-700' : 'bg-error/10 text-error'"
                  >
                    {{ r.inspectionResult === 'available' ? 'Remis en stock' : 'Endommage' }}
                  </span>
                </td>
                <td class="px-5 py-3 text-text-muted">{{ fmt(r.inspectedAt) }}</td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>
    </section>
  </div>
</template>
