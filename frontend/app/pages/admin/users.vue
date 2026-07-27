<script setup lang="ts">
definePageMeta({
  layout: 'admin',
  middleware: ['auth', 'role'],
  role: 'admin',
})

useHead({ title: 'Utilisateurs — Admin EzTech' })

const { adminFetch } = useAdminApi()
const auth = useAuthStore()

// ── Types ────────────────────────────────────────────────────────────────────
type Role = 'customer' | 'rider' | 'warehouse_manager' | 'admin'

interface AdminUser {
  id: string
  email: string
  name: string
  phone: string
  role: Role
  createdAt: string
  vehicleType?: 'bicycle' | 'scooter' | 'car' | null
  licenseNumber?: string | null
  insuranceNumber?: string | null
  riderApplicationStatus?: 'pending' | 'approved' | 'rejected'
  riderOnline?: boolean
  emailVerifiedAt?: string | null
  emailOptOut?: boolean
}

// Le backend plafonne la liste (take: 200, tri createdAt desc) — cf. backend/src/routes/users.ts
const HARD_CAP = 200

const ROLES: { value: Role, label: string }[] = [
  { value: 'customer', label: 'Client' },
  { value: 'rider', label: 'Livreur' },
  { value: 'warehouse_manager', label: 'Responsable entrepôt' },
  { value: 'admin', label: 'Administrateur' },
]

const ROLE_LABEL: Record<Role, string> = {
  customer: 'Client',
  rider: 'Livreur',
  warehouse_manager: 'Responsable entrepôt',
  admin: 'Administrateur',
}

const ROLE_BADGE: Record<Role, string> = {
  customer: 'bg-neutral-100 text-neutral-700',
  rider: 'bg-sky-100 text-sky-700',
  warehouse_manager: 'bg-amber-100 text-amber-700',
  admin: 'bg-emerald-100 text-emerald-700',
}

// ── State ────────────────────────────────────────────────────────────────────
const users = ref<AdminUser[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const roleFilter = ref<'all' | Role>('all')
const searchQuery = ref('')

const showModal = ref(false)
const selected = ref<AdminUser | null>(null)
const saving = ref(false)
const saveError = ref<string | null>(null)

const form = reactive({ name: '', phone: '', role: 'customer' as Role })

// ── Fetch ────────────────────────────────────────────────────────────────────
async function fetchUsers() {
  auth.hydrate()
  loading.value = true
  error.value = null
  try {
    const qs = roleFilter.value === 'all' ? '' : `?role=${roleFilter.value}`
    const data = await adminFetch<{ users: AdminUser[] }>(`/users${qs}`)
    users.value = data.users
  }
  catch (e: unknown) {
    error.value = readApiError(e, 'Impossible de charger les utilisateurs.')
  }
  finally {
    loading.value = false
  }
}

onMounted(fetchUsers)
watch(roleFilter, fetchUsers)

// ── Erreurs API ──────────────────────────────────────────────────────────────
function readApiError(e: unknown, fallback: string): string {
  const err = e as {
    data?: { error?: string, issues?: { message: string }[] }
    statusCode?: number
    message?: string
  }
  const code = err?.data?.error
  const map: Record<string, string> = {
    forbidden: 'Accès refusé : votre compte n\'est pas administrateur.',
    missing_token: 'Session expirée, reconnectez-vous.',
    invalid_token: 'Session expirée, reconnectez-vous.',
    user_not_found: 'Utilisateur introuvable (il a peut-être été supprimé).',
    validation_failed:
      err?.data?.issues?.map(i => i.message).join(' · ') ?? 'Données invalides.',
  }
  if (code && map[code]) return map[code]
  return err?.message ?? fallback
}

// ── Filtre client (recherche nom / email) ────────────────────────────────────
const filtered = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return users.value
  return users.value.filter(
    u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
  )
})

const capReached = computed(() => users.value.length === HARD_CAP)

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase() ?? '')
    .join('')
}

// L'admin connecté ne doit jamais pouvoir se retirer son propre rôle :
// le backend (PATCH /api/users/:id) n'a aucune garde de ce genre.
const isSelf = computed(() => !!selected.value && selected.value.id === auth.user?.id)

// ── Modal ────────────────────────────────────────────────────────────────────
function openUser(u: AdminUser) {
  selected.value = u
  form.name = u.name
  form.phone = u.phone ?? ''
  form.role = u.role
  saveError.value = null
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  selected.value = null
  saveError.value = null
}

const nameError = computed(() =>
  form.name.trim() ? undefined : 'Le nom est obligatoire.',
)

const roleChanged = computed(() => !!selected.value && form.role !== selected.value.role)

