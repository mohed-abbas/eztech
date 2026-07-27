<script setup lang="ts">
definePageMeta({
  layout: 'admin',
  middleware: ['auth', 'role'],
  role: 'admin',
})

useHead({ title: 'Catégories — Admin EzTech' })

const { adminFetch } = useAdminApi()
const auth = useAuthStore()

// ── Types ─────────────────────────────────────────────────────────────────────
interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  _count?: { products: number }
}

// ── State ─────────────────────────────────────────────────────────────────────
const categories = ref<Category[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const searchQuery = ref('')

const showModal = ref(false)
const editing = ref<Category | null>(null)
const saving = ref(false)
const saveError = ref<string | null>(null)
const deleting = ref<string | null>(null)
const deleteError = ref<string | null>(null)

// ── Formulaire ────────────────────────────────────────────────────────────────
const emptyForm = () => ({ name: '', slug: '', description: '', icon: '' })
const form = reactive(emptyForm())

// Champs déjà visités : on n'affiche l'erreur qu'après interaction.
const touched = reactive<Record<string, boolean>>({ name: false, slug: false })
function touch(field: string) {
  touched[field] = true
}
function resetTouched() {
  // on remet à false plutôt que `delete touched[k]` (règle eslint no-dynamic-delete)
  for (const k of Object.keys(touched)) touched[k] = false
}

const fieldErrors = computed(() => {
  const e: Record<string, string> = {}
  if (!form.name.trim()) e.name = 'Le nom est obligatoire.'
  if (!form.slug.trim()) e.slug = 'Le slug est obligatoire.'
  // même contrainte que le backend : /^[a-z0-9-]+$/ (backend/src/schemas/catalog.ts:3)
  else if (!/^[a-z0-9-]+$/.test(form.slug.trim()))
    e.slug = 'Uniquement des lettres minuscules, chiffres et tirets.'
  return e
})

const formValid = computed(() => Object.keys(fieldErrors.value).length === 0)

function err(field: string) {
  return touched[field] ? fieldErrors.value[field] : undefined
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

// slug auto-généré tant qu'on crée ; en édition on ne l'écrase pas
watch(
  () => form.name,
  (v) => {
    if (!editing.value) form.slug = slugify(v)
  },
)

// ── Chargement ────────────────────────────────────────────────────────────────
async function fetchAll() {
  auth.hydrate()
  loading.value = true
  error.value = null
  try {
    const data = await adminFetch<{ categories: Category[] }>('/categories')
    categories.value = data.categories
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : 'Erreur de chargement'
  }
  finally {
    loading.value = false
  }
}

onMounted(fetchAll)

const filtered = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return categories.value
  return categories.value.filter(
    c => c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q),
  )
})

// ── Modale ────────────────────────────────────────────────────────────────────
function openCreate() {
  editing.value = null
  Object.assign(form, emptyForm())
  saveError.value = null
  resetTouched()
  showModal.value = true
}

function openEdit(c: Category) {
  editing.value = c
  Object.assign(form, {
    name: c.name,
    slug: c.slug,
    description: c.description ?? '',
    icon: c.icon ?? '',
  })
  saveError.value = null
  resetTouched()
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  editing.value = null
  saveError.value = null
  resetTouched()
}

// ── Erreurs backend → copie française ─────────────────────────────────────────
interface ZodIssue { message?: string, path?: (string | number)[] }

// Le middleware d'erreur du backend renvoie deux enveloppes selon le chemin :
//   HttpError(422, 'validation_failed', { issues })  → { error, details: { issues } }
//   ZodError non capturée                            → { error, issues }
// (backend/src/middleware/error.ts:15-22) — on lit donc les deux.
function issuesOf(body: unknown): ZodIssue[] {
  const b = body as { issues?: ZodIssue[], details?: { issues?: ZodIssue[] } } | undefined
  return b?.details?.issues ?? b?.issues ?? []
}

// Les messages Zod sont des codes techniques ('invalid_slug', 'Too small'…),
// on les traduit par champ pour rester lisible côté admin.
const FIELD_LABELS: Record<string, string> = {
  name: 'Nom',
  slug: 'Slug',
  description: 'Description',
  icon: 'Icône',
}

function describeIssues(issues: ZodIssue[]): string | null {
  if (!issues.length) return null
  const parts = issues.map((i) => {
    const field = String(i.path?.[0] ?? '')
    const label = FIELD_LABELS[field] ?? field
    if (field === 'slug')
      return `${label} : uniquement des lettres minuscules, chiffres et tirets.`
    return label ? `${label} : valeur invalide.` : 'Valeur invalide.'
  })
  return [...new Set(parts)].join(' · ')
}

