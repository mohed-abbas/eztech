<script setup lang="ts">
definePageMeta({
  layout: "default",
  middleware: ["auth", "role"],
  role: "admin",
});

useHead({ title: "Dashboard Admin — EzTech" });

const config = useRuntimeConfig();
const auth = useAuthStore();

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

onMounted(async () => {
  auth.hydrate();
  try {
    const data = await $fetch<{ orders: typeof orders.value }>(
      `${config.public.apiUrl}/orders`,
      {
        credentials: "include",
        headers: auth.token ? { Authorization: `Bearer ${auth.token}` } : {},
      },
    );
    orders.value = data.orders;
  } catch {
    /* stats stay at 0 */
  } finally {
    loadingStats.value = false;
  }
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
        to: "/admin/warehouse",
        label: "Entrepôts",
        description:
          "Gérer les entrepôts, affecter des responsables, voir le stock",
        icon: "ph:warehouse",
        color: "from-accent-500 to-accent-600",
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
    title: "Utilisateurs & Zones",
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
      {
        to: "/admin/zones",
        label: "Zones de service",
        description: "Dessiner et gérer les polygones de livraison via Leaflet",
        icon: "ph:map-pin-area",
        color: "from-rose-500 to-rose-600",
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

function fmtMoney(n: number) {
  return n.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
</script>

<template>
  <div class="min-h-screen bg-neutral-50">
    <!-- ═══ Hero ═══ -->
    <div class="relative overflow-hidden bg-section-dark px-6 py-14 sm:px-10">
      <div
        class="pointer-events-none absolute -right-20 -top-20 size-96 rounded-full bg-primary-500/15 blur-3xl"
      />
      <div
        class="pointer-events-none absolute -bottom-16 -left-16 size-80 rounded-full bg-primary-400/10 blur-2xl"
      />
      <div
        class="pointer-events-none absolute left-1/3 top-1/2 size-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-600/8 blur-3xl"
      />

      <div class="relative mx-auto max-w-7xl">
        <div class="flex items-center gap-3 mb-6">
          <div
            class="flex size-12 items-center justify-center rounded-2xl bg-primary-500 shadow-lg shadow-primary-500/30"
          >
            <Icon name="ph:gauge" class="size-6 text-white" />
          </div>
          <div>
            <p
              class="text-caption font-semibold uppercase tracking-widest text-primary-400"
            >
              Panneau d'administration
            </p>
            <h1 class="text-h2 font-bold text-white">Dashboard</h1>
          </div>
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
    <div class="mx-auto max-w-7xl px-6 py-10 sm:px-10 space-y-10">
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
            <span
              v-if="!loadingStats"
              class="rounded-full bg-amber-200 px-1.5 py-0.5 text-caption font-bold"
            >
              {{ stats.active }}
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
