<script setup lang="ts">
definePageMeta({
  layout: "admin",
  middleware: ["auth", "role"],
  role: "admin",
});

useHead({ title: "Produits — Admin EzTech" });

const { adminFetch, fmtMoney } = useAdminApi();
const auth = useAuthStore();

// ── Types ────────────────────────────────────────────────────────────────────
interface Category {
  id: string;
  name: string;
  slug: string;
}
interface Brand {
  id: string;
  name: string;
  slug: string;
}
interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  pricingType: string;
  flatPrice: number | null;
  hourlyPrice: number | null;
  dailyPrice: number | null;
  weeklyPrice: number | null;
  isActive: boolean;
  featured: boolean;
  categoryId: string | null;
  brandId: string | null;
  category: Category | null;
  brand: Brand | null;
  createdAt: string;
}

// ── State ────────────────────────────────────────────────────────────────────
const products = ref<Product[]>([]);
const categories = ref<Category[]>([]);
const brands = ref<Brand[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const searchQuery = ref("");
const categoryFilter = ref("all");
// Inactive (soft-deleted) products are fetched but hidden until the admin asks for them
const showInactive = ref(false);
const saving = ref(false);
const saveError = ref<string | null>(null);
// id of the product whose activation is being toggled, + inline error banner
const toggling = ref<string | null>(null);
const rowError = ref<string | null>(null);

// Modal
const showModal = ref(false);
const editingProduct = ref<Product | null>(null);

// Form
const emptyForm = () => ({
  name: "",
  slug: "",
  description: "",
  imageUrl: "",
  pricingType: "flat" as string,
  flatPrice: "" as string | number,
  hourlyPrice: "" as string | number,
  dailyPrice: "" as string | number,
  weeklyPrice: "" as string | number,
  categoryId: "",
  brandId: "",
  featured: false,
  isActive: true,
});
const form = reactive(emptyForm());

// ── Validation ────────────────────────────────────────────────────────────────
// Track which fields the user has interacted with (blur), so errors only
// appear after the user has had a chance to fill a field.
const touched = ref<Record<string, boolean>>({});

function touch(field: string) {
  touched.value = { ...touched.value, [field]: true };
}

function resetTouched() {
  touched.value = {};
}

// Derived field errors — only shown when the field has been touched
const fieldErrors = computed(() => {
  const e: Record<string, string> = {};
  if (!form.name.trim()) e.name = "Le nom est obligatoire.";
  if (!form.slug.trim()) e.slug = "Le slug est obligatoire.";
  else if (!/^[a-z0-9-]+$/.test(form.slug.trim()))
    e.slug = "Uniquement des lettres minuscules, chiffres et tirets.";
  if (!form.imageUrl.trim()) e.imageUrl = "L'URL de l'image est obligatoire.";
  // categoryId is required by the API (CreateProductSchema) and the storefront
  // filters key off category.slug — a product without one is unreachable.
  if (!form.categoryId) e.categoryId = "La catégorie est obligatoire.";
  if (form.pricingType === "flat" && (form.flatPrice === "" || form.flatPrice === null))
    e.flatPrice = "Le prix forfaitaire est obligatoire.";
  if (
    form.pricingType === "tiered" &&
    form.hourlyPrice === "" &&
    form.dailyPrice === "" &&
    form.weeklyPrice === ""
  )
    e.tiered = "Renseignez au moins un tarif (heure, jour ou semaine).";
  return e;
});

// True when the form is ready to submit
const formValid = computed(() => Object.keys(fieldErrors.value).length === 0);

// Show an error only if the field was touched
function err(field: string) {
  return touched.value[field] ? fieldErrors.value[field] : undefined;
}

// ── Helpers (locaux) ──────────────────────────────────────────────────────────
function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-");
}
function fmtPrice(p: number | null) {
  return p != null ? `${fmtMoney(p)} €` : "—";
}
function displayPrice(product: Product) {
  if (product.flatPrice != null) return fmtPrice(product.flatPrice);
  if (product.hourlyPrice != null) return `${fmtPrice(product.hourlyPrice)}/h`;
  if (product.dailyPrice != null) return `${fmtPrice(product.dailyPrice)}/j`;
  if (product.weeklyPrice != null)
    return `${fmtPrice(product.weeklyPrice)}/sem`;
  return "—";
}

