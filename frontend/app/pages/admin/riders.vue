<script setup lang="ts">
definePageMeta({
  layout: 'admin',
  middleware: ['auth', 'role'],
  role: 'admin',
})

useHead({ title: 'Candidatures livreurs — Admin EzTech' })

const { adminFetch } = useAdminApi()
const auth = useAuthStore()
const config = useRuntimeConfig()

// ── Types ────────────────────────────────────────────────────────────────────
type ApplicationStatus = 'pending' | 'approved' | 'rejected'

interface RiderUser {
  id: string
  email: string
  name: string
  phone: string
  role: 'customer' | 'rider' | 'warehouse_manager' | 'admin'
  createdAt: string
  vehicleType?: 'bicycle' | 'scooter' | 'car' | null
  licenseNumber?: string | null
  insuranceNumber?: string | null
  riderApplicationStatus: ApplicationStatus
  riderOnline?: boolean
}

interface RiderDocument {
  id: string
  riderId: string
  type: 'license' | 'insurance'
  fileName: string
  mimeType: string
  sizeBytes: number
  url: string
  status: 'pending' | 'approved' | 'rejected'
  uploadedAt: string
}

const TABS: { value: ApplicationStatus, label: string, icon: string }[] = [
  { value: 'pending', label: 'En attente', icon: 'ph:hourglass' },
  { value: 'approved', label: 'Validées', icon: 'ph:check-circle' },
  { value: 'rejected', label: 'Refusées', icon: 'ph:x-circle' },
]

const STATUS_BADGE: Record<ApplicationStatus, string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
}

const STATUS_LABEL: Record<ApplicationStatus, string> = {
  pending: 'En attente',
  approved: 'Validée',
  rejected: 'Refusée',
}

const VEHICLE_LABEL: Record<string, string> = {
  bicycle: 'Vélo',
  scooter: 'Scooter',
  car: 'Voiture',
}

// le statut d'un document est masculin (« validé »), celui d'une candidature féminin
const DOC_STATUS_LABEL: Record<string, string> = {
  pending: 'En attente',
  approved: 'Validé',
  rejected: 'Refusé',
}

const DOC_LABEL: Record<string, string> = {
  license: 'Permis de conduire',
  insurance: 'Attestation d\'assurance',
}

