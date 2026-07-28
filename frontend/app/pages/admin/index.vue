<script setup lang="ts">
definePageMeta({
  layout: "admin",
  middleware: ["auth", "role"],
  role: "admin",
});

useHead({ title: "Dashboard Admin — EzTech" });

const { adminFetch, fmtMoney } = useAdminApi()
const auth = useAuthStore()

// ── Live stats from real API ─────────────────────────────────────────────────
const orders = ref<
  {
    status: string;
    paymentStatus: string;
    total: string | number;
    createdAt: string;
  }[]
>([]);
const loadingStats = ref(true);
// Une erreur avalée affichait « 0 commande / 0 € », impossible à distinguer d'un système
// réellement vide. On la remonte pour que 401/403/500 soient visibles, avec un « Réessayer ».
const statsError = ref<string | null>(null);

// Enveloppe inattendue : message dédié. Marqueur explicite plutôt qu'un `e.message` générique,
// sinon l'erreur réseau d'ofetch (« [GET] "…": <no response> Failed to fetch ») remonterait
// telle quelle, en anglais, dans l'interface.
const SHAPE_ERROR = "Réponse inattendue de l'API : « orders » manquant.";

function statsErrorMessage(e: unknown): string {
  const err = e as { data?: { error?: string }; statusCode?: number };
  const code = err?.data?.error;
  if (code === "missing_token" || code === "invalid_token" || err?.statusCode === 401)
    return "Session expirée : reconnectez-vous pour voir les statistiques.";
  if (code === "forbidden" || err?.statusCode === 403)
    return "Accès refusé : ces statistiques sont réservées aux administrateurs.";
  if (e instanceof Error && e.message === SHAPE_ERROR) return SHAPE_ERROR;
  if (err?.statusCode && err.statusCode >= 500)
    return "Le serveur a renvoyé une erreur : les statistiques n'ont pas pu être calculées.";
  return "Impossible de charger les statistiques : le serveur est injoignable.";
}

async function loadStats() {
  loadingStats.value = true;
  statsError.value = null;
  try {
    // /admin/orders, not /orders: in production nginx path-splits /api/orders to the Nuxt BFF,
    // which answers with a bare remapped array (no `orders` key, no paymentStatus, storefront
    // status labels). /api/admin/orders is not split, so it always reaches Express (see
    // backend/src/routes/index.ts). Same endpoint admin/orders.vue uses.
    const data = await adminFetch<{ orders: typeof orders.value }>('/admin/orders')
    // Une enveloppe inattendue (tableau nu du BFF) ne doit pas passer pour « aucune commande ».
    if (!Array.isArray(data?.orders)) throw new Error(SHAPE_ERROR);
    orders.value = data.orders;
  } catch (e) {
    orders.value = [];
    statsError.value = statsErrorMessage(e);
  } finally {
    loadingStats.value = false;
  }
}

onMounted(() => {
  auth.hydrate();
  loadStats();
});

const stats = computed(() => {
  const active = orders.value.filter((o) =>
    [
      "pending_assignment",
      "rider_assigned",
      "picked_up",
      "in_transit",
    ].includes(o.status),
  ).length;

  // Distinct de `active` : le raccourci « Commandes en attente » ouvre
  // /admin/orders?status=pending_assignment, filtre que la page applique désormais réellement.
  // Afficher `active` (4 statuts) sur ce lien promettait un nombre que le tableau filtré
  // (1 seul statut) ne pouvait pas atteindre.
  const pending = orders.value.filter(
    (o) => o.status === "pending_assignment",
  ).length;

  const revenue = orders.value
    .filter((o) => o.paymentStatus === "paid")
    .reduce((s, o) => s + Number(o.total), 0);

  const today = new Date().toDateString();
  const todayOrders = orders.value.filter(
    (o) => new Date(o.createdAt).toDateString() === today,
  ).length;

  const cancelled = orders.value.filter((o) => o.status === "cancelled").length;

  return {
    total: orders.value.length,
    active,
    pending,
    revenue,
    todayOrders,
    delivered: orders.value.filter((o) => o.status === "delivered").length,
    cancelled,
  };
});