// ── Response-shape guards ─────────────────────────────────────────────────────
// In production nginx path-splits /api/products to the Nuxt BFF (server/api/products.ts), which
// answers with a storefront-shaped FLAT ARRAY, drops every query param and has no write handler.
// Reading `.products` off that gave `undefined`, which the next render turned into a blank page
// (`undefined.filter`) with nothing thrown for the try/catch to catch. The admin API is therefore
// called on /admin/products (Express, unshadowed) and the envelope is validated before use, so a
// wrong shape becomes a visible error instead of a silent blank screen.
function unwrapList<T>(data: unknown, key: string): T[] {
  const list = (data as Record<string, unknown> | null | undefined)?.[key];
  if (!Array.isArray(list))
    throw new Error(`Réponse inattendue de l'API : « ${key} » manquant.`);
  return list as T[];
}

function unwrapProduct(data: unknown): Product {
  const product = (data as { product?: Product } | null | undefined)?.product;
  if (!product || typeof product.id !== "string")
    throw new Error("Réponse inattendue de l'API : produit manquant.");
  return product;
}

// ── Fetch ─────────────────────────────────────────────────────────────────────
async function fetchAll() {
  auth.hydrate();
  loading.value = true;
  error.value = null;
  try {
    const [pData, cData, bData] = await Promise.all([
      adminFetch<unknown>("/admin/products?pageSize=100&includeInactive=true"),
      adminFetch<unknown>("/categories"),
      adminFetch<unknown>("/brands"),
    ]);
    products.value = unwrapList<Product>(pData, "products");
    categories.value = unwrapList<Category>(cData, "categories");
    brands.value = unwrapList<Brand>(bData, "brands");
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Erreur de chargement";
  } finally {
    loading.value = false;
  }
}

onMounted(fetchAll);

// ── Filters ───────────────────────────────────────────────────────────────────
const inactiveCount = computed(
  () => products.value.filter((p) => !p.isActive).length,
);

const filtered = computed(() => {
  let list = products.value;
  if (!showInactive.value) list = list.filter((p) => p.isActive);
  if (categoryFilter.value !== "all")
    list = list.filter((p) => p.categoryId === categoryFilter.value);
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase();
    list = list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q),
    );
  }
  return list;
});

// ── Modal ────────────────────────────────────────────────────────────────────
function openCreate() {
  editingProduct.value = null;
  Object.assign(form, emptyForm());
  saveError.value = null;
  resetTouched();
  showModal.value = true;
}

function openEdit(p: Product) {
  editingProduct.value = p;
  Object.assign(form, {
    name: p.name,
    slug: p.slug,
    description: p.description ?? "",
    imageUrl: p.imageUrl ?? "",
    pricingType: p.pricingType,
    flatPrice: p.flatPrice ?? "",
    hourlyPrice: p.hourlyPrice ?? "",
    dailyPrice: p.dailyPrice ?? "",
    weeklyPrice: p.weeklyPrice ?? "",
    categoryId: p.categoryId ?? "",
    brandId: p.brandId ?? "",
    featured: p.featured,
    isActive: p.isActive,
  });
  saveError.value = null;
  resetTouched();
  showModal.value = true;
}

function closeModal() {
  showModal.value = false;
  editingProduct.value = null;
  saveError.value = null;
  resetTouched();
}

watch(
  () => form.name,
  (v) => {
    if (!editingProduct.value) form.slug = slugify(v);
  },
);

// ── API error → French message ────────────────────────────────────────────────
function apiMessage(e: unknown, fallback: string) {
  const apiErr = e as {
    data?: { error?: string; issues?: { message: string }[] };
    message?: string;
  };
  const code = apiErr?.data?.error;
  const errorMap: Record<string, string> = {
    slug_taken: "Ce slug est déjà utilisé par un autre produit.",
    invalid_relation: "La catégorie ou la marque sélectionnée est invalide.",
    validation_failed:
      apiErr?.data?.issues?.map((i) => i.message).join(" · ") ??
      "Données invalides.",
    missing_token: "Session expirée, veuillez vous reconnecter.",
    forbidden: "Action non autorisée.",
    product_not_found: "Ce produit n'existe plus.",
  };
  return (code && errorMap[code]) ?? apiErr?.message ?? fallback;
}

