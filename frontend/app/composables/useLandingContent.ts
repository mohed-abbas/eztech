// Landing page content. The marketing copy (features, nav, stats) is static and
// lives here so the page components stay focused on markup. The featured
// products are NOT static: they come from the catalog BFF (/api/products), which
// reads the real Product table through Express.

export interface FeaturedProduct {
  name: string
  type: string
  price: string
  icon1: string
  spec1: string
  icon2: string
  spec2: string
  icon3: string
  spec3: string
  heroIcon: string
  /** Product photo. Optional — ProductCard falls back to `heroIcon` when absent or broken. */
  imageUrl?: string | null
  /** Per-product destination. Optional so the catalog can keep passing `to` explicitly. */
  to?: string
}

/** Shape returned by frontend/server/api/products.ts (the catalog BFF). */
export interface CatalogProduct {
  id: string
  slug?: string
  name: string
  description: string
  categoryId: string
  categorySlug?: string
  categoryName?: string
  categoryIcon?: string
  image?: string
  featured?: boolean
  rating?: number
  price: number
  stock: number
}

const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })

/** Same mapping idiom as app/pages/products/index.vue — rating / stock / delivery as the three specs. */
export function catalogToFeatured(p: CatalogProduct): FeaturedProduct {
  return {
    name: p.name,
    type: p.categoryName ?? 'Tech',
    price: eur.format(Number(p.price) || 0),
    heroIcon: p.categoryIcon ?? 'ph:package',
    imageUrl: p.image ?? null,
    icon1: 'ph:star',
    spec1: p.rating ? `${p.rating}` : '—',
    icon2: 'ph:cube',
    spec2: `${p.stock} dispo`,
    icon3: 'ph:truck',
    spec3: 'Express',
    to: `/products/${p.slug ?? p.id}`,
  }
}

export interface LandingFeature {
  icon: string
  title: string
  desc: string
  bg: string
  hoverBg: string
  iconColor: string
}

export interface NavLink {
  label: string
  href: string
}

export interface StatCard {
  value: string
  title: string
  desc: string
  bg: string
  corner: string
}

export function useLandingContent() {
  // Real catalog data. The relative URL hits the Nuxt BFF, so this resolves during
  // SSR through the internal backend URL (config.apiUrl) — the hero cards are in the
  // first paint, not injected after hydration. The explicit key dedupes the request
  // across the components that call this composable (hero + featured grid).
  const { data: catalog, status: catalogStatus } = useFetch<CatalogProduct[]>('/api/products', {
    key: 'landing-catalog',
    default: () => [],
  })

  const featuredProducts = computed<FeaturedProduct[]>(() =>
    (catalog.value ?? [])
      .filter(p => p.featured)
      .slice(0, 4)
      .map(catalogToFeatured),
  )

  const featuredPending = computed(() => catalogStatus.value === 'pending')

  const features: LandingFeature[] = [
    { icon: 'ph:lightning', title: 'Livraison express', desc: 'Recevez votre équipement en quelques heures. Livraison le jour même dans plus de 40 villes.', bg: 'bg-surface-purple', hoverBg: 'group-hover:bg-primary-100', iconColor: 'text-primary-500' },
    { icon: 'ph:shield-check', title: 'Protection complète', desc: 'Chaque location inclut une assurance tous risques. Aucun frais caché, aucune surprise — juste la tranquillité.', bg: 'bg-surface-violet', hoverBg: 'group-hover:bg-accent-200', iconColor: 'text-accent-500' },
    { icon: 'ph:devices', title: 'Catalogue étendu', desc: 'Plus de 250 appareils haut de gamme : ordinateurs, appareils photo, drones, tablettes — toujours les derniers modèles.', bg: 'bg-surface-lavender', hoverBg: 'group-hover:bg-primary-100', iconColor: 'text-primary-600' },
    { icon: 'ph:arrows-clockwise', title: 'Retours flexibles', desc: 'Prolongez ou retournez votre location sans pénalité. Planifiez la récupération à votre convenance.', bg: 'bg-surface-lilac', hoverBg: 'group-hover:bg-primary-100', iconColor: 'text-primary-700' },
  ]

  const navLinks: NavLink[] = [
    { label: 'Produits', href: '/products' },
    { label: 'Comment ça marche', href: '#how-it-works' },
    { label: 'Tarifs', href: '#pricing' },
  ]

  const statCards: StatCard[] = [
    { value: '250+', title: 'Produits', desc: 'Ordinateurs, appareils photo, drones et plus.', bg: 'bg-surface-purple', corner: 'rounded-tl-feature' },
    { value: '40+', title: 'Villes', desc: 'Livraison le jour même dans les grandes villes.', bg: 'bg-surface-lilac', corner: 'rounded-tr-feature' },
    { value: '10K+', title: 'Utilisateurs', desc: 'Locataires actifs sur la plateforme.', bg: 'bg-surface-lavender', corner: 'rounded-bl-feature' },
    { value: '4.9', title: 'Note', desc: 'Score moyen de satisfaction client.', bg: 'bg-surface-violet', corner: 'rounded-br-feature' },
  ]

  return { featuredProducts, featuredPending, features, navLinks, statCards }
}