// ── Admin navigation sections ─────────────────────────────────────────────────
const navSections = [
  {
    title: "Opérations",
    items: [
      {
        to: "/admin/orders",
        label: "Commandes",
        description:
          "Superviser toutes les commandes, les annuler, voir les timelines",
        icon: "ph:receipt",
        color: "from-primary-500 to-primary-600",
        badge: null as null | (() => number),
      },
      {
        to: "/admin/warehouses",
        label: "Entrepôts",
        description:
          "Créer, modifier, assigner un responsable et suivre le stock",
        icon: "ph:warehouse",
        color: "from-orange-500 to-orange-600",
        badge: null,
      },
      {
        to: "/admin/zones",
        label: "Zones de service",
        description:
          "Tracer et ajuster les polygones de livraison utilisés par le checkout",
        icon: "ph:map-trifold",
        color: "from-indigo-500 to-indigo-600",
        badge: null,
      },
    ],
  },
  {
    title: "Catalogue",
    items: [
      {
        to: "/admin/products",
        label: "Produits",
        description: "Créer, modifier et supprimer les produits du catalogue",
        icon: "ph:package",
        color: "from-emerald-500 to-emerald-600",
        badge: null,
      },
      {
        to: "/admin/categories",
        label: "Catégories",
        description: "Organiser les catégories et sous-catégories",
        icon: "ph:tag",
        color: "from-teal-500 to-teal-600",
        badge: null,
      },
    ],
  },
  {
    title: "Utilisateurs",
    items: [
      {
        to: "/admin/users",
        label: "Utilisateurs",
        description: "Lister, modifier les rôles et gérer les comptes",
        icon: "ph:users",
        color: "from-violet-500 to-violet-600",
        badge: null,
      },
      {
        to: "/admin/riders",
        label: "Candidatures livreurs",
        description: "Approuver ou refuser les dossiers livreurs en attente",
        icon: "ph:motorcycle",
        color: "from-amber-500 to-amber-600",
        badge: null,
      },
    ],
  },
  {
    title: "Analytics",
    items: [
      {
        to: "/admin/analytics",
        label: "Analytics",
        description: "Graphiques de revenus, top produits, temps de livraison",
        icon: "ph:chart-line-up",
        color: "from-sky-500 to-sky-600",
        badge: null,
      },
    ],
  },
];

</script>