function toFrench(e: unknown, fallback: string): string {
  const apiErr = e as {
    data?: { error?: string }
    statusCode?: number
    message?: string
  }
  const code = apiErr?.data?.error
  const map: Record<string, string> = {
    validation_failed:
      describeIssues(issuesOf(apiErr?.data)) ?? 'Certains champs sont invalides.',
    slug_taken: 'Ce slug est déjà pris par une autre catégorie.',
    category_not_found: 'Cette catégorie n’existe plus. Actualisez la liste.',
    category_in_use:
      'Suppression impossible : des produits sont encore rattachés à cette catégorie.',
    missing_token: 'Session expirée, veuillez vous reconnecter.',
    invalid_token: 'Session expirée, veuillez vous reconnecter.',
    forbidden: 'Action réservée aux administrateurs.',
  }
  if (code && map[code]) return map[code]
  if (apiErr?.statusCode === 409) return 'Conflit : ce slug est déjà utilisé.'
  if (apiErr?.statusCode === 403) return 'Action réservée aux administrateurs.'
  return apiErr?.message ?? fallback
}

// ── Enregistrement (création / modification) ──────────────────────────────────
async function save() {
  // révèle les erreurs restantes même si l'utilisateur n'a rien visité
  touched.name = true
  touched.slug = true
  if (!formValid.value) return

  saving.value = true
  saveError.value = null
  try {
    // CreateCategorySchema refuse `null` sur description/icon : on omet le champ
    // vide à la création, et on envoie une chaîne vide en PATCH pour l'effacer.
    const body: Record<string, unknown> = {
      name: form.name.trim(),
      slug: form.slug.trim(),
    }
    const description = form.description.trim()
    const icon = form.icon.trim()
    if (editing.value) {
      body.description = description
      body.icon = icon
    }
    else {
      if (description) body.description = description
      if (icon) body.icon = icon
    }

    if (editing.value) {
      const data = await adminFetch<{ category: Category }>(
        `/categories/${editing.value.id}`,
        { method: 'PATCH', body },
      )
      const idx = categories.value.findIndex(c => c.id === editing.value!.id)
      if (idx !== -1) {
        // l'API PATCH ne renvoie pas _count : on conserve celui déjà chargé
        categories.value[idx] = {
          ...data.category,
          _count: categories.value[idx]?._count,
        }
      }
    }
    else {
      const data = await adminFetch<{ category: Category }>('/categories', {
        method: 'POST',
        body,
      })
      categories.value.push({ ...data.category, _count: { products: 0 } })
      categories.value.sort((a, b) => a.name.localeCompare(b.name, 'fr'))
    }
    closeModal()
  }
  catch (e) {
    saveError.value = toFrench(e, 'Erreur lors de la sauvegarde.')
  }
  finally {
    saving.value = false
  }
}

// ── Suppression ───────────────────────────────────────────────────────────────
async function remove(c: Category) {
  if (!confirm(`Supprimer la catégorie « ${c.name} » ? Cette action est définitive.`)) return
  deleting.value = c.id
  deleteError.value = null
  try {
    await adminFetch(`/categories/${c.id}`, { method: 'DELETE' })
    categories.value = categories.value.filter(x => x.id !== c.id)
  }
  catch (e) {
    deleteError.value = toFrench(e, 'Impossible de supprimer cette catégorie.')
  }
  finally {
    deleting.value = null
  }
}
</script>

