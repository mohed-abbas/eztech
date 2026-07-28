<script setup lang="ts">
import { LOW_STOCK_THRESHOLD, type OrderToPrepare } from '~/stores/warehouse'

definePageMeta({ layout: 'warehouse', middleware: ['auth', 'role'], role: 'warehouse_manager' })
useHead({ title: 'Tableau de bord entrepôt - EzTech' })

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

// Copie du code de remise. Aucun utilitaire de copie n'existe encore ailleurs dans l'app, la
// logique reste donc locale a cet ecran. navigator.clipboard est absent hors contexte securise
// (comptoir sur une IP locale en http) : on le signale au lieu d'echouer en silence, le code
// reste lisible a l'ecran.
const copiedId = ref<string | null>(null)
const copyFailedId = ref<string | null>(null)
const copyAnnounce = ref('')
let copyTimer: ReturnType<typeof setTimeout> | null = null

async function copyCode(o: OrderToPrepare) {
  if (!o.pickupCode) return
  if (copyTimer) clearTimeout(copyTimer)
  copiedId.value = null
  copyFailedId.value = null
  try {
    await navigator.clipboard.writeText(o.pickupCode)
    copiedId.value = o.id
    copyAnnounce.value = `Code de remise ${o.pickupCode} copié`
  }
  catch {
    copyFailedId.value = o.id
    copyAnnounce.value = 'Copie impossible, notez le code affiché.'
  }
  copyTimer = setTimeout(() => {
    copiedId.value = null
    copyFailedId.value = null
    copyAnnounce.value = ''
  }, 2500)
}

onBeforeUnmount(() => { if (copyTimer) clearTimeout(copyTimer) })

function codeLabel(id: string) {
  if (copiedId.value === id) return 'Copié'
  if (copyFailedId.value === id) return 'Copie impossible'
  return 'Code de remise'
}