// ── State ────────────────────────────────────────────────────────────────────
const tab = ref<ApplicationStatus>('pending')
const riders = ref<RiderUser[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

// documents par livreur (chargés à l'ouverture du panneau)
const openRiderId = ref<string | null>(null)
const documents = ref<RiderDocument[]>([])
const docsLoading = ref(false)
const docsError = ref<string | null>(null)
const downloading = ref<string | null>(null)

// action en cours (id du livreur) + retour utilisateur
const acting = ref<string | null>(null)
const actionError = ref<string | null>(null)
const actionSuccess = ref<string | null>(null)

// ── Erreurs API ──────────────────────────────────────────────────────────────
function readApiError(e: unknown, fallback: string): string {
  const err = e as {
    data?: { error?: string, issues?: { message: string }[] }
    statusCode?: number
    message?: string
  }
  const code = err?.data?.error
  const map: Record<string, string> = {
    not_a_rider:
      'Ce compte n\'a plus le rôle « Livreur ». Rétablissez-le depuis « Utilisateurs » avant de traiter la candidature.',
    user_not_found: 'Ce compte n\'existe plus.',
    validation_failed:
      err?.data?.issues?.map(i => i.message).join(' · ') ?? 'Statut invalide.',
    forbidden: 'Accès refusé : votre compte n\'est pas administrateur.',
    missing_token: 'Session expirée, reconnectez-vous.',
    invalid_token: 'Session expirée, reconnectez-vous.',
    not_found: 'Fichier introuvable sur le serveur.',
  }
  if (code && map[code]) return map[code]
  if (err?.statusCode === 404) return 'Ressource introuvable.'
  return err?.message ?? fallback
}

// ── Fetch : file d'attente ───────────────────────────────────────────────────
async function fetchRiders() {
  auth.hydrate()
  loading.value = true
  error.value = null
  openRiderId.value = null
  documents.value = []
  try {
    // NB : le paramètre implémenté côté backend est `applicationStatus`
    // (backend/src/routes/users.ts). `riderApplicationStatus` serait ignoré et
    // renverrait silencieusement TOUS les livreurs.
    const data = await adminFetch<{ users: RiderUser[] }>(
      `/users?role=rider&applicationStatus=${tab.value}`,
    )
    riders.value = data.users
  }
  catch (e: unknown) {
    error.value = readApiError(e, 'Impossible de charger les candidatures.')
  }
  finally {
    loading.value = false
  }
}

onMounted(fetchRiders)
watch(tab, fetchRiders)

// ── Documents ────────────────────────────────────────────────────────────────
async function toggleDocuments(rider: RiderUser) {
  if (openRiderId.value === rider.id) {
    openRiderId.value = null
    return
  }
  openRiderId.value = rider.id
  documents.value = []
  docsError.value = null
  docsLoading.value = true
  try {
    // endpoint admin dédié : GET /api/rider/documents est réservé au livreur lui-même
    const data = await adminFetch<{ documents: RiderDocument[] }>(
      `/users/${rider.id}/rider-documents`,
    )
    documents.value = data.documents
  }
  catch (e: unknown) {
    docsError.value = readApiError(e, 'Impossible de charger les documents.')
  }
  finally {
    docsLoading.value = false
  }
}

// Le fichier est servi à la racine Express (/uploads/...), pas sous /api, et exige
// l'en-tête Authorization : un <a href> classique ne l'enverrait pas. On télécharge
// donc le blob puis on déclenche un clic sur une ancre synthétique.
async function downloadDocument(doc: RiderDocument) {
  downloading.value = doc.id
  docsError.value = null
  let objectUrl: string | null = null
  try {
    const headers: Record<string, string> = {}
    if (auth.token) headers.Authorization = `Bearer ${auth.token}`
    const blob = await $fetch<Blob>(`${config.public.socketUrl}${doc.url}`, {
      credentials: 'include',
      headers,
      responseType: 'blob',
    })
    objectUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = doc.fileName
    document.body.appendChild(a)
    a.click()
    a.remove()
  }
  catch (e: unknown) {
    docsError.value = readApiError(e, 'Téléchargement impossible.')
  }
  finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl)
    downloading.value = null
  }
}

