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
  // Prisma sérialise les colonnes Decimal(10,2) en CHAÎNES ("120.5") — vérifié sur
  // GET /api/products/:slug. Les typer `number` mentait sur ce que l'API renvoie ;
  // fmtMoney() fait déjà Number(n), donc l'affichage était juste par accident.
  flatPrice: number | string | null;
  hourlyPrice: number | string | null;
  dailyPrice: number | string | null;
  weeklyPrice: number | string | null;
  stock: number;
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
  stock: "" as string | number,
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
// Flipped by save(): the missing-fields summary must appear on a submit attempt,
// even when the user never focused a single input.
const submitAttempted = ref(false);

function touch(field: string) {
  touched.value = { ...touched.value, [field]: true };
}

// Every field fieldErrors can produce a message for. save() force-touches the lot
// so a straight click on « Créer » surfaces inline errors instead of doing nothing.
const VALIDATED_FIELDS = [
  "name",
  "slug",
  "imageUrl",
  "categoryId",
  "flatPrice",
  "hourlyPrice",
  "dailyPrice",
  "weeklyPrice",
  "tiered",
  "stock",
] as const;

function touchAll() {
  const next: Record<string, boolean> = { ...touched.value };
  for (const f of VALIDATED_FIELDS) next[f] = true;
  touched.value = next;
}

function resetTouched() {
  touched.value = {};
  submitAttempted.value = false;
}

// The three tiered price columns, in display order. Reused by the form, the
// validation rules and the list rendering so they can never drift apart.
const TIERS = [
  { key: "hourlyPrice", label: "Par heure", suffix: "/h" },
  { key: "dailyPrice", label: "Par jour", suffix: "/j" },
  { key: "weeklyPrice", label: "Par semaine", suffix: "/sem" },
] as const;

// A blank price is "not set" (valid, and cleared server-side with null); anything
// else must parse to a finite number >= 0. The backend enforces the same rule with
// z.number().nonnegative() (backend/src/schemas/catalog.ts) but only answers a
// generic 422 validation_failed, so the useful message has to come from here.
function priceError(v: string | number, label: string): string | undefined {
  if (v === "" || v === null) return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) return `${label} : saisissez un montant numérique.`;
  if (n < 0) return `${label} : le prix ne peut pas être négatif.`;
  return undefined;
}

function isFilled(v: string | number) {
  return v !== "" && v !== null;
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

  if (form.pricingType === "flat") {
    if (!isFilled(form.flatPrice))
      e.flatPrice = "Le prix forfaitaire est obligatoire.";
    else {
      const msg = priceError(form.flatPrice, "Prix forfaitaire");
      if (msg) e.flatPrice = msg;
    }
  } else {
    // Per-input errors, so a negative « par jour » is flagged on that very field
    // and not lumped into a single combined message.
    for (const t of TIERS) {
      const msg = priceError(form[t.key], t.label);
      if (msg) e[t.key] = msg;
    }
    // Mirrors CreateProductSchema's superRefine: tiered needs at least one price.
    if (!TIERS.some((t) => isFilled(form[t.key])))
      e.tiered = "Renseignez au moins un tarif (heure, jour ou semaine).";
  }

  // stock is optional but must be a whole, non-negative number (catalog.ts uses
  // z.number().int().nonnegative()).
  if (isFilled(form.stock)) {
    const n = Number(form.stock);
    if (!Number.isFinite(n) || !Number.isInteger(n))
      e.stock = "Le stock doit être un nombre entier.";
    else if (n < 0) e.stock = "Le stock ne peut pas être négatif.";
  }
  return e;
});

// True when the form is ready to submit
const formValid = computed(() => Object.keys(fieldErrors.value).length === 0);

// Show an error only if the field was touched
function err(field: string) {
  return touched.value[field] ? fieldErrors.value[field] : undefined;
}

// A tiered input drives both its own error and the combined "at least one" rule,
// so clearing the last filled tier has to reveal the combined message immediately.
function touchTier(field: string) {
  touched.value = { ...touched.value, [field]: true, tiered: true };
}