function codeIcon(id: string) {
  if (copiedId.value === id) return 'ph:check-circle'
  if (copyFailedId.value === id) return 'ph:warning-circle'
  return 'ph:hand-arrow-down'
}
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-8 space-y-6">
    <div class="space-y-1">
      <h1 class="text-h2 font-bold text-text-primary">Tableau de bord entrepôt</h1>
      <p class="text-body-sm text-text-muted">{{ wh.selected?.name ?? 'Aucun entrepôt' }}</p>
    </div>

    <ErrorState v-if="wh.error" variant="inline" :title="wh.error">
      <template #actions>
        <Button v-if="wh.selectedId" variant="ghost" size="sm" @click="loadWarehouse(wh.selectedId)">Réessayer</Button>
      </template>
    </ErrorState>

    <!-- Sélecteur d'entrepôt (admin / multi-entrepôts) -->
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
      <!-- Commandes entrantes à préparer -->
      <section class="space-y-3">
        <div class="space-y-1">
          <h2 class="text-h4 font-semibold text-text-primary">Commandes à préparer ({{ wh.ordersToPrepare.length }})</h2>
          <p class="text-body-sm text-text-muted">
            Marquez la commande prête, puis dictez le code de remise au livreur : sans ce code il ne peut pas emporter le colis.
          </p>
        </div>

        <EmptyState
          v-if="!wh.ordersToPrepare.length"
          title="Aucune commande à préparer pour le moment."
          description="Les nouvelles commandes affectées à cet entrepôt apparaîtront ici."
        >
          <template #icon>
            <Icon name="ph:package" class="size-10 text-primary-500" />
          </template>
        </EmptyState>

        <Card v-for="o in wh.ordersToPrepare" :key="o.id" data-testid="prepare-order">
          <CardContent class="flex flex-wrap items-center justify-between gap-4 p-4">
            <div class="min-w-0 grow basis-48 space-y-1">
              <p class="font-medium text-text-primary">{{ o.reference }}</p>
              <p class="truncate text-body-sm text-text-muted">
                {{ o.items.map(i => `${i.quantity}× ${i.name}`).join(', ') }}
              </p>
            </div>

            <!-- Commande prête : le code prime sur le statut, c'est lui qu'on lit au livreur. -->
            <button
              v-if="o.preparedAt"
              type="button"
              data-testid="pickup-code"
              class="group flex shrink-0 items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-left transition-colors hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400/50 focus-visible:ring-offset-2"
              :aria-label="`Copier le code de remise de la commande ${o.reference}`"
              @click="copyCode(o)"
            >
              <span class="block">
                <span
                  class="flex items-center gap-1 whitespace-nowrap text-caption font-semibold uppercase tracking-wide"
                  :class="copyFailedId === o.id ? 'text-error' : 'text-emerald-700'"
                >
                  <Icon :name="codeIcon(o.id)" class="size-3.5" />
                  {{ codeLabel(o.id) }}
                </span>
                <span class="mt-0.5 block font-mono text-h3 font-bold leading-none tracking-widest tabular-nums text-text-primary">
                  {{ o.pickupCode ?? '—' }}
                </span>
              </span>
              <Icon name="ph:copy" class="size-5 shrink-0 text-emerald-600 transition-colors group-hover:text-emerald-700" />
            </button>

            <Button v-else size="sm" :disabled="preparingId === o.id" @click="prepare(o)">
              <Icon name="ph:hand-arrow-down" class="mr-2 size-4" /> Prête pour le ramassage
            </Button>
          </CardContent>
        </Card>

        <p class="sr-only" role="status" aria-live="polite">{{ copyAnnounce }}</p>
      </section>

      <!-- Synthese -->
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent class="p-4">
            <div class="flex items-center gap-2 text-body-sm text-text-muted"><Icon name="ph:package" class="size-4 shrink-0" />Produits référencés</div>
            <p class="mt-1 text-h2 font-bold leading-tight text-text-primary">{{ wh.stock.length }}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent class="p-4">
            <div class="flex items-center gap-2 text-body-sm text-text-muted"><Icon name="ph:stack" class="size-4 shrink-0" />Unités en stock</div>
            <p class="mt-1 text-h2 font-bold leading-tight text-text-primary">{{ wh.totalUnits }}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent class="p-4">
            <div class="flex items-center gap-2 text-body-sm text-text-muted"><Icon name="ph:warning" class="size-4 shrink-0" />Sous le seuil</div>
            <p class="mt-1 text-h2 font-bold leading-tight" :class="wh.lowStock.length ? 'text-error' : 'text-text-primary'">{{ wh.lowStock.length }}</p>
          </CardContent>
        </Card>
      </div>

      <!-- Alertes stock bas -->
      <!-- Card n'a ni padding ni gap vertical par defaut : chaque tranche pose le sien (cf. profile.vue). -->
      <Card>
        <CardHeader class="px-6 pb-3 pt-5">
          <CardTitle class="flex items-center gap-2 text-h4">
            <Icon name="ph:warning-circle" class="size-5 shrink-0 text-amber-500" />
            Alertes stock bas (seuil {{ LOW_STOCK_THRESHOLD }})
          </CardTitle>
        </CardHeader>
        <CardContent class="px-6 pb-4">
          <ul v-if="wh.lowStock.length" class="divide-y divide-border">
            <li v-for="s in wh.lowStock" :key="s.id" class="flex items-center justify-between gap-3 py-2.5 text-body-sm first:pt-0 last:pb-0">
              <span class="min-w-0 truncate font-medium text-text-primary">{{ s.product.name }}</span>
              <span class="shrink-0 rounded-full bg-error/10 px-2 py-0.5 text-caption font-semibold text-error">{{ s.quantity }} en stock</span>
            </li>
          </ul>
          <!-- imbrique dans une Card : on neutralise la coque de EmptyState (cf. profile.vue:551) -->
          <EmptyState
            v-else
            class="border-0 px-0 py-6 shadow-none"
            title="Aucune alerte"
            description="Tous les stocks sont au-dessus du seuil."
          >
            <template #icon>
              <Icon name="ph:check-circle" class="size-10 text-success" />
            </template>
          </EmptyState>
        </CardContent>
        <CardFooter class="px-6 pb-5">
          <Button variant="outline" size="sm" as-child>
            <NuxtLink to="/warehouse/inventory"><Icon name="ph:pencil-simple" class="mr-2 size-4" /> Gérer l'inventaire</NuxtLink>
          </Button>
        </CardFooter>
      </Card>
    </template>

    <EmptyState
      v-else-if="!wh.loading"
      title="Aucun entrepôt ne vous est assigné."
      description="Contactez un administrateur pour obtenir l'accès à un entrepôt."
    >
      <template #icon>
        <Icon name="ph:warehouse" class="size-10 text-primary-500" />
      </template>
    </EmptyState>
  </div>
</template>