<template>
  <div>
    <!-- ═══ En-tête ═══ -->
    <div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-h2 font-semibold text-text-primary">
          Catégories
        </h1>
        <p class="mt-1 text-body-sm text-text-muted">
          {{ categories.length }} catégorie{{ categories.length !== 1 ? 's' : '' }} dans le catalogue
        </p>
      </div>
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-4 py-2.5 text-body-sm font-medium text-text-secondary transition hover:bg-neutral-50"
          @click="fetchAll"
        >
          <Icon name="ph:arrows-clockwise" class="size-4" />
          Actualiser
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-body-sm font-semibold text-white transition hover:bg-primary-700"
          @click="openCreate"
        >
          <Icon name="ph:plus" class="size-4" />
          Nouvelle catégorie
        </button>
      </div>
    </div>

    <!-- Recherche -->
    <div class="relative mb-5 max-w-sm">
      <Icon
        name="ph:magnifying-glass"
        class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400"
      />
      <input
        v-model="searchQuery"
        type="search"
        placeholder="Rechercher une catégorie..."
        aria-label="Rechercher une catégorie"
        class="w-full rounded-xl border border-border bg-white py-2.5 pl-9 pr-4 text-body-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
      >
    </div>

    <!-- Erreur de suppression -->
    <div
      v-if="deleteError"
      class="mb-4 rounded-xl border border-error/20 bg-error/10 px-4 py-3 text-body-sm text-error"
    >
      {{ deleteError }}
    </div>

    <!-- Chargement -->
    <div v-if="loading" class="space-y-3">
      <div v-for="i in 4" :key="i" class="h-16 animate-pulse rounded-2xl bg-white" />
    </div>

    <!-- Erreur -->
    <div
      v-else-if="error"
      class="rounded-2xl border border-error/20 bg-error/5 p-8 text-center"
    >
      <Icon name="ph:warning-circle" class="mx-auto mb-3 size-10 text-error" />
      <p class="text-body font-medium text-error">
        {{ error }}
      </p>
      <button
        type="button"
        class="mt-4 rounded-xl bg-primary-600 px-5 py-2 text-body-sm font-medium text-white transition hover:bg-primary-700"
        @click="fetchAll"
      >
        Réessayer
      </button>
    </div>

    <!-- Vide -->
    <EmptyState
      v-else-if="filtered.length === 0"
      title="Aucune catégorie"
      :description="searchQuery.trim()
        ? 'Aucune catégorie ne correspond à votre recherche.'
        : 'Créez votre première catégorie pour organiser le catalogue.'"
    >
      <template #icon>
        <Icon name="ph:tag" class="size-10 text-primary-500" />
      </template>
      <template #actions>
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-body-sm font-semibold text-white transition hover:bg-primary-700"
          @click="openCreate"
        >
          <Icon name="ph:plus" class="size-4" />
          Créer une catégorie
        </button>
      </template>
    </EmptyState>

    <!-- Tableau -->
    <div v-else class="overflow-hidden rounded-2xl border border-border bg-white">
      <div class="overflow-x-auto">
        <table class="w-full min-w-[46rem] text-left">
          <thead class="border-b border-border bg-neutral-50">
            <tr class="text-caption font-bold uppercase tracking-wider text-text-muted">
              <th scope="col" class="px-5 py-3">
                Nom
              </th>
              <th scope="col" class="px-5 py-3">
                Slug
              </th>
              <th scope="col" class="px-5 py-3">
                Description
              </th>
              <th scope="col" class="px-5 py-3">
                Produits
              </th>
              <th scope="col" class="px-5 py-3 text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr v-for="c in filtered" :key="c.id" class="transition hover:bg-neutral-50">
              <td class="px-5 py-3">
                <div class="flex items-center gap-3">
                  <span
                    class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700"
                  >
                    <Icon :name="c.icon || 'ph:tag'" class="size-4" />
                  </span>
                  <span class="text-body-sm font-semibold text-text-primary">{{ c.name }}</span>
                </div>
              </td>
              <td class="px-5 py-3">
                <code class="rounded bg-neutral-100 px-2 py-0.5 font-mono text-caption text-text-secondary">
                  {{ c.slug }}
                </code>
              </td>
              <td class="max-w-xs px-5 py-3">
                <p class="line-clamp-2 text-body-sm text-text-muted">
                  {{ c.description || '—' }}
                </p>
              </td>
              <td class="px-5 py-3 text-body-sm text-text-muted">
                {{ c._count?.products ?? 0 }}
              </td>
              <td class="px-5 py-3">
                <div class="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    class="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-body-sm font-medium text-text-secondary transition hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700"
                    @click="openEdit(c)"
                  >
                    <Icon name="ph:pencil-simple" class="size-4" />
                    Modifier
                  </button>
                  <button
                    type="button"
                    :disabled="deleting === c.id"
                    :aria-label="`Supprimer ${c.name}`"
                    class="flex size-9 items-center justify-center rounded-xl border border-border text-neutral-400 transition hover:border-error/30 hover:bg-error/5 hover:text-error disabled:opacity-40"
                    @click="remove(c)"
                  >
                    <Icon v-if="deleting !== c.id" name="ph:trash" class="size-4" />
                    <Icon v-else name="ph:circle-notch" class="size-4 animate-spin" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ═══ Modale ═══ -->
    <UiModal
      :open="showModal"
      :title="editing ? 'Modifier la catégorie' : 'Nouvelle catégorie'"
      size="lg"
      @close="closeModal"
    >
      <div class="space-y-5">
        <!-- Nom -->
        <div>
          <label
            for="cat-name"
            class="mb-1.5 flex items-center gap-1 text-body-sm font-medium text-text-primary"
          >
            Nom
            <span class="text-error">*</span>
          </label>
          <input
            id="cat-name"
            v-model="form.name"
            type="text"
            placeholder="Vélos électriques"
            class="w-full rounded-xl border px-4 py-2.5 text-body-sm focus:outline-none focus:ring-2"
            :class="err('name')
              ? 'border-error/60 bg-error/5 focus:border-error focus:ring-error/20'
              : 'border-border focus:border-primary-400 focus:ring-primary-100'"
            @blur="touch('name')"
          >
          <p v-if="err('name')" class="mt-1 flex items-center gap-1 text-caption text-error">
            <Icon name="ph:warning-circle" class="size-3.5 shrink-0" />
            {{ err('name') }}
          </p>
        </div>

        <!-- Slug -->
        <div>
          <label
            for="cat-slug"
            class="mb-1.5 flex items-center gap-1 text-body-sm font-medium text-text-primary"
          >
            Slug
            <span class="text-error">*</span>
          </label>
          <input
            id="cat-slug"
            v-model="form.slug"
            type="text"
            placeholder="velos-electriques"
            class="w-full rounded-xl border px-4 py-2.5 font-mono text-body-sm focus:outline-none focus:ring-2"
            :class="err('slug')
              ? 'border-error/60 bg-error/5 focus:border-error focus:ring-error/20'
              : 'border-border bg-neutral-50 focus:border-primary-400 focus:ring-primary-100'"
            @blur="touch('slug')"
          >
          <p v-if="err('slug')" class="mt-1 flex items-center gap-1 text-caption text-error">
            <Icon name="ph:warning-circle" class="size-3.5 shrink-0" />
            {{ err('slug') }}
          </p>
          <p v-else class="mt-1 text-caption text-text-muted">
            {{ editing ? 'Utilisé dans les URL du catalogue.' : 'Généré automatiquement depuis le nom.' }}
          </p>
        </div>

        <!-- Description -->
        <div>
          <label for="cat-description" class="mb-1.5 block text-body-sm font-medium text-text-primary">
            Description
          </label>
          <textarea
            id="cat-description"
            v-model="form.description"
            rows="3"
            placeholder="Courte description affichée dans le catalogue (optionnel)"
            class="w-full resize-none rounded-xl border border-border px-4 py-2.5 text-body-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
        </div>

        <!-- Icône -->
        <div>
          <label for="cat-icon" class="mb-1.5 block text-body-sm font-medium text-text-primary">
            Icône
          </label>
          <div class="flex items-center gap-3">
            <span
              class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700"
            >
              <Icon :name="form.icon || 'ph:tag'" class="size-5" />
            </span>
            <input
              id="cat-icon"
              v-model="form.icon"
              type="text"
              placeholder="ph:bicycle"
              class="w-full rounded-xl border border-border px-4 py-2.5 font-mono text-body-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
            >
          </div>
          <p class="mt-1 text-caption text-text-muted">
            Nom d'icône Iconify, par exemple <code>ph:bicycle</code> (optionnel).
          </p>
        </div>

        <!-- Erreur serveur -->
        <div
          v-if="saveError"
          class="rounded-xl border border-error/20 bg-error/10 px-4 py-3 text-body-sm text-error"
        >
          {{ saveError }}
        </div>
      </div>

      <template #footer>
        <div class="flex items-center gap-3">
          <button
            type="button"
            :disabled="saving || !formValid"
            :title="!formValid ? 'Renseignez les champs obligatoires' : ''"
            class="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary-600 py-2.5 text-body-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-40"
            @click="save"
          >
            <Icon v-if="saving" name="ph:circle-notch" class="size-4 animate-spin" />
            <Icon v-else name="ph:floppy-disk" class="size-4" />
            {{ saving ? 'Sauvegarde...' : editing ? 'Enregistrer' : 'Créer la catégorie' }}
          </button>
          <button
            type="button"
            class="rounded-xl border border-border px-5 py-2.5 text-body-sm font-medium text-text-secondary transition hover:bg-neutral-50"
            @click="closeModal"
          >
            Annuler
          </button>
        </div>
      </template>
    </UiModal>
  </div>
</template>