// ── Helpers (locaux) ──────────────────────────────────────────────────────────
// NFD + strip combining marks BEFORE dropping non-[a-z0-9-]: without it « Écran 4K »
// lost the accented letter entirely and produced `cran-4k`. Same implementation as
// admin/categories.vue (kept local — a page does not import from another page).
function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
function fmtPrice(p: number | string | null) {
  return p != null ? `${fmtMoney(p)} €` : "—";
}
// A tiered product can carry several prices at once. Showing only the first
// non-null one made a 5 €/h + 30 €/j product read as « 5,00 €/h ».
function priceParts(product: Product): string[] {
  if (product.pricingType === "tiered") {
    const parts = TIERS.filter((t) => product[t.key] != null).map(
      (t) => `${fmtPrice(product[t.key])}${t.suffix}`,
    );
    return parts.length ? parts : ["—"];
  }
  return [fmtPrice(product.flatPrice)];
}
function pricingLabel(product: Product) {
  return product.pricingType === "tiered" ? "Paliers" : "Forfait";
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
    stock: p.stock ?? "",
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
const FIELD_LABELS: Record<string, string> = {
  name: "Nom",
  slug: "Slug",
  description: "Description",
  imageUrl: "URL de l'image",
  categoryId: "Catégorie",
  brandId: "Marque",
  pricingType: "Type de tarification",
  flatPrice: "Prix forfaitaire",
  hourlyPrice: "Prix par heure",
  dailyPrice: "Prix par jour",
  weeklyPrice: "Prix par semaine",
  stock: "Stock",
};

// Zod issue messages are English ("Too small: expected number to be >=0"), which is
// not shippable copy. Map the codes the catalog schema can actually raise; anything
// unmapped falls back to a generic French sentence rather than leaking English.
function issueFr(code: string | undefined): string {
  const map: Record<string, string> = {
    too_small: "valeur trop petite (minimum attendu non respecté).",
    too_big: "valeur trop grande.",
    invalid_type: "type de valeur incorrect.",
    invalid_format: "format incorrect.",
    invalid_string: "format incorrect.",
    not_multiple_of: "la valeur doit être un nombre entier.",
    custom: "valeur refusée par le serveur.",
  };
  return (code && map[code]) ?? "valeur invalide.";
}

function apiMessage(e: unknown, fallback: string) {
  type Issue = { message?: string; code?: string; path?: (string | number)[] };
  const apiErr = e as {
    data?: {
      error?: string;
      issues?: Issue[];
      details?: { issues?: Issue[] };
    };
    message?: string;
  };
  const code = apiErr?.data?.error;
  // A route-level 422 answers { error, details: { issues } } while a bare ZodError
  // answers { error, issues } (backend/src/middleware/error.ts) — verified live:
  // PATCH weeklyPrice:-5 → 422 {"error":"validation_failed","details":{"issues":[…]}}.
  // Reading only data.issues fell through to the generic "Données invalides.".
  const issues = apiErr?.data?.details?.issues ?? apiErr?.data?.issues;
  // Translate each issue rather than echoing Zod's English text, and name the
  // offending field in French so the admin knows which input to fix.
  const issueText = issues
    ?.map((i) => {
      const field = i.path?.filter((p) => typeof p === "string").join(".");
      const what = issueFr(i.code);
      return field ? `${FIELD_LABELS[field] ?? field} : ${what}` : what;
    })
    .filter(Boolean)
    .join(" · ");
  const errorMap: Record<string, string> = {
    slug_taken: "Ce slug est déjà utilisé par un autre produit.",
    invalid_relation: "La catégorie ou la marque sélectionnée est invalide.",
    validation_failed: issueText
      ? `Données invalides — ${issueText}`
      : "Données invalides.",
    missing_token: "Session expirée, veuillez vous reconnecter.",
    forbidden: "Action non autorisée.",
    product_not_found: "Ce produit n'existe plus.",
  };
  return (code && errorMap[code]) ?? apiErr?.message ?? fallback;
}

// ── Save (create / update) ────────────────────────────────────────────────────
async function save() {
  // Reveal every remaining error even if the user focused nothing: the button is
  // no longer disabled on !formValid, so a click on an empty form must produce
  // visible inline feedback rather than doing nothing at all.
  submitAttempted.value = true;
  touchAll();
  if (!formValid.value) return;

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
    // Number('abc') is NaN and JSON.stringify turns NaN into null, so a mistyped
    // price used to be sent as "clear this price" without a word to the user.
    // Send a finite number, send null to clear, and otherwise omit the key.
    const setPrice = (key: string, v: string | number) => {
      if (!isFilled(v)) {
        body[key] = null;
        return;
      }
      const n = Number(v);
      if (Number.isFinite(n)) body[key] = n;
    };
    // only send prices relevant to pricingType — and on edit, explicitly clear the
    // other family, otherwise a flat→tiered switch leaves the old flatPrice in the
    // row and sortPrice (recomputed server-side from the merged prices,
    // backend/src/routes/products.ts) keeps ordering the product by a dead value.
    if (form.pricingType === "flat") {
      setPrice("flatPrice", form.flatPrice);
      if (editingProduct.value)
        for (const t of TIERS) body[t.key] = null;
    } else {
      for (const t of TIERS) setPrice(t.key, form[t.key]);
      if (editingProduct.value) body.flatPrice = null;
    }
    // stock is optional (z.number().int().nonnegative()); an empty field must not
    // overwrite the stored quantity, so the key is omitted entirely.
    if (isFilled(form.stock)) {
      const s = Number(form.stock);
      if (Number.isInteger(s) && s >= 0) body.stock = s;
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
          >
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
          >
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
            >
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
              <!-- Un produit « paliers » peut porter plusieurs tarifs : on les
                   affiche tous, sinon 5 €/h + 30 €/j se lisait « 5,00 €/h ». -->
              <div class="shrink-0 text-right">
                <p
                  v-for="part in priceParts(p)"
                  :key="part"
                  class="text-body-sm font-bold leading-tight text-primary-600"
                >
                  {{ part }}
                </p>
              </div>
            </div>

            <p class="flex flex-wrap items-center gap-1.5 text-caption text-text-muted">
              <span
                class="rounded-full px-2 py-0.5 text-caption font-semibold"
                :class="
                  p.pricingType === 'tiered'
                    ? 'bg-primary-50 text-primary-700'
                    : 'bg-neutral-100 text-text-secondary'
                "
              >
                {{ pricingLabel(p) }}
              </span>
              <span>{{ p.category?.name ?? "—" }}</span>
              <span v-if="p.brand">· {{ p.brand.name }}</span>
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
          >
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
          >
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
          >
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
            >
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
              >
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
            @input="touch('flatPrice')"
          >
          <p v-if="err('flatPrice')" class="mt-1 flex items-center gap-1 text-caption text-error">
            <Icon name="ph:warning-circle" class="size-3.5 shrink-0" />
            {{ err('flatPrice') }}
          </p>
        </div>
        <div v-else class="space-y-2">
          <div class="grid grid-cols-3 gap-3">
            <!-- Les trois paliers partagent la même définition (TIERS), donc la
                 validation par champ et l'affichage en liste ne peuvent pas diverger. -->
            <div v-for="t in TIERS" :key="t.key">
              <label class="mb-1.5 block text-caption font-medium text-text-muted">
                {{ t.label }} (€)
              </label>
              <input
                v-model="form[t.key]"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                class="w-full rounded-xl border px-3 py-2 text-body-sm focus:outline-none focus:ring-2"
                :class="err(t.key)
                  ? 'border-error/60 bg-error/5 focus:border-error focus:ring-error/20'
                  : 'border-neutral-200 focus:border-primary-400 focus:ring-primary-100'"
                @blur="touchTier(t.key)"
                @input="touchTier(t.key)"
                @change="touchTier(t.key)"
              >
              <p
                v-if="err(t.key)"
                class="mt-1 flex items-center gap-1 text-caption text-error"
              >
                <Icon name="ph:warning-circle" class="size-3.5 shrink-0" />
                {{ err(t.key) }}
              </p>
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

        <!-- Stock -->
        <div>
          <label class="mb-1.5 block text-body-sm font-medium text-text-primary">
            Stock disponible
          </label>
          <input
            v-model="form.stock"
            type="number"
            min="0"
            step="1"
            placeholder="0"
            class="w-full rounded-xl border px-4 py-2.5 text-body-sm focus:outline-none focus:ring-2"
            :class="err('stock')
              ? 'border-error/60 bg-error/5 focus:border-error focus:ring-error/20'
              : 'border-neutral-200 focus:border-primary-400 focus:ring-primary-100'"
            @blur="touch('stock')"
            @input="touch('stock')"
          >
          <p v-if="err('stock')" class="mt-1 flex items-center gap-1 text-caption text-error">
            <Icon name="ph:warning-circle" class="size-3.5 shrink-0" />
            {{ err('stock') }}
          </p>
          <p v-else class="mt-1 text-caption text-text-muted">
            Quantité totale ; laisser vide pour ne pas modifier le stock actuel.
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
          v-if="!formValid && submitAttempted"
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
          <!-- Volontairement PAS désactivé sur !formValid : un bouton inerte
               n'expliquait rien. Le clic déclenche save(), qui marque tous les
               champs comme visités et affiche les erreurs avant tout appel API. -->
          <button
            :disabled="saving"
            class="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary-600 py-2.5 text-body-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-40"
            :class="{ 'opacity-70': !formValid && submitAttempted }"
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