// ── Save (create / update) ────────────────────────────────────────────────────
async function save() {
  saving.value = true;
  saveError.value = null;
  try {
    const description = form.description.trim();
    const imageUrl = form.imageUrl.trim();
    // The API rejects null for description/imageUrl (z.string().optional()) and
    // requires a uuid for categoryId — so never send a null category, and omit
    // the optionals when empty. brandId IS nullable, so null is fine there.
    const body: Record<string, unknown> = {
      name: form.name.trim(),
      slug: form.slug.trim(),
      pricingType: form.pricingType,
      categoryId: form.categoryId,
      brandId: form.brandId || null,
      featured: form.featured,
      isActive: form.isActive,
    };
    // On edit, send an empty string to actually clear a value the product
    // still has; on create, just leave the field out.
    if (description) body.description = description;
    else if (editingProduct.value?.description) body.description = "";
    if (imageUrl) body.imageUrl = imageUrl;
    else if (editingProduct.value?.imageUrl) body.imageUrl = "";
    // only send prices relevant to pricingType
    if (form.pricingType === "flat") {
      body.flatPrice = form.flatPrice !== "" ? Number(form.flatPrice) : null;
    } else {
      body.hourlyPrice =
        form.hourlyPrice !== "" ? Number(form.hourlyPrice) : null;
      body.dailyPrice = form.dailyPrice !== "" ? Number(form.dailyPrice) : null;
      body.weeklyPrice =
        form.weeklyPrice !== "" ? Number(form.weeklyPrice) : null;
    }

    if (editingProduct.value) {
      const data = await adminFetch<unknown>(
        `/admin/products/${editingProduct.value.id}`,
        { method: "PATCH", body },
      );
      const updated = unwrapProduct(data);
      const idx = products.value.findIndex(
        (p) => p.id === editingProduct.value!.id,
      );
      if (idx !== -1) products.value[idx] = updated;
    } else {
      const data = await adminFetch<unknown>("/admin/products", {
        method: "POST",
        body,
      });
      products.value.unshift(unwrapProduct(data));
    }
    closeModal();
  } catch (e: unknown) {
    saveError.value = apiMessage(e, "Erreur lors de la sauvegarde.");
  } finally {
    saving.value = false;
  }
}

// ── Activation toggle (soft delete / restore) ─────────────────────────────────
// PATCH is used rather than DELETE because it returns the updated product,
// while DELETE answers 204 with no body. Deactivated products stay in the list.
async function setActive(p: Product, isActive: boolean) {
  if (
    !isActive
    && !confirm(`Désactiver « ${p.name} » ? Le produit sera masqué du catalogue.`)
  )
    return;
  toggling.value = p.id;
  rowError.value = null;
  try {
    const data = await adminFetch<unknown>(`/admin/products/${p.id}`, {
      method: "PATCH",
      body: { isActive },
    });
    const updated = unwrapProduct(data);
    const idx = products.value.findIndex((x) => x.id === p.id);
    if (idx !== -1) products.value[idx] = updated;
    // keep the row on screen so the admin sees the result of their action
    if (!isActive) showInactive.value = true;
  } catch (e) {
    rowError.value = apiMessage(
      e,
      isActive
        ? "Impossible de réactiver ce produit."
        : "Impossible de désactiver ce produit.",
    );
  } finally {
    toggling.value = null;
  }
}
</script>