// ── Approuver / refuser ──────────────────────────────────────────────────────
async function review(rider: RiderUser, status: ApplicationStatus) {
  if (status === 'rejected') {
    const ok = confirm(
      `Refuser la candidature de « ${rider.name} » ?\n\n`
      + 'Le livreur sera immédiatement mis hors ligne et ne recevra plus de courses.',
    )
    if (!ok) return
  }

  acting.value = rider.id
  actionError.value = null
  actionSuccess.value = null
  try {
    const data = await adminFetch<{ user: RiderUser }>(
      `/users/${rider.id}/rider-application`,
      { method: 'PATCH', body: { status } },
    )
    // on remplace la ligne par la réponse serveur (riderOnline est forcé à false
    // côté backend sur un refus / retour en attente — ne pas garder l'ancien état)
    const idx = riders.value.findIndex(r => r.id === rider.id)
    if (idx !== -1) riders.value[idx] = data.user
    // la candidature ne fait plus partie de l'onglet courant
    if (data.user.riderApplicationStatus !== tab.value) {
      riders.value = riders.value.filter(r => r.id !== rider.id)
      if (openRiderId.value === rider.id) openRiderId.value = null
    }
    actionSuccess.value
      = status === 'approved'
        ? `Candidature de ${data.user.name} validée.`
        : `Candidature de ${data.user.name} refusée.`
  }
  catch (e: unknown) {
    actionError.value = readApiError(e, 'Action impossible.')
  }
  finally {
    acting.value = null
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

const emptyTitle = computed(() =>
  tab.value === 'pending'
    ? 'Aucune candidature en attente'
    : tab.value === 'approved'
      ? 'Aucun livreur validé'
      : 'Aucune candidature refusée',
)
</script>

<template>
  <!-- le layout `admin` fournit déjà la largeur max, les marges et la navigation -->
  <div class="pb-6">
    <!-- ═══ En-tête ═══ -->
    <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-h2 font-semibold text-text-primary">
          Candidatures livreurs
        </h1>
        <p class="mt-1 text-body-sm text-text-muted">
          {{ riders.length }} candidature{{ riders.length !== 1 ? 's' : '' }} · {{ STATUS_LABEL[tab].toLowerCase() }}
        </p>
      </div>
      <button
        class="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-body-sm font-medium text-text-secondary transition hover:bg-neutral-50 outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
        @click="fetchRiders"
      >
        <Icon name="ph:arrows-clockwise" class="size-4" />
        Actualiser
      </button>
    </div>

    <!-- ═══ Onglets ═══ -->
    <div
      class="mb-5 inline-flex rounded-xl border border-neutral-200 bg-white p-1"
      role="tablist"
    >
      <button
        v-for="t in TABS"
        :key="t.value"
        role="tab"
        :aria-selected="tab === t.value"
        class="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-body-sm font-medium transition outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
        :class="tab === t.value
          ? 'bg-primary-600 text-white shadow-sm'
          : 'text-text-secondary hover:bg-neutral-50'"
        @click="tab = t.value"
      >
        <Icon :name="t.icon" class="size-4" />
        {{ t.label }}
      </button>
    </div>

    <!-- ═══ Retours d'action ═══ -->
    <div
      v-if="actionSuccess"
      class="mb-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-body-sm text-emerald-800"
    >
      <Icon name="ph:check-circle" class="mt-0.5 size-4 shrink-0" />
      <p>{{ actionSuccess }}</p>
    </div>
    <div
      v-if="actionError"
      class="mb-4 flex items-start gap-2 rounded-xl border border-error/20 bg-error/10 px-4 py-3 text-body-sm text-error"
    >
      <Icon name="ph:warning-circle" class="mt-0.5 size-4 shrink-0" />
      <p>{{ actionError }}</p>
    </div>

    <!-- ═══ Chargement ═══ -->
    <div v-if="loading" class="space-y-3">
      <div
        v-for="i in 3"
        :key="i"
        class="h-32 animate-pulse rounded-2xl bg-white"
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
        class="mt-4 rounded-xl bg-primary-600 px-5 py-2 text-body-sm font-medium text-white transition hover:bg-primary-700 outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
        @click="fetchRiders"
      >
        Réessayer
      </button>
    </div>

    <!-- ═══ Vide ═══ -->
    <EmptyState
      v-else-if="riders.length === 0"
      :title="emptyTitle"
      description="Les nouvelles inscriptions livreur apparaîtront ici automatiquement."
    >
      <template #icon>
        <Icon name="ph:motorcycle" class="size-10 text-primary-500" />
      </template>
    </EmptyState>

    <!-- ═══ Liste ═══ -->
    <div v-else class="space-y-4">
      <article
        v-for="r in riders"
        :key="r.id"
        class="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm"
      >
        <div class="p-5">
          <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h2 class="text-body font-semibold text-text-primary">
                  {{ r.name }}
                </h2>
                <span
                  class="rounded-full px-2.5 py-1 text-caption font-semibold"
                  :class="STATUS_BADGE[r.riderApplicationStatus]"
                >
                  {{ STATUS_LABEL[r.riderApplicationStatus] }}
                </span>
                <span
                  v-if="r.riderOnline"
                  class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-caption font-semibold text-emerald-700"
                >
                  <span class="size-1.5 rounded-full bg-emerald-500" />
                  En ligne
                </span>
              </div>
              <p class="mt-1 break-all text-body-sm text-text-muted">
                {{ r.email }}<span v-if="r.phone"> · {{ r.phone }}</span>
              </p>
              <p class="mt-0.5 text-caption text-text-muted">
                Candidature déposée le {{ fmtDate(r.createdAt) }}
              </p>
            </div>

            <!-- Actions -->
            <div class="flex shrink-0 flex-wrap items-center gap-2">
              <button
                v-if="r.riderApplicationStatus !== 'approved'"
                :disabled="acting === r.id"
                class="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-body-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40 outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                @click="review(r, 'approved')"
              >
                <Icon
                  :name="acting === r.id ? 'ph:circle-notch' : 'ph:check'"
                  class="size-4"
                  :class="acting === r.id && 'animate-spin'"
                />
                Approuver
              </button>
              <button
                v-if="r.riderApplicationStatus !== 'rejected'"
                :disabled="acting === r.id"
                class="inline-flex items-center gap-1.5 rounded-xl border border-error/30 px-4 py-2 text-body-sm font-semibold text-error transition hover:bg-error/5 disabled:cursor-not-allowed disabled:opacity-40 outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                @click="review(r, 'rejected')"
              >
                <Icon name="ph:x" class="size-4" />
                Refuser
              </button>
              <button
                v-if="r.riderApplicationStatus === 'rejected'"
                :disabled="acting === r.id"
                class="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 px-4 py-2 text-body-sm font-medium text-text-secondary transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40 outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                @click="review(r, 'pending')"
              >
                <Icon name="ph:arrow-counter-clockwise" class="size-4" />
                Remettre en attente
              </button>
            </div>
          </div>

          <!-- Détails véhicule -->
          <div class="mt-4 grid grid-cols-1 gap-3 rounded-xl bg-neutral-50 p-4 sm:grid-cols-3">
            <div>
              <p class="text-caption font-medium text-text-muted">
                Véhicule
              </p>
              <p class="text-body-sm text-text-primary">
                {{ r.vehicleType ? (VEHICLE_LABEL[r.vehicleType] ?? r.vehicleType) : '—' }}
              </p>
            </div>
            <div>
              <p class="text-caption font-medium text-text-muted">
                N° de permis
              </p>
              <p class="break-all font-mono text-body-sm text-text-primary">
                {{ r.licenseNumber || '—' }}
              </p>
            </div>
            <div>
              <p class="text-caption font-medium text-text-muted">
                N° d'assurance
              </p>
              <p class="break-all font-mono text-body-sm text-text-primary">
                {{ r.insuranceNumber || '—' }}
              </p>
            </div>
          </div>

          <!-- Documents -->
          <button
            class="mt-3 inline-flex items-center gap-1.5 text-body-sm font-medium text-primary-700 transition hover:underline outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            @click="toggleDocuments(r)"
          >
            <Icon
              :name="openRiderId === r.id ? 'ph:caret-up' : 'ph:caret-down'"
              class="size-4"
            />
            {{ openRiderId === r.id ? 'Masquer les documents' : 'Voir les documents' }}
          </button>
        </div>

        <!-- Panneau documents -->
        <div
          v-if="openRiderId === r.id"
          class="border-t border-neutral-100 bg-neutral-50/60 px-5 py-4"
        >
          <div v-if="docsLoading" class="space-y-2">
            <div v-for="i in 2" :key="i" class="h-14 animate-pulse rounded-xl bg-white" />
          </div>

          <div
            v-else-if="docsError"
            class="flex items-start gap-2 rounded-xl border border-error/20 bg-error/10 px-4 py-3 text-body-sm text-error"
          >
            <Icon name="ph:warning-circle" class="mt-0.5 size-4 shrink-0" />
            <p>{{ docsError }}</p>
          </div>

          <p
            v-else-if="documents.length === 0"
            class="flex items-center gap-2 text-body-sm text-text-muted"
          >
            <Icon name="ph:file-dashed" class="size-4" />
            Aucun document transmis par ce candidat.
          </p>

          <ul v-else class="space-y-2">
            <li
              v-for="d in documents"
              :key="d.id"
              class="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div class="flex min-w-0 items-center gap-3">
                <div class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-50">
                  <Icon name="ph:file-text" class="size-5 text-primary-600" />
                </div>
                <div class="min-w-0">
                  <p class="text-body-sm font-semibold text-text-primary">
                    {{ DOC_LABEL[d.type] ?? d.type }}
                    <span
                      class="ml-1 rounded-full px-2 py-0.5 text-caption font-semibold"
                      :class="STATUS_BADGE[d.status]"
                    >
                      {{ DOC_STATUS_LABEL[d.status] ?? d.status }}
                    </span>
                  </p>
                  <p class="truncate text-caption text-text-muted">
                    {{ d.fileName }} · {{ d.mimeType }} · {{ fmtSize(d.sizeBytes) }}
                  </p>
                  <p class="text-caption text-text-muted">
                    Transmis le {{ fmtDate(d.uploadedAt) }}
                  </p>
                </div>
              </div>
              <button
                :disabled="downloading === d.id"
                class="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-neutral-200 px-4 py-2 text-body-sm font-medium text-text-secondary transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40 outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                @click="downloadDocument(d)"
              >
                <Icon
                  :name="downloading === d.id ? 'ph:circle-notch' : 'ph:download-simple'"
                  class="size-4"
                  :class="downloading === d.id && 'animate-spin'"
                />
                Télécharger
              </button>
            </li>
          </ul>
        </div>
      </article>
    </div>
  </div>
</template>
