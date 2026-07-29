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

// Distingue « l'entrepôt est vide » de « les filtres ne renvoient rien » : les deux cas
// affichaient auparavant le même message « pour ces critères ».
const hasFilters = computed(() => search.value.trim() !== '' || categoryFilter.value !== '')
const isWarehouseEmpty = computed(() => wh.stock.length === 0)

function resetFilters() {
  search.value = ''
  categoryFilter.value = ''
}

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
    <div class="space-y-1">
      <h1 class="text-h2 font-bold text-text-primary">Inventaire</h1>
      <p class="text-body-sm text-text-muted">{{ wh.selected?.name ?? 'Aucun entrepôt' }}</p>
    </div>

    <ErrorState v-if="wh.error" variant="inline" :title="wh.error">
      <template #actions>
        <Button v-if="wh.selectedId" variant="ghost" size="sm" @click="wh.fetchInventory(wh.selectedId)">Réessayer</Button>
      </template>
    </ErrorState>

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

    <!-- Recherche + filtre catégorie -->
    <div class="flex flex-wrap gap-3">
      <Input v-model="search" placeholder="Rechercher un produit..." class="max-w-xs" />
      <!-- meme gabarit que Input (px-4 py-3, rounded-md) pour que les deux champs s'alignent -->
      <select
        v-model="categoryFilter"
        aria-label="Filtrer par catégorie"
        class="rounded-md border border-neutral-200 bg-white px-4 py-3 text-body-sm text-text-primary transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
      >
        <option value="">Toutes les catégories</option>
        <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
      </select>
    </div>

    <Card v-if="filtered.length">
      <CardContent class="overflow-x-auto p-0">
        <table class="w-full text-body-sm">
          <thead class="border-b border-border text-left text-caption font-semibold uppercase tracking-wide text-text-muted">
            <tr>
              <th class="px-5 py-3">Produit</th>
              <th class="px-5 py-3">Catégorie</th>
              <th class="px-5 py-3">Quantité</th>
              <th class="px-5 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in filtered" :key="s.id" class="border-b border-border/50 align-middle last:border-0">
              <td class="px-5 py-3 font-medium text-text-primary">
                {{ s.product.name }}
                <span v-if="s.quantity <= LOW_STOCK_THRESHOLD" class="ml-2 whitespace-nowrap rounded-full bg-error/10 px-2 py-0.5 text-caption font-semibold text-error">stock bas</span>
              </td>
              <td class="px-5 py-3 text-text-muted">{{ s.product.category?.name ?? '—' }}</td>
              <td class="px-5 py-3">
                <input
                  v-model.number="edits[s.productId]"
                  type="number"
                  min="0"
                  :aria-label="`Quantité en stock pour ${s.product.name}`"
                  class="w-24 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-body-sm text-text-primary tabular-nums transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
              </td>
              <td class="px-5 py-3 text-right">
                <Button size="sm" :disabled="!isDirty(s) || savingId === s.productId" @click="save(s)">
                  <Icon name="ph:check" class="mr-1 size-4" /> Enregistrer
                </Button>
              </td>
            </tr>
          </tbody>
        </table>
      </CardContent>
    </Card>

    <!-- Entrepôt réellement vide -->
    <EmptyState
      v-else-if="isWarehouseEmpty"
      title="Aucun produit en stock"
      description="Cet entrepôt ne référence encore aucun produit."
    >
      <template #icon>
        <Icon name="ph:package" class="size-10 text-primary-500" />
      </template>
    </EmptyState>

    <!-- Filtres trop restrictifs -->
    <EmptyState
      v-else
      title="Aucun produit pour ces critères"
      :description="hasFilters
        ? 'Aucun produit ne correspond à votre recherche ou à la catégorie sélectionnée.'
        : 'Aucun produit à afficher.'"
    >
      <template #icon>
        <Icon name="ph:magnifying-glass" class="size-10 text-primary-500" />
      </template>
      <template #actions>
        <Button v-if="hasFilters" variant="outline" @click="resetFilters">Réinitialiser les filtres</Button>
      </template>
    </EmptyState>
  </div>
</template>