<template>
  <div class="min-h-screen bg-neutral-50">
    <!-- ═══ Header ═══ -->
    <div class="relative overflow-hidden bg-section-dark px-6 py-12 sm:px-10">
      <div
        class="pointer-events-none absolute -right-20 -top-20 size-80 rounded-full bg-emerald-500/15 blur-3xl"
      />
      <div
        class="pointer-events-none absolute -bottom-10 -left-10 size-64 rounded-full bg-primary-400/10 blur-2xl"
      />

      <div class="relative mx-auto max-w-7xl">
        <NuxtLink
          to="/admin"
          class="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-body-sm font-medium text-neutral-300 backdrop-blur-sm transition hover:bg-white/15 hover:text-white"
        >
          <Icon name="ph:arrow-left" class="size-4" /> Admin
        </NuxtLink>

        <div
          class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
        >
          <div>
            <h1 class="text-h1 font-semibold text-white">Produits</h1>
            <p class="mt-1 text-body text-neutral-400">
              {{ products.length - inactiveCount }} produit{{
                products.length - inactiveCount !== 1 ? "s" : ""
              }}
              actif{{ products.length - inactiveCount !== 1 ? "s" : "" }} dans
              le catalogue
              <span v-if="inactiveCount">
                · {{ inactiveCount }} inactif{{ inactiveCount !== 1 ? "s" : "" }}
              </span>
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
          <Icon
            name="ph:magnifying-glass"
            class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400"
          />
          <input
            v-model="searchQuery"
            type="search"
            placeholder="Rechercher un produit..."
            class="w-full rounded-xl border border-neutral-200 bg-white py-2.5 pl-9 pr-4 text-body-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
        </div>
        <select
          v-model="categoryFilter"
          class="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-body-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
        >
          <option value="all">Toutes les catégories</option>
          <option v-for="c in categories" :key="c.id" :value="c.id">
            {{ c.name }}
          </option>
        </select>
        <label
          class="flex cursor-pointer select-none items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-body-sm font-medium text-text-secondary transition hover:bg-neutral-50"
        >
          <input
            v-model="showInactive"
            type="checkbox"
            class="size-4 rounded border-neutral-300 accent-primary-600"
          />
          Afficher les produits inactifs
          <span
            v-if="inactiveCount"
            class="rounded-full bg-neutral-100 px-2 py-0.5 text-caption font-semibold text-text-muted"
          >
            {{ inactiveCount }}
          </span>
        </label>
        <button
          class="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-body-sm font-medium text-text-secondary transition hover:bg-neutral-50"
          @click="fetchAll"
        >
          <Icon name="ph:arrows-clockwise" class="size-4" /> Actualiser
        </button>
      </div>

      <!-- Row-level action error -->
      <div
        v-if="rowError"
        class="mb-6 flex items-start gap-2 rounded-xl border border-error/20 bg-error/10 px-4 py-3 text-body-sm text-error"
      >
        <Icon name="ph:warning-circle" class="mt-0.5 size-4 shrink-0" />
        <span class="flex-1">{{ rowError }}</span>
        <button class="shrink-0 font-medium underline" @click="rowError = null">
          Fermer
        </button>
      </div>

      <!-- Loading -->
      <div
        v-if="loading"
        class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        <div
          v-for="i in 6"
          :key="i"
          class="h-40 animate-pulse rounded-2xl bg-white"
        />
      </div>

      <!-- Error -->
      <div
        v-else-if="error"
        class="rounded-2xl border border-error/20 bg-error/5 p-8 text-center"
      >
        <Icon
          name="ph:warning-circle"
          class="mx-auto mb-3 size-10 text-error"
        />
        <p class="text-body font-medium text-error">{{ error }}</p>
        <button
          class="mt-4 rounded-xl bg-primary-600 px-5 py-2 text-body-sm font-medium text-white transition hover:bg-primary-700"
          @click="fetchAll"
        >
          Réessayer
        </button>
      </div>

      <!-- Empty -->
      <EmptyState
        v-else-if="filtered.length === 0"
        title="Aucun produit"
        description="Aucun produit ne correspond à vos filtres."
      >
        <template #icon
          ><Icon name="ph:package" class="size-10 text-emerald-500"
        /></template>
        <template #actions>
          <button
            class="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-body-sm font-semibold text-white transition hover:bg-emerald-600"
            @click="openCreate"
          >
            <Icon name="ph:plus" class="size-4" /> Créer un produit
          </button>
        </template>
      </EmptyState>

      <!-- Grid -->
      <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="p in filtered"
          :key="p.id"
          class="group overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-md"
          :class="
            p.isActive
              ? 'border-neutral-200 hover:border-primary-200'
              : 'border-dashed border-neutral-300 opacity-75'
          "
        >
          <!-- Image -->
          <div class="relative h-40 overflow-hidden bg-neutral-100">
            <img
              v-if="p.imageUrl"
              :src="p.imageUrl"
              :alt="p.name"
              class="size-full object-cover transition duration-300 group-hover:scale-105"
              :class="{ 'grayscale': !p.isActive }"
            />
            <div v-else class="flex size-full items-center justify-center">
              <Icon name="ph:image" class="size-10 text-neutral-300" />
            </div>
            <!-- Badges -->
            <div class="absolute left-3 top-3 flex gap-1.5">
              <span
                v-if="p.featured"
                class="rounded-full bg-amber-500 px-2 py-0.5 text-caption font-bold text-white"
              >
                ★ Vedette
              </span>
              <span
                v-if="!p.isActive"
                class="inline-flex items-center gap-1 rounded-full bg-neutral-700 px-2 py-0.5 text-caption font-bold text-white"
              >
                <Icon name="ph:eye-slash" class="size-3" /> Inactif
              </span>
            </div>
          </div>

          <!-- Body -->
          <div class="p-4">
            <div class="mb-1 flex items-start justify-between gap-2">
              <p
                class="text-body-sm font-semibold text-text-primary leading-tight"
              >
                {{ p.name }}
              </p>
              <p class="shrink-0 text-body-sm font-bold text-primary-600">
                {{ displayPrice(p) }}
              </p>
            </div>

            <p class="text-caption text-text-muted">
              {{ p.category?.name ?? "—" }}
              <span v-if="p.brand"> · {{ p.brand.name }}</span>
            </p>

            <p
              v-if="p.description"
              class="mt-2 line-clamp-2 text-caption text-text-muted"
            >
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
                v-if="p.isActive"
                :disabled="toggling === p.id"
                title="Désactiver"
                aria-label="Désactiver"
                class="flex size-9 items-center justify-center rounded-xl border border-neutral-200 text-neutral-400 transition hover:border-error/30 hover:bg-error/5 hover:text-error disabled:opacity-40"
                @click="setActive(p, false)"
              >
                <Icon
                  v-if="toggling !== p.id"
                  name="ph:eye-slash"
                  class="size-4"
                />
                <Icon
                  v-else
                  name="ph:circle-notch"
                  class="size-4 animate-spin"
                />
              </button>
              <button
                v-else
                :disabled="toggling === p.id"
                class="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-body-sm font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-40"
                @click="setActive(p, true)"
              >
                <Icon
                  v-if="toggling !== p.id"
                  name="ph:arrow-counter-clockwise"
                  class="size-4"
                />
                <Icon
                  v-else
                  name="ph:circle-notch"
                  class="size-4 animate-spin"
                />
                Réactiver
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══ Product modal ═══ -->
    <UiModal
      :open="showModal"
      :title="editingProduct ? 'Modifier le produit' : 'Nouveau produit'"
      size="lg"
      @close="closeModal"
    >
      <!-- ── Form body ── -->
      <div class="space-y-5">
        <!-- Name -->
        <div>
          <label class="mb-1.5 flex items-center gap-1 text-body-sm font-medium text-text-primary">
            Nom
            <span class="text-error">*</span>
          </label>
          <input
            v-model="form.name"
            type="text"
            placeholder="Nom du produit"
            class="w-full rounded-xl border px-4 py-2.5 text-body-sm focus:outline-none focus:ring-2"
            :class="err('name')
              ? 'border-error/60 bg-error/5 focus:border-error focus:ring-error/20'
              : 'border-neutral-200 focus:border-primary-400 focus:ring-primary-100'"
            @blur="touch('name')"
          />
          <p v-if="err('name')" class="mt-1 flex items-center gap-1 text-caption text-error">
            <Icon name="ph:warning-circle" class="size-3.5 shrink-0" />
            {{ err('name') }}
          </p>
        </div>

        <!-- Slug -->
        <div>
          <label class="mb-1.5 flex items-center gap-1 text-body-sm font-medium text-text-primary">
            Slug
            <span class="text-error">*</span>
          </label>
          <input
            v-model="form.slug"
            type="text"
            placeholder="mon-produit"
            class="w-full rounded-xl border bg-neutral-50 px-4 py-2.5 font-mono text-body-sm focus:outline-none focus:ring-2"
            :class="err('slug')
              ? 'border-error/60 bg-error/5 focus:border-error focus:ring-error/20'
              : 'border-neutral-200 focus:border-primary-400 focus:ring-primary-100'"
            @blur="touch('slug')"
          />
          <p v-if="err('slug')" class="mt-1 flex items-center gap-1 text-caption text-error">
            <Icon name="ph:warning-circle" class="size-3.5 shrink-0" />
            {{ err('slug') }}
          </p>
          <p v-else class="mt-1 text-caption text-text-muted">
            Généré automatiquement depuis le nom
          </p>
        </div>

        <!-- Description -->
        <div>
          <label class="mb-1.5 block text-body-sm font-medium text-text-primary"
            >Description</label
          >
          <textarea
            v-model="form.description"
            rows="3"
            placeholder="Description du produit..."
            class="w-full resize-none rounded-xl border border-neutral-200 px-4 py-2.5 text-body-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
        </div>

        <!-- Image URL -->
        <div>
          <label class="mb-1.5 flex items-center gap-1 text-body-sm font-medium text-text-primary">
            URL de l'image
            <span class="text-error">*</span>
          </label>
          <input
            v-model="form.imageUrl"
            type="url"
            placeholder="https://..."
            class="w-full rounded-xl border px-4 py-2.5 text-body-sm focus:outline-none focus:ring-2"
            :class="err('imageUrl')
              ? 'border-error/60 bg-error/5 focus:border-error focus:ring-error/20'
              : 'border-neutral-200 focus:border-primary-400 focus:ring-primary-100'"
            @blur="touch('imageUrl')"
          />
          <p v-if="err('imageUrl')" class="mt-1 flex items-center gap-1 text-caption text-error">
            <Icon name="ph:warning-circle" class="size-3.5 shrink-0" />
            {{ err('imageUrl') }}
          </p>
          <!-- Preview -->
          <div
            v-if="form.imageUrl"
            class="mt-2 h-28 w-full overflow-hidden rounded-xl border border-neutral-100 bg-neutral-50"
          >
            <img
              :src="form.imageUrl"
              alt="preview"
              class="size-full object-cover"
            />
          </div>
        </div>

        <!-- Pricing type -->
        <div>
          <label class="mb-1.5 block text-body-sm font-medium text-text-primary"
            >Type de tarification *</label
          >
          <div class="grid grid-cols-2 gap-2">
            <label
              v-for="pt in [
                { v: 'flat', label: 'Forfait' },
                { v: 'tiered', label: 'Paliers (h/j/sem)' },
              ]"
              :key="pt.v"
              class="flex cursor-pointer items-center gap-2 rounded-xl border-2 px-4 py-2.5 text-body-sm font-medium transition"
              :class="
                form.pricingType === pt.v
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-neutral-200 text-text-secondary hover:border-neutral-300'
              "
            >
              <input
                v-model="form.pricingType"
                type="radio"
                :value="pt.v"
                class="sr-only"
              />
              {{ pt.label }}
            </label>
          </div>
        </div>

        <!-- Prices -->
        <div v-if="form.pricingType === 'flat'">
          <label class="mb-1.5 flex items-center gap-1 text-body-sm font-medium text-text-primary">
            Prix forfaitaire (€)
            <span class="text-error">*</span>
          </label>
          <input
            v-model="form.flatPrice"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            class="w-full rounded-xl border px-4 py-2.5 text-body-sm focus:outline-none focus:ring-2"
            :class="err('flatPrice')
              ? 'border-error/60 bg-error/5 focus:border-error focus:ring-error/20'
              : 'border-neutral-200 focus:border-primary-400 focus:ring-primary-100'"
            @blur="touch('flatPrice')"
          />
          <p v-if="err('flatPrice')" class="mt-1 flex items-center gap-1 text-caption text-error">
            <Icon name="ph:warning-circle" class="size-3.5 shrink-0" />
            {{ err('flatPrice') }}
          </p>
        </div>
        <div v-else class="space-y-2">
          <div class="grid grid-cols-3 gap-3">
            <div>
              <label class="mb-1.5 block text-caption font-medium text-text-muted"
                >Par heure (€)</label
              >
              <input
                v-model="form.hourlyPrice"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                class="w-full rounded-xl border border-neutral-200 px-3 py-2 text-body-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                @blur="touch('tiered')"
              />
            </div>
            <div>
              <label class="mb-1.5 block text-caption font-medium text-text-muted"
                >Par jour (€)</label
              >
              <input
                v-model="form.dailyPrice"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                class="w-full rounded-xl border border-neutral-200 px-3 py-2 text-body-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                @blur="touch('tiered')"
              />
            </div>
            <div>
              <label class="mb-1.5 block text-caption font-medium text-text-muted"
                >Par semaine (€)</label
              >
              <input
                v-model="form.weeklyPrice"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                class="w-full rounded-xl border border-neutral-200 px-3 py-2 text-body-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                @blur="touch('tiered')"
              />
            </div>
          </div>
          <!-- At least one tiered price required -->
          <p v-if="err('tiered')" class="flex items-center gap-1 text-caption text-error">
            <Icon name="ph:warning-circle" class="size-3.5 shrink-0" />
            {{ err('tiered') }}
          </p>
          <p v-else class="text-caption text-text-muted">
            <span class="text-error">*</span> Au moins un tarif est obligatoire.
          </p>
        </div>

        <!-- Category + Brand -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label
              class="mb-1.5 flex items-center gap-1 text-body-sm font-medium text-text-primary"
            >
              Catégorie
              <span class="text-error">*</span>
            </label>
            <select
              v-model="form.categoryId"
              class="w-full rounded-xl border px-3 py-2.5 text-body-sm focus:outline-none focus:ring-2"
              :class="err('categoryId')
                ? 'border-error/60 bg-error/5 focus:border-error focus:ring-error/20'
                : 'border-neutral-200 focus:border-primary-400 focus:ring-primary-100'"
              @blur="touch('categoryId')"
              @change="touch('categoryId')"
            >
              <option value="" disabled>Sélectionner une catégorie</option>
              <option v-for="c in categories" :key="c.id" :value="c.id">
                {{ c.name }}
              </option>
            </select>
            <p
              v-if="err('categoryId')"
              class="mt-1 flex items-center gap-1 text-caption text-error"
            >
              <Icon name="ph:warning-circle" class="size-3.5 shrink-0" />
              {{ err('categoryId') }}
            </p>
          </div>
          <div>
            <label
              class="mb-1.5 block text-body-sm font-medium text-text-primary"
              >Marque</label
            >
            <select
              v-model="form.brandId"
              class="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-body-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
            >
              <option value="">Aucune</option>
              <option v-for="b in brands" :key="b.id" :value="b.id">
                {{ b.name }}
              </option>
            </select>
          </div>
        </div>

        <!-- Toggles -->
        <div class="flex flex-col gap-3">
          <label
            class="flex cursor-pointer items-center justify-between rounded-xl border border-neutral-200 px-4 py-3"
          >
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
              <div
                class="absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform"
                :class="form.featured ? 'translate-x-5' : 'translate-x-0.5'"
              />
            </div>
          </label>
          <label
            class="flex cursor-pointer items-center justify-between rounded-xl border border-neutral-200 px-4 py-3"
          >
            <div>
              <p class="text-body-sm font-medium text-text-primary">Actif</p>
              <p class="text-caption text-text-muted">
                Visible dans le catalogue
              </p>
            </div>
            <div
              class="relative h-6 w-11 rounded-full transition"
              :class="form.isActive ? 'bg-emerald-500' : 'bg-neutral-200'"
              @click="form.isActive = !form.isActive"
            >
              <div
                class="absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform"
                :class="form.isActive ? 'translate-x-5' : 'translate-x-0.5'"
              />
            </div>
          </label>
        </div>

        <!-- Save error -->
        <div
          v-if="saveError"
          class="rounded-xl border border-error/20 bg-error/10 px-4 py-3 text-body-sm text-error"
        >
          {{ saveError }}
        </div>
      </div>

      <!-- ── Footer ── -->
      <template #footer>
        <!-- Résumé des champs manquants si l'utilisateur a tenté de soumettre -->
        <div
          v-if="!formValid && Object.keys(touched).length > 0"
          class="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"
        >
          <p class="mb-1 text-body-sm font-semibold text-amber-700">Champs requis manquants :</p>
          <ul class="list-inside list-disc space-y-0.5">
            <li
              v-for="(msg, field) in fieldErrors"
              :key="field"
              class="text-caption text-amber-700"
            >
              {{ msg }}
            </li>
          </ul>
        </div>

        <div class="flex items-center gap-3">
          <button
            :disabled="saving || !formValid"
            class="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary-600 py-2.5 text-body-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-40"
            :title="!formValid ? 'Remplissez les champs obligatoires' : ''"
            @click="save"
          >
            <Icon
              v-if="saving"
              name="ph:circle-notch"
              class="size-4 animate-spin"
            />
            <Icon v-else name="ph:floppy-disk" class="size-4" />
            {{
              saving
                ? "Sauvegarde..."
                : editingProduct
                  ? "Enregistrer"
                  : "Créer le produit"
            }}
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
