<script setup lang="ts">
definePageMeta({
  layout: 'default',
  middleware: ['auth', 'role'],
  role: 'admin',
})

useHead({ title: 'Produits — Admin EzTech' })

const config = useRuntimeConfig()
const auth = useAuthStore()

// ── Types ────────────────────────────────────────────────────────────────────
interface Category { id: string; name: string; slug: string }
interface Brand { id: string; name: string; slug: string }
interface Product {
  id: string
  name: string
  slug: string
  description: string | null
  imageUrl: string | null
  pricingType: string
  flatPrice: number | null
  hourlyPrice: number | null
  dailyPrice: number | null
  weeklyPrice: number | null
  isActive: boolean
  featured: boolean
  categoryId: string | null
  brandId: string | null
  category: Category | null
  brand: Brand | null
  createdAt: string
}

// ── State ────────────────────────────────────────────────────────────────────
const products = ref<Product[]>([])
const categories = ref<Category[]>([])
const brands = ref<Brand[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const searchQuery = ref('')
const categoryFilter = ref('all')
const saving = ref(false)
const saveError = ref<string | null>(null)
const deleting = ref<string | null>(null)

// Slide-over
const showPanel = ref(false)
const editingProduct = ref<Product | null>(null)

// Form
const emptyForm = () => ({
  name: '',
  slug: '',
  description: '',
  imageUrl: '',
  pricingType: 'flat' as string,
  flatPrice: '' as string | number,
  hourlyPrice: '' as string | number,
  dailyPrice: '' as string | number,
  weeklyPrice: '' as string | number,
  categoryId: '',
  brandId: '',
  featured: false,
  isActive: true,
})
const form = reactive(emptyForm())

// ── Helpers ───────────────────────────────────────────────────────────────────
function authHeaders() {
  return auth.token ? { Authorization: `Bearer ${auth.token}` } : {}
}
function csrfHeaders() {
  const csrf = useCookie('ez_csrf').value
  return csrf ? { 'x-csrf-token': csrf } : {}
}
function slugify(s: string) {
  return s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-')
}
function fmtPrice(p: number | null) {
  return p != null ? `${Number(p).toFixed(2)} €` : '—'
}
function displayPrice(product: Product) {
  if (product.flatPrice != null) return fmtPrice(product.flatPrice)
  if (product.hourlyPrice != null) return `${fmtPrice(product.hourlyPrice)}/h`
  if (product.dailyPrice != null) return `${fmtPrice(product.dailyPrice)}/j`
  if (product.weeklyPrice != null) return `${fmtPrice(product.weeklyPrice)}/sem`
  return '—'
}

// ── Fetch ─────────────────────────────────────────────────────────────────────
async function fetchAll() {
  auth.hydrate()
  loading.value = true
  error.value = null
  try {
    const [pData, cData, bData] = await Promise.all([
      $fetch<{ products: Product[]; total: number }>(`${config.public.apiUrl}/products?pageSize=100`, { credentials: 'include', headers: authHeaders() }),
      $fetch<{ categories: Category[] }>(`${config.public.apiUrl}/categories`, { credentials: 'include', headers: authHeaders() }),
      $fetch<{ brands: Brand[] }>(`${config.public.apiUrl}/brands`, { credentials: 'include', headers: authHeaders() }),
    ])
    products.value = pData.products
    categories.value = cData.categories
    brands.value = bData.brands
  }
  catch (e) { error.value = e instanceof Error ? e.message : 'Erreur de chargement' }
  finally { loading.value = false }
}

onMounted(fetchAll)

// ── Filters ───────────────────────────────────────────────────────────────────
const filtered = computed(() => {
  let list = products.value
  if (categoryFilter.value !== 'all') list = list.filter(p => p.categoryId === categoryFilter.value)
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(p => p.name.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q))
  }
  return list
})

// ── Panel ─────────────────────────────────────────────────────────────────────
function openCreate() {
  editingProduct.value = null
  Object.assign(form, emptyForm())
  saveError.value = null
  showPanel.value = true
}

