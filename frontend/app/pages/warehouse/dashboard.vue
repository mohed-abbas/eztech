<script setup lang="ts">
import { LOW_STOCK_THRESHOLD, type OrderToPrepare } from '~/stores/warehouse'

definePageMeta({ layout: 'warehouse', middleware: ['auth', 'role'], role: 'warehouse_manager' })
useHead({ title: 'Tableau de bord entrepot - EzTech' })

const wh = useWarehouseStore()

async function loadWarehouse(id: string) {
  await Promise.all([wh.fetchInventory(id), wh.fetchOrdersToPrepare(id)])
}

onMounted(async () => {
  await wh.fetchWarehouses()
  if (wh.selectedId) await loadWarehouse(wh.selectedId)
})

async function selectWarehouse(id: string) {
  wh.select(id)
  await loadWarehouse(id)
}

const preparingId = ref<string | null>(null)
async function prepare(o: OrderToPrepare) {
  if (!wh.selectedId) return
  preparingId.value = o.id
  try { await wh.markPrepared(wh.selectedId, o.id) }
  catch (e) { wh.error = e instanceof Error ? e.message : 'Action impossible' }
  finally { preparingId.value = null }
}
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-8 space-y-6">
    <div class="flex items-center justify-between gap-4 flex-wrap">
      <div>
        <h1 class="text-2xl font-bold text-text-primary">Tableau de bord entrepot</h1>
        <p class="text-sm text-text-muted">{{ wh.selected?.name ?? 'Aucun entrepot' }}</p>
      </div>
    </div>

    <p v-if="wh.error" class="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{{ wh.error }}</p>

    <!-- Selecteur d'entrepot (admin / multi-entrepots) -->
    <div v-if="wh.myWarehouses.length > 1" class="flex flex-wrap gap-2">
      <Button
        v-for="w in wh.myWarehouses"
        :key="w.id"
        size="sm"
        :variant="w.id === wh.selectedId ? 'default' : 'outline'"
        @click="selectWarehouse(w.id)"
      >
        {{ w.name }}
      </Button>
    </div>

    <template v-if="wh.selected">
      <!-- Commandes entrantes a preparer -->
      <section class="space-y-3">
        <h2 class="text-lg font-semibold text-text-primary">Commandes a preparer ({{ wh.ordersToPrepare.length }})</h2>
        <Card v-if="!wh.ordersToPrepare.length">
          <CardContent class="py-8 text-center text-text-muted">
            <Icon name="ph:package" class="mx-auto mb-2 size-8" />
            <p>Aucune commande a preparer pour le moment.</p>
          </CardContent>
        </Card>
        <Card v-for="o in wh.ordersToPrepare" :key="o.id" data-testid="prepare-order">
          <CardContent class="flex items-center justify-between gap-4 p-4">
            <div class="min-w-0">
              <p class="font-medium text-text-primary">{{ o.reference }}</p>
              <p class="truncate text-sm text-text-muted">
                {{ o.items.map(i => `${i.quantity}× ${i.name}`).join(', ') }}
              </p>
            </div>
            <span v-if="o.preparedAt" class="shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
              <Icon name="ph:check" class="inline size-3" /> Prete
            </span>
            <Button v-else size="sm" :disabled="preparingId === o.id" @click="prepare(o)">
              <Icon name="ph:hand-arrow-down" class="mr-2 size-4" /> Prete pour le ramassage
            </Button>
          </CardContent>
        </Card>
      </section>

      <!-- Synthese -->
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent class="p-4">
            <div class="flex items-center gap-2 text-text-muted text-sm"><Icon name="ph:package" class="size-4" />Produits references</div>
            <p class="mt-1 text-2xl font-bold text-text-primary">{{ wh.stock.length }}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent class="p-4">
            <div class="flex items-center gap-2 text-text-muted text-sm"><Icon name="ph:stack" class="size-4" />Unites en stock</div>
            <p class="mt-1 text-2xl font-bold text-text-primary">{{ wh.totalUnits }}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent class="p-4">
            <div class="flex items-center gap-2 text-text-muted text-sm"><Icon name="ph:warning" class="size-4" />Sous le seuil</div>
            <p class="mt-1 text-2xl font-bold" :class="wh.lowStock.length ? 'text-red-600' : 'text-text-primary'">{{ wh.lowStock.length }}</p>
          </CardContent>
        </Card>
      </div>

      <!-- Alertes stock bas -->
      <Card>
        <CardHeader>
          <CardTitle class="flex items-center gap-2">
            <Icon name="ph:warning-circle" class="size-5 text-amber-500" />
            Alertes stock bas (seuil {{ LOW_STOCK_THRESHOLD }})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul v-if="wh.lowStock.length" class="divide-y divide-border">
            <li v-for="s in wh.lowStock" :key="s.id" class="flex items-center justify-between py-2 text-sm">
              <span class="font-medium text-text-primary">{{ s.product.name }}</span>
              <span class="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">{{ s.quantity }} en stock</span>
            </li>
          </ul>
          <p v-else class="py-4 text-center text-sm text-text-muted">Aucune alerte : tous les stocks sont au-dessus du seuil.</p>
        </CardContent>
        <CardFooter>
          <Button variant="outline" size="sm" as-child>
            <NuxtLink to="/warehouse/inventory"><Icon name="ph:pencil-simple" class="mr-2 size-4" /> Gerer l'inventaire</NuxtLink>
          </Button>
        </CardFooter>
      </Card>
    </template>

    <Card v-else-if="!wh.loading">
      <CardContent class="py-10 text-center text-text-muted">
        <Icon name="ph:warehouse" class="mx-auto mb-3 size-10" />
        <p>Aucun entrepot ne vous est assigne. Contactez un administrateur.</p>
      </CardContent>
    </Card>
  </div>
</template>