<template>
  <div>
    <!-- ═══ Bandeau stats (live) ═══ -->
    <!-- Le titre « Panneau d'administration » vit desormais dans la nav du layout admin. -->
    <div class="relative overflow-hidden rounded-2xl bg-section-dark px-5 py-6 sm:px-8">
      <div
        class="pointer-events-none absolute -right-20 -top-20 size-80 rounded-full bg-primary-500/15 blur-3xl"
      />
      <div
        class="pointer-events-none absolute -bottom-16 -left-16 size-64 rounded-full bg-primary-400/10 blur-2xl"
      />

      <div class="relative">
        <h1 class="mb-4 text-h4 font-semibold text-white">Vue d'ensemble</h1>

        <!-- Bandeau d'erreur : sans lui, un 401/403/500 s'affichait comme « 0 commande / 0 € ». -->
        <div
          v-if="statsError"
          class="mb-4 flex flex-col gap-3 rounded-2xl border border-red-400/30 bg-red-500/15 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <p class="flex items-start gap-2 text-body-sm font-medium text-red-100">
            <Icon name="ph:warning-circle" class="mt-0.5 size-4 shrink-0" />
            {{ statsError }}
          </p>
          <button
            :disabled="loadingStats"
            class="inline-flex shrink-0 items-center gap-2 self-start rounded-xl bg-white/15 px-4 py-2 text-body-sm font-semibold text-white transition hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto"
            @click="loadStats()"
          >
            <Icon name="ph:arrows-clockwise" class="size-4" />
            {{ loadingStats ? "Chargement…" : "Réessayer" }}
          </button>
        </div>

        <!-- Live stat cards -->
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <!-- Total commandes -->
          <div
            class="rounded-2xl border border-white/10 bg-white/8 p-4 backdrop-blur-sm"
          >
            <div class="mb-2 flex items-center justify-between">
              <Icon name="ph:receipt" class="size-5 text-primary-300" />
              <span
                v-if="loadingStats"
                class="h-3 w-10 animate-pulse rounded bg-white/20"
              />
              <!-- « — » et pas 0 : un chiffre faux est pire qu'une absence de chiffre. -->
              <span v-else-if="statsError" class="text-h3 font-bold text-red-200">—</span>
              <span v-else class="text-h3 font-bold text-white">{{
                stats.total
              }}</span>
            </div>
            <p class="text-caption text-neutral-400">Commandes total</p>
          </div>

          <!-- En cours -->
          <div
            class="rounded-2xl border border-white/10 bg-white/8 p-4 backdrop-blur-sm"
          >
            <div class="mb-2 flex items-center justify-between">
              <Icon name="ph:clock" class="size-5 text-amber-300" />
              <span
                v-if="loadingStats"
                class="h-3 w-8 animate-pulse rounded bg-white/20"
              />
              <span v-else-if="statsError" class="text-h3 font-bold text-red-200">—</span>
              <span v-else class="text-h3 font-bold text-white">{{
                stats.active
              }}</span>
            </div>
            <p class="text-caption text-neutral-400">En cours</p>
          </div>

          <!-- Aujourd'hui -->
          <div
            class="rounded-2xl border border-white/10 bg-white/8 p-4 backdrop-blur-sm"
          >
            <div class="mb-2 flex items-center justify-between">
              <Icon name="ph:calendar-check" class="size-5 text-emerald-300" />
              <span
                v-if="loadingStats"
                class="h-3 w-8 animate-pulse rounded bg-white/20"
              />
              <span v-else-if="statsError" class="text-h3 font-bold text-red-200">—</span>
              <span v-else class="text-h3 font-bold text-white">{{
                stats.todayOrders
              }}</span>
            </div>
            <p class="text-caption text-neutral-400">Aujourd'hui</p>
          </div>

          <!-- Revenus -->
          <div
            class="rounded-2xl border border-primary-400/20 bg-primary-500/20 p-4 backdrop-blur-sm"
          >
            <div class="mb-2 flex items-center justify-between">
              <Icon name="ph:wallet" class="size-5 text-primary-300" />
              <span
                v-if="loadingStats"
                class="h-3 w-16 animate-pulse rounded bg-white/20"
              />
              <span v-else-if="statsError" class="text-h3 font-bold text-red-200">—</span>
              <span v-else class="text-h3 font-bold text-white"
                >{{ fmtMoney(stats.revenue) }} €</span
              >
            </div>
            <p class="text-caption text-primary-400">Revenus (payés)</p>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══ Nav sections ═══ -->
    <div class="mt-8 space-y-10">
      <div v-for="section in navSections" :key="section.title">
        <h2
          class="mb-4 text-caption font-bold uppercase tracking-widest text-text-muted"
        >
          {{ section.title }}
        </h2>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <NuxtLink
            v-for="item in section.items"
            :key="item.to"
            :to="item.to"
            class="group relative overflow-hidden rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-md"
          >
            <!-- Gradient accent top-left -->
            <div
              class="pointer-events-none absolute -left-6 -top-6 size-24 rounded-full bg-gradient-to-br opacity-10 blur-2xl transition-opacity group-hover:opacity-20"
              :class="item.color"
            />

            <div class="flex items-start justify-between">
              <!-- Icon -->
              <div
                class="flex size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br shadow-sm"
                :class="item.color"
              >
                <Icon :name="item.icon" class="size-6 text-white" />
              </div>

              <!-- Arrow -->
              <Icon
                name="ph:arrow-right"
                class="size-5 text-neutral-300 transition-all duration-200 group-hover:translate-x-1 group-hover:text-primary-500"
              />
            </div>

            <div class="mt-4">
              <h3 class="text-body font-semibold text-text-primary">
                {{ item.label }}
              </h3>
              <p class="mt-1 text-body-sm leading-relaxed text-text-muted">
                {{ item.description }}
              </p>
            </div>
          </NuxtLink>
        </div>
      </div>

      <!-- Quick actions row -->
      <div class="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 class="mb-4 text-body-sm font-semibold text-text-primary">
          Actions rapides
        </h2>
        <div class="flex flex-wrap gap-3">
          <NuxtLink
            to="/admin/orders?status=pending_assignment"
            class="inline-flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-2.5 text-body-sm font-medium text-amber-700 transition hover:bg-amber-100"
          >
            <Icon name="ph:hourglass" class="size-4" />
            Commandes en attente
            <!-- stats.pending (et pas stats.active) : ce lien filtre sur le seul statut
                 pending_assignment, le badge doit annoncer le nombre de lignes qui s'afficheront. -->
            <span
              v-if="!loadingStats && !statsError"
              class="rounded-full bg-amber-200 px-1.5 py-0.5 text-caption font-bold"
            >
              {{ stats.pending }}
            </span>
          </NuxtLink>

          <NuxtLink
            to="/admin/riders"
            class="inline-flex items-center gap-2 rounded-xl bg-primary-50 px-4 py-2.5 text-body-sm font-medium text-primary-700 transition hover:bg-primary-100"
          >
            <Icon name="ph:motorcycle" class="size-4" />
            Candidatures livreurs
          </NuxtLink>

          <NuxtLink
            to="/admin/analytics"
            class="inline-flex items-center gap-2 rounded-xl bg-sky-50 px-4 py-2.5 text-body-sm font-medium text-sky-700 transition hover:bg-sky-100"
          >
            <Icon name="ph:chart-line-up" class="size-4" />
            Voir les analytics
          </NuxtLink>

          <NuxtLink
            to="/products"
            class="inline-flex items-center gap-2 rounded-xl bg-neutral-50 px-4 py-2.5 text-body-sm font-medium text-neutral-600 transition hover:bg-neutral-100"
          >
            <Icon name="ph:storefront" class="size-4" />
            Voir la boutique
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>