function openEdit(p: Product) {
  editingProduct.value = p
  Object.assign(form, {
    name: p.name,
    slug: p.slug,
    description: p.description ?? '',
    imageUrl: p.imageUrl ?? '',
    pricingType: p.pricingType,
    flatPrice: p.flatPrice ?? '',
    hourlyPrice: p.hourlyPrice ?? '',
    dailyPrice: p.dailyPrice ?? '',
    weeklyPrice: p.weeklyPrice ?? '',
    categoryId: p.categoryId ?? '',
    brandId: p.brandId ?? '',
    featured: p.featured,
    isActive: p.isActive,
  })
  saveError.value = null
  showPanel.value = true
}

function closePanel() {
  showPanel.value = false
  editingProduct.value = null
  saveError.value = null
}

watch(() => form.name, (v) => {
  if (!editingProduct.value) form.slug = slugify(v)
})

// ── Save (create / update) ────────────────────────────────────────────────────
async function save() {
  saving.value = true
  saveError.value = null
  try {
    const body: Record<string, unknown> = {
      name: form.name.trim(),
      slug: form.slug.trim(),
      description: form.description.trim() || null,
      imageUrl: form.imageUrl.trim() || null,
      pricingType: form.pricingType,
      categoryId: form.categoryId || null,
      brandId: form.brandId || null,
      featured: form.featured,
      isActive: form.isActive,
    }
    // only send prices relevant to pricingType
    if (form.pricingType === 'flat') {
      body.flatPrice = form.flatPrice !== '' ? Number(form.flatPrice) : null
    }
    else {
      body.hourlyPrice = form.hourlyPrice !== '' ? Number(form.hourlyPrice) : null
      body.dailyPrice = form.dailyPrice !== '' ? Number(form.dailyPrice) : null
      body.weeklyPrice = form.weeklyPrice !== '' ? Number(form.weeklyPrice) : null
    }

    if (editingProduct.value) {
      const data = await $fetch<{ product: Product }>(
        `${config.public.apiUrl}/products/${editingProduct.value.id}`,
        { method: 'PATCH', credentials: 'include', headers: { ...authHeaders(), ...csrfHeaders() }, body },
      )
      const idx = products.value.findIndex(p => p.id === editingProduct.value!.id)
      if (idx !== -1) products.value[idx] = data.product
    }
    else {
      const data = await $fetch<{ product: Product }>(
        `${config.public.apiUrl}/products`,
        { method: 'POST', credentials: 'include', headers: { ...authHeaders(), ...csrfHeaders() }, body },
      )
      products.value.unshift(data.product)
    }
    closePanel()
  }
  catch (e: unknown) {
    const err = e as { data?: { error?: string }; message?: string }
    saveError.value = err?.data?.error ?? err?.message ?? 'Erreur lors de la sauvegarde'
  }
  finally { saving.value = false }
}

// ── Delete (soft) ─────────────────────────────────────────────────────────────
async function deleteProduct(p: Product) {
  if (!confirm(`Désactiver « ${p.name} » ? Le produit sera masqué du catalogue.`)) return
  deleting.value = p.id
  try {
    await $fetch(
      `${config.public.apiUrl}/products/${p.id}`,
      { method: 'DELETE', credentials: 'include', headers: { ...authHeaders(), ...csrfHeaders() } },
    )
    products.value = products.value.filter(x => x.id !== p.id)
  }
  catch (e) { alert('Impossible de supprimer ce produit.') }
  finally { deleting.value = null }
}
</script>