const canSave = computed(() => !nameError.value && !(isSelf.value && roleChanged.value))

async function save() {
  const target = selected.value
  if (!target || !canSave.value) return

  // Garde-fou 1 : un admin ne peut pas se rétrograder lui-même.
  if (isSelf.value && roleChanged.value) {
    saveError.value = 'Vous ne pouvez pas modifier votre propre rôle.'
    return
  }
  // Garde-fou 2 : promotion en administrateur → confirmation explicite.
  if (roleChanged.value && form.role === 'admin') {
    const ok = confirm(
      `Promouvoir « ${target.name} » au rôle Administrateur ?\n\n`
      + 'Cette personne aura un accès complet : utilisateurs, catalogue, commandes et entrepôts.',
    )
    if (!ok) return
  }
  // Garde-fou 3 : retirer le rôle admin à quelqu'un d'autre → confirmation aussi.
  if (roleChanged.value && target.role === 'admin') {
    const ok = confirm(
      `Retirer les droits d'administrateur à « ${target.name} » ?`,
    )
    if (!ok) return
  }

  saving.value = true
  saveError.value = null
  try {
    const body: Record<string, unknown> = {
      name: form.name.trim(),
      phone: form.phone.trim(),
    }
    // On n'envoie `role` que s'il change réellement (évite un no-op côté Prisma).
    if (roleChanged.value) body.role = form.role

    const data = await adminFetch<{ user: AdminUser }>(`/users/${target.id}`, {
      method: 'PATCH',
      body,
    })

    const idx = users.value.findIndex(u => u.id === target.id)
    if (idx !== -1) users.value[idx] = data.user
    // Si le filtre de rôle est actif et que le rôle a changé, la ligne n'appartient plus à la vue.
    if (roleFilter.value !== 'all' && data.user.role !== roleFilter.value) {
      users.value = users.value.filter(u => u.id !== target.id)
    }
    closeModal()
  }
  catch (e: unknown) {
    saveError.value = readApiError(e, 'Erreur lors de l\'enregistrement.')
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <!-- le layout `admin` fournit déjà la largeur max, les marges et la navigation -->
  <div class="pb-6">
    <!-- ═══ En-tête ═══ -->
    <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-h2 font-semibold text-text-primary">
          Utilisateurs
        </h1>
        <p class="mt-1 text-body-sm text-text-muted">
          {{ filtered.length }} utilisateur{{ filtered.length !== 1 ? 's' : '' }} affiché{{ filtered.length !== 1 ? 's' : '' }}
          <span v-if="searchQuery.trim()">sur {{ users.length }} chargé{{ users.length !== 1 ? 's' : '' }}</span>
        </p>
      </div>
      <button
        class="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-body-sm font-medium text-text-secondary transition hover:bg-neutral-50"
        @click="fetchUsers"
      >
        <Icon name="ph:arrows-clockwise" class="size-4" />
        Actualiser
      </button>
    </div>

    <!-- ═══ Filtres ═══ -->
    <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
      <div class="relative flex-1">
        <Icon
          name="ph:magnifying-glass"
          class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400"
        />
        <input
          v-model="searchQuery"
          type="search"
          placeholder="Rechercher par nom ou e-mail..."
          class="w-full rounded-xl border border-neutral-200 bg-white py-2.5 pl-9 pr-4 text-body-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
        >
      </div>
      <select
        v-model="roleFilter"
        aria-label="Filtrer par rôle"
        class="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-body-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
      >
        <option value="all">
          Tous les rôles
        </option>
        <option v-for="r in ROLES" :key="r.value" :value="r.value">
          {{ r.label }}
        </option>
      </select>
    </div>

    <!-- Plafond serveur : la liste n'est peut-être pas complète -->
    <div
      v-if="capReached"
      class="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-body-sm text-amber-800"
    >
      <Icon name="ph:info" class="mt-0.5 size-4 shrink-0" />
      <p>
        Seuls les {{ HARD_CAP }} comptes les plus récents sont affichés (limite de l'API).
        Affinez avec le filtre de rôle ou la recherche.
      </p>
    </div>

    <!-- ═══ Chargement ═══ -->
    <div v-if="loading" class="space-y-2">
      <div
        v-for="i in 6"
        :key="i"
        class="h-16 animate-pulse rounded-2xl bg-white"
      />
    </div>

    <!-- ═══ Erreur ═══ -->
    <div
      v-else-if="error"
      class="rounded-2xl border border-error/20 bg-error/5 p-8 text-center"
    >
      <Icon name="ph:warning-circle" class="mx-auto mb-3 size-10 text-error" />
      <p class="text-body font-medium text-error">
        {{ error }}
      </p>
      <button
        class="mt-4 rounded-xl bg-primary-600 px-5 py-2 text-body-sm font-medium text-white transition hover:bg-primary-700"
        @click="fetchUsers"
      >
        Réessayer
      </button>
    </div>

    <!-- ═══ Vide ═══ -->
    <EmptyState
      v-else-if="filtered.length === 0"
      title="Aucun utilisateur"
      description="Aucun compte ne correspond à ces critères."
    >
      <template #icon>
        <Icon name="ph:users" class="size-10 text-primary-500" />
      </template>
      <template #actions>
        <button
          class="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-5 py-2.5 text-body-sm font-medium text-text-secondary transition hover:bg-neutral-50"
          @click="searchQuery = ''; roleFilter = 'all'"
        >
          <Icon name="ph:funnel-simple" class="size-4" />
          Réinitialiser les filtres
        </button>
      </template>
    </EmptyState>

    <!-- ═══ Liste ═══ -->
    <div
      v-else
      class="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm"
    >
      <div class="overflow-x-auto">
        <table class="w-full min-w-[720px] text-left">
          <thead class="border-b border-neutral-100 bg-neutral-50">
            <tr>
              <th class="px-5 py-3 text-caption font-semibold uppercase tracking-wide text-text-muted">
                Utilisateur
              </th>
              <th class="px-5 py-3 text-caption font-semibold uppercase tracking-wide text-text-muted">
                Téléphone
              </th>
              <th class="px-5 py-3 text-caption font-semibold uppercase tracking-wide text-text-muted">
                Rôle
              </th>
              <th class="px-5 py-3 text-caption font-semibold uppercase tracking-wide text-text-muted">
                Inscrit le
              </th>
              <th class="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="u in filtered"
              :key="u.id"
              class="cursor-pointer border-b border-neutral-50 transition last:border-0 hover:bg-primary-50/40"
              @click="openUser(u)"
            >
              <td class="px-5 py-3.5">
                <div class="flex items-center gap-3">
                  <div
                    class="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-caption font-bold text-primary-700"
                  >
                    {{ initials(u.name) }}
                  </div>
                  <div class="min-w-0">
                    <p class="truncate text-body-sm font-semibold text-text-primary">
                      {{ u.name }}
                      <span v-if="u.id === auth.user?.id" class="ml-1 text-caption font-normal text-text-muted">(vous)</span>
                    </p>
                    <p class="truncate text-caption text-text-muted">
                      {{ u.email }}
                    </p>
                  </div>
                </div>
              </td>
              <td class="px-5 py-3.5 text-body-sm text-text-secondary">
                {{ u.phone || '—' }}
              </td>
              <td class="px-5 py-3.5">
                <span
                  class="inline-flex rounded-full px-2.5 py-1 text-caption font-semibold"
                  :class="ROLE_BADGE[u.role]"
                >
                  {{ ROLE_LABEL[u.role] }}
                </span>
                <span
                  v-if="u.role === 'rider' && u.riderApplicationStatus"
                  class="ml-1.5 text-caption text-text-muted"
                >
                  · {{ u.riderApplicationStatus === 'approved' ? 'validé' : u.riderApplicationStatus === 'rejected' ? 'refusé' : 'en attente' }}
                </span>
              </td>
              <td class="px-5 py-3.5 text-body-sm text-text-muted">
                {{ fmtDate(u.createdAt) }}
              </td>
              <td class="px-5 py-3.5 text-right">
                <Icon name="ph:caret-right" class="size-4 text-neutral-300" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ═══ Modale détail / édition ═══ -->
    <UiModal
      :open="showModal"
      :title="selected ? selected.name : 'Utilisateur'"
      size="lg"
      @close="closeModal"
    >
      <div v-if="selected" class="space-y-5">
        <!-- Fiche en lecture seule -->
        <div class="grid grid-cols-1 gap-3 rounded-xl bg-neutral-50 p-4 sm:grid-cols-2">
          <div>
            <p class="text-caption font-medium text-text-muted">
              E-mail
            </p>
            <p class="break-all text-body-sm text-text-primary">
              {{ selected.email }}
            </p>
          </div>
          <div>
            <p class="text-caption font-medium text-text-muted">
              Inscrit le
            </p>
            <p class="text-body-sm text-text-primary">
              {{ fmtDate(selected.createdAt) }}
            </p>
          </div>
          <div>
            <p class="text-caption font-medium text-text-muted">
              E-mail vérifié
            </p>
            <p class="text-body-sm text-text-primary">
              {{ selected.emailVerifiedAt ? 'Oui' : 'Non' }}
            </p>
          </div>
          <div>
            <p class="text-caption font-medium text-text-muted">
              Identifiant
            </p>
            <p class="break-all font-mono text-caption text-text-secondary">
              {{ selected.id }}
            </p>
          </div>
        </div>

        <!-- Bloc livreur (lecture seule ici : ces champs se modifient depuis /admin/riders) -->
        <div
          v-if="selected.role === 'rider'"
          class="rounded-xl border border-sky-100 bg-sky-50/60 p-4"
        >
          <p class="mb-2 text-body-sm font-semibold text-sky-800">
            Informations livreur
          </p>
          <div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div>
              <p class="text-caption text-text-muted">
                Véhicule
              </p>
              <p class="text-body-sm text-text-primary">
                {{ selected.vehicleType ?? '—' }}
              </p>
            </div>
            <div>
              <p class="text-caption text-text-muted">
                Permis
              </p>
              <p class="text-body-sm text-text-primary">
                {{ selected.licenseNumber || '—' }}
              </p>
            </div>
            <div>
              <p class="text-caption text-text-muted">
                Assurance
              </p>
              <p class="text-body-sm text-text-primary">
                {{ selected.insuranceNumber || '—' }}
              </p>
            </div>
          </div>
          <NuxtLink
            to="/admin/riders"
            class="mt-3 inline-flex items-center gap-1.5 text-caption font-medium text-sky-700 hover:underline"
          >
            Gérer la candidature
            <Icon name="ph:arrow-right" class="size-3.5" />
          </NuxtLink>
        </div>

        <!-- Formulaire -->
        <div>
          <label class="mb-1.5 flex items-center gap-1 text-body-sm font-medium text-text-primary">
            Nom
            <span class="text-error">*</span>
          </label>
          <input
            v-model="form.name"
            type="text"
            class="w-full rounded-xl border px-4 py-2.5 text-body-sm focus:outline-none focus:ring-2"
            :class="nameError
              ? 'border-error/60 bg-error/5 focus:border-error focus:ring-error/20'
              : 'border-neutral-200 focus:border-primary-400 focus:ring-primary-100'"
          >
          <p v-if="nameError" class="mt-1 flex items-center gap-1 text-caption text-error">
            <Icon name="ph:warning-circle" class="size-3.5 shrink-0" />
            {{ nameError }}
          </p>
        </div>

        <div>
          <label class="mb-1.5 block text-body-sm font-medium text-text-primary">
            Téléphone
          </label>
          <input
            v-model="form.phone"
            type="tel"
            placeholder="06 12 34 56 78"
            class="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-body-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
          >
        </div>

        <div>
          <label class="mb-1.5 block text-body-sm font-medium text-text-primary">
            Rôle
          </label>
          <select
            v-model="form.role"
            :disabled="isSelf"
            class="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-body-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-text-muted"
          >
            <option v-for="r in ROLES" :key="r.value" :value="r.value">
              {{ r.label }}
            </option>
          </select>
          <p v-if="isSelf" class="mt-1 flex items-center gap-1 text-caption text-text-muted">
            <Icon name="ph:lock-simple" class="size-3.5 shrink-0" />
            Vous ne pouvez pas modifier votre propre rôle.
          </p>
          <p
            v-else-if="roleChanged && form.role === 'admin'"
            class="mt-1 flex items-start gap-1 text-caption text-amber-700"
          >
            <Icon name="ph:warning" class="mt-0.5 size-3.5 shrink-0" />
            Attention : le rôle Administrateur donne un accès complet à la plateforme.
          </p>
          <p
            v-else-if="roleChanged && selected.role === 'rider'"
            class="mt-1 flex items-start gap-1 text-caption text-amber-700"
          >
            <Icon name="ph:warning" class="mt-0.5 size-3.5 shrink-0" />
            Ce compte ne sera plus livreur : sa candidature ne pourra plus être validée depuis
            « Candidatures livreurs ».
          </p>
        </div>

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
            :disabled="saving || !canSave"
            class="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary-600 py-2.5 text-body-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-40"
            @click="save"
          >
            <Icon v-if="saving" name="ph:circle-notch" class="size-4 animate-spin" />
            <Icon v-else name="ph:floppy-disk" class="size-4" />
            {{ saving ? 'Enregistrement...' : 'Enregistrer' }}
          </button>
          <button
            class="rounded-xl border border-neutral-200 px-5 py-2.5 text-body-sm font-medium text-text-secondary transition hover:bg-neutral-50"
            @click="closeModal"
          >
            Annuler
          </button>
        </div>
      </template>
    </UiModal>
  </div>
</template>
