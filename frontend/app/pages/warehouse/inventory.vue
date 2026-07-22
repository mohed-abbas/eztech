<script setup lang="ts">
import { LOW_STOCK_THRESHOLD, type StockLine } from '~/stores/warehouse'

definePageMeta({ layout: 'warehouse', middleware: ['auth', 'role'], role: 'warehouse_manager' })
useHead({ title: 'Inventaire - EzTech' })

const wh = useWarehouseStore()

const search = ref('')
const categoryFilter = ref('')
const edits = reactive<Record<string, number>>({})
const savingId = ref<string | null>(null)

function syncEdits() {
  for (const s of wh.stock) edits[s.productId] = s.quantity
}

onMounted(async () => {
  await wh.fetchWarehouses()
  if (wh.selectedId) await wh.fetchInventory(wh.selectedId)
  syncEdits()
})

async function selectWarehouse(id: string) {
  wh.select(id)
  await wh.fetchInventory(id)
  syncEdits()
}

const categories = computed(() => {
  const set = new Set<string>()
  for (const s of wh.stock) if (s.product.category?.name) set.add(s.product.category.name)
  return [...set].sort()
})

const filtered = computed<StockLine[]>(() => {
  const q = search.value.trim().toLowerCase()
  return wh.stock.filter((s) => {
    if (categoryFilter.value && s.product.category?.name !== categoryFilter.value) return false
    if (q && !s.product.name.toLowerCase().includes(q)) return false
    return true
  })
})

function isDirty(s: StockLine) {
  return edits[s.productId] !== undefined && edits[s.productId] !== s.quantity
}

async function save(s: StockLine) {
  const next = edits[s.productId]
  if (next === undefined || next < 0 || next === s.quantity) return
  savingId.value = s.productId
  try {
    await wh.adjustStock(s.warehouseId, s.productId, next)
  }
  catch {
    edits[s.productId] = s.quantity // rollback affichage
  }
  finally {
    savingId.value = null
  }
}
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-8 space-y-6">
    <div class="flex items-center justify-between gap-4 flex-wrap">
      <div>
        <h1 class="text-2xl font-bold text-text-primary">Inventaire</h1>
        <p class="text-sm text-text-muted">{{ wh.selected?.name ?? 'Aucun entrepot' }}</p>
      </div>
    </div>

    <p v-if="wh.error" class="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{{ wh.error }}</p>

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

    <!-- Recherche + filtre categorie -->
    <div class="flex flex-wrap gap-3">
      <Input v-model="search" placeholder="Rechercher un produit..." class="max-w-xs" />
      <select v-model="categoryFilter" class="rounded-md border border-border bg-white px-3 py-2 text-sm text-text-primary">
        <option value="">Toutes les categories</option>
        <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
      </select>
    </div>

    <Card>
      <CardContent class="p-0">
        <table v-if="filtered.length" class="w-full text-sm">
          <thead class="border-b border-border text-left text-text-muted">
            <tr>
              <th class="px-4 py-2">Produit</th>
              <th class="px-4 py-2">Categorie</th>
              <th class="px-4 py-2">Quantite</th>
              <th class="px-4 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in filtered" :key="s.id" class="border-b border-border/50 last:border-0">
              <td class="px-4 py-2 font-medium text-text-primary">
                {{ s.product.name }}
                <span v-if="s.quantity <= LOW_STOCK_THRESHOLD" class="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">stock bas</span>
              </td>
              <td class="px-4 py-2 text-text-muted">{{ s.product.category?.name ?? '—' }}</td>
              <td class="px-4 py-2">
                <input
                  v-model.number="edits[s.productId]"
                  type="number"
                  min="0"
                  class="w-24 rounded-md border border-border bg-white px-2 py-1 text-sm"
                >
              </td>
              <td class="px-4 py-2 text-right">
                <Button size="sm" :disabled="!isDirty(s) || savingId === s.productId" @click="save(s)">
                  <Icon name="ph:check" class="mr-1 size-4" /> Enregistrer
                </Button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else class="px-4 py-10 text-center text-text-muted">Aucun produit en stock pour ces criteres.</p>
      </CardContent>
    </Card>
  </div>
</template>