<template>
  <div class="min-h-screen bg-neutral-50">
    <!-- ═══ Header ═══ -->
    <div class="relative overflow-hidden bg-section-dark px-6 py-12 sm:px-10">
      <div class="pointer-events-none absolute -right-20 -top-20 size-80 rounded-full bg-emerald-500/15 blur-3xl" />
      <div class="pointer-events-none absolute -bottom-10 -left-10 size-64 rounded-full bg-primary-400/10 blur-2xl" />

      <div class="relative mx-auto max-w-7xl">
        <NuxtLink to="/admin" class="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-body-sm font-medium text-neutral-300 backdrop-blur-sm transition hover:bg-white/15 hover:text-white">
          <Icon name="ph:arrow-left" class="size-4" /> Admin
        </NuxtLink>

        <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 class="text-h1 font-semibold text-white">
              Produits
            </h1>
            <p class="mt-1 text-body text-neutral-400">
              {{ products.length }} produit{{ products.length !== 1 ? 's' : '' }} actif{{ products.length !== 1 ? 's' : '' }} dans le catalogue
            </p>
          </div>
          <button
            class="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-body-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-600"
            @click="openCreate"
          >
            <Icon name="ph:plus" class="size-4" />
            Nouveau produit
          </button>
        </div>
      </div>
    </div>

    <!-- ═══ Content ═══ -->
    <div class="mx-auto max-w-7xl px-6 py-8 sm:px-10">
      <!-- Filters -->
      <div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div class="relative flex-1">
          <Icon name="ph:magnifying-glass" class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
          <input
            v-model="searchQuery"
            type="search"
            placeholder="Rechercher un produit..."
            class="w-full rounded-xl border border-neutral-200 bg-white py-2.5 pl-9 pr-4 text-body-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
          >
        </div>
        <select
          v-model="categoryFilter"
          class="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-body-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
        >
          <option value="all">
            Toutes les catégories
          </option>
          <option v-for="c in categories" :key="c.id" :value="c.id">
            {{ c.name }}
          </option>
        </select>
        <button class="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-body-sm font-medium text-text-secondary transition hover:bg-neutral-50" @click="fetchAll">
          <Icon name="ph:arrows-clockwise" class="size-4" /> Actualiser
        </button>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div v-for="i in 6" :key="i" class="h-40 animate-pulse rounded-2xl bg-white" />
      </div>

      <!-- Error -->
      <div v-else-if="error" class="rounded-2xl border border-error/20 bg-error/5 p-8 text-center">
        <Icon name="ph:warning-circle" class="mx-auto mb-3 size-10 text-error" />
        <p class="text-body font-medium text-error">{{ error }}</p>
        <button class="mt-4 rounded-xl bg-primary-600 px-5 py-2 text-body-sm font-medium text-white transition hover:bg-primary-700" @click="fetchAll">
          Réessayer
        </button>
      </div>

      <!-- Empty -->
      <EmptyState v-else-if="filtered.length === 0" title="Aucun produit" description="Aucun produit ne correspond à vos filtres.">
        <template #icon><Icon name="ph:package" class="size-10 text-emerald-500" /></template>
        <template #actions>
          <button class="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-body-sm font-semibold text-white transition hover:bg-emerald-600" @click="openCreate">
            <Icon name="ph:plus" class="size-4" /> Créer un produit
          </button>
        </template>
      </EmptyState>

      <!-- Grid -->
      <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="p in filtered"
          :key="p.id"
          class="group overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition hover:border-primary-200 hover:shadow-md"
        >
          <!-- Image -->
          <div class="relative h-40 overflow-hidden bg-neutral-100">
            <img v-if="p.imageUrl" :src="p.imageUrl" :alt="p.name" class="size-full object-cover transition duration-300 group-hover:scale-105">
            <div v-else class="flex size-full items-center justify-center">
              <Icon name="ph:image" class="size-10 text-neutral-300" />
            </div>
            <!-- Badges -->
            <div class="absolute left-3 top-3 flex gap-1.5">
              <span v-if="p.featured" class="rounded-full bg-amber-500 px-2 py-0.5 text-caption font-bold text-white">
                ★ Vedette
              </span>
            </div>
          </div>

          <!-- Body -->
          <div class="p-4">
            <div class="mb-1 flex items-start justify-between gap-2">
              <p class="text-body-sm font-semibold text-text-primary leading-tight">
                {{ p.name }}
              </p>
              <p class="shrink-0 text-body-sm font-bold text-primary-600">
                {{ displayPrice(p) }}
              </p>
            </div>

            <p class="text-caption text-text-muted">
              {{ p.category?.name ?? '—' }}
              <span v-if="p.brand"> · {{ p.brand.name }}</span>
            </p>

            <p v-if="p.description" class="mt-2 line-clamp-2 text-caption text-text-muted">
              {{ p.description }}
            </p>

            <!-- Actions -->
            <div class="mt-4 flex items-center gap-2">
              <button
                class="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-neutral-200 py-2 text-body-sm font-medium text-text-secondary transition hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700"
                @click="openEdit(p)"
              >
                <Icon name="ph:pencil-simple" class="size-4" /> Modifier
              </button>
              <button
                :disabled="deleting === p.id"
                class="flex size-9 items-center justify-center rounded-xl border border-neutral-200 text-neutral-400 transition hover:border-error/30 hover:bg-error/5 hover:text-error disabled:opacity-40"
                @click="deleteProduct(p)"
              >
                <Icon v-if="deleting !== p.id" name="ph:trash" class="size-4" />
                <Icon v-else name="ph:circle-notch" class="size-4 animate-spin" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══ Slide-over panel ═══ -->
    <Teleport to="body">
      <Transition name="panel">
        <div v-if="showPanel" class="fixed inset-0 z-50 flex justify-end">
          <!-- Backdrop -->
          <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="closePanel" />

          <!-- Panel -->
          <div class="relative flex h-full w-full max-w-lg flex-col bg-white shadow-2xl">
            <!-- Header -->
            <div class="flex items-center justify-between border-b border-neutral-100 px-6 py-5">
              <h2 class="text-h4 font-semibold text-text-primary">
                {{ editingProduct ? 'Modifier le produit' : 'Nouveau produit' }}
              </h2>
              <button class="flex size-9 items-center justify-center rounded-xl text-neutral-400 transition hover:bg-neutral-100" @click="closePanel">
                <Icon name="ph:x" class="size-5" />
              </button>
            </div>

            <!-- Form -->
            <div class="flex-1 overflow-y-auto px-6 py-6 space-y-5">
              <!-- Name -->
              <div>
                <label class="mb-1.5 block text-body-sm font-medium text-text-primary">Nom *</label>
                <input v-model="form.name" type="text" placeholder="Nom du produit" class="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-body-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100">
              </div>

              <!-- Slug -->
              <div>
                <label class="mb-1.5 block text-body-sm font-medium text-text-primary">Slug *</label>
                <input v-model="form.slug" type="text" placeholder="mon-produit" class="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 font-mono text-body-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100">
                <p class="mt-1 text-caption text-text-muted">
                  Généré automatiquement depuis le nom
                </p>
              </div>

              <!-- Description -->
              <div>
                <label class="mb-1.5 block text-body-sm font-medium text-text-primary">Description</label>
                <textarea v-model="form.description" rows="3" placeholder="Description du produit..." class="w-full resize-none rounded-xl border border-neutral-200 px-4 py-2.5 text-body-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100" />
              </div>

              <!-- Image URL -->
              <div>
                <label class="mb-1.5 block text-body-sm font-medium text-text-primary">URL de l'image</label>
                <input v-model="form.imageUrl" type="url" placeholder="https://..." class="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-body-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100">
              </div>

              <!-- Pricing type -->
              <div>
                <label class="mb-1.5 block text-body-sm font-medium text-text-primary">Type de tarification *</label>
                <div class="grid grid-cols-2 gap-2">
                  <label
                    v-for="pt in [{ v:'flat',label:'Forfait'},{v:'tiered',label:'Paliers (h/j/sem)'}]"
                    :key="pt.v"
                    class="flex cursor-pointer items-center gap-2 rounded-xl border-2 px-4 py-2.5 text-body-sm font-medium transition"
                    :class="form.pricingType === pt.v ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-neutral-200 text-text-secondary hover:border-neutral-300'"
                  >
                    <input v-model="form.pricingType" type="radio" :value="pt.v" class="sr-only">
                    {{ pt.label }}
                  </label>
                </div>
              </div>

              <!-- Prices -->
              <div v-if="form.pricingType === 'flat'">
                <label class="mb-1.5 block text-body-sm font-medium text-text-primary">Prix forfaitaire (€)</label>
                <input v-model="form.flatPrice" type="number" min="0" step="0.01" placeholder="0.00" class="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-body-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100">
              </div>
              <div v-else class="grid grid-cols-3 gap-3">
                <div>
                  <label class="mb-1.5 block text-caption font-medium text-text-muted">Par heure (€)</label>
                  <input v-model="form.hourlyPrice" type="number" min="0" step="0.01" placeholder="0.00" class="w-full rounded-xl border border-neutral-200 px-3 py-2 text-body-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100">
                </div>
                <div>
                  <label class="mb-1.5 block text-caption font-medium text-text-muted">Par jour (€)</label>
                  <input v-model="form.dailyPrice" type="number" min="0" step="0.01" placeholder="0.00" class="w-full rounded-xl border border-neutral-200 px-3 py-2 text-body-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100">
                </div>
                <div>
                  <label class="mb-1.5 block text-caption font-medium text-text-muted">Par semaine (€)</label>
                  <input v-model="form.weeklyPrice" type="number" min="0" step="0.01" placeholder="0.00" class="w-full rounded-xl border border-neutral-200 px-3 py-2 text-body-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100">
                </div>
              </div>

              <!-- Category + Brand -->
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="mb-1.5 block text-body-sm font-medium text-text-primary">Catégorie</label>
                  <select v-model="form.categoryId" class="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-body-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100">
                    <option value="">
                      Aucune
                    </option>
                    <option v-for="c in categories" :key="c.id" :value="c.id">
                      {{ c.name }}
                    </option>
                  </select>
                </div>
                <div>
                  <label class="mb-1.5 block text-body-sm font-medium text-text-primary">Marque</label>
                  <select v-model="form.brandId" class="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-body-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100">
                    <option value="">
                      Aucune
                    </option>
                    <option v-for="b in brands" :key="b.id" :value="b.id">
                      {{ b.name }}
                    </option>
                  </select>
                </div>
              </div>

              <!-- Toggles -->
              <div class="flex flex-col gap-3">
                <label class="flex cursor-pointer items-center justify-between rounded-xl border border-neutral-200 px-4 py-3">
                  <div>
                    <p class="text-body-sm font-medium text-text-primary">
                      Produit vedette
                    </p>
                    <p class="text-caption text-text-muted">
                      Mis en avant sur la landing page
                    </p>
                  </div>
                  <div
                    class="relative h-6 w-11 rounded-full transition"
                    :class="form.featured ? 'bg-primary-500' : 'bg-neutral-200'"
                    @click="form.featured = !form.featured"
                  >
                    <div class="absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform" :class="form.featured ? 'translate-x-5' : 'translate-x-0.5'" />
                  </div>
                </label>
                <label class="flex cursor-pointer items-center justify-between rounded-xl border border-neutral-200 px-4 py-3">
                  <div>
                    <p class="text-body-sm font-medium text-text-primary">
                      Actif
                    </p>
                    <p class="text-caption text-text-muted">
                      Visible dans le catalogue
                    </p>
                  </div>
                  <div
                    class="relative h-6 w-11 rounded-full transition"
                    :class="form.isActive ? 'bg-emerald-500' : 'bg-neutral-200'"
                    @click="form.isActive = !form.isActive"
                  >
                    <div class="absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform" :class="form.isActive ? 'translate-x-5' : 'translate-x-0.5'" />
                  </div>
                </label>
              </div>

              <!-- Error -->
              <div v-if="saveError" class="rounded-xl border border-error/20 bg-error/10 px-4 py-3 text-body-sm text-error">
                {{ saveError }}
              </div>
            </div>

            <!-- Footer -->
            <div class="flex items-center gap-3 border-t border-neutral-100 px-6 py-5">
              <button
                :disabled="saving || !form.name.trim() || !form.slug.trim()"
                class="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary-600 py-2.5 text-body-sm font-semibold text-white transition hover:bg-primary-700 disabled:opacity-50"
                @click="save"
              >
                <Icon v-if="saving" name="ph:circle-notch" class="size-4 animate-spin" />
                <Icon v-else name="ph:floppy-disk" class="size-4" />
                {{ saving ? 'Sauvegarde...' : (editingProduct ? 'Enregistrer' : 'Créer le produit') }}
              </button>
              <button class="rounded-xl border border-neutral-200 px-5 py-2.5 text-body-sm font-medium text-text-secondary transition hover:bg-neutral-50" @click="closePanel">
                Annuler
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.panel-enter-active,
.panel-leave-active {
  transition: opacity 0.2s ease;
}
.panel-enter-from,
.panel-leave-to {
  opacity: 0;
}
.panel-enter-active .max-w-lg,
.panel-leave-active .max-w-lg {
  transition: transform 0.25s ease;
}
.panel-enter-from .max-w-lg,
.panel-leave-to .max-w-lg {
  transform: translateX(100%);
}
</style>
