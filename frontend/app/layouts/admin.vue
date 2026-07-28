<script setup lang="ts">
// Navigation admin — n'expose que des pages qui existent réellement.
// /admin/warehouse (entrepôts) revient en J2 une fois l'API entrepôts d'Ilia prête,
// /admin/zones (zones de service) en J4.
const links = [
  { to: '/admin', label: 'Tableau de bord', icon: 'ph:gauge', exact: true },
  { to: '/admin/orders', label: 'Commandes', icon: 'ph:receipt' },
  { to: '/admin/products', label: 'Produits', icon: 'ph:package' },
  { to: '/admin/categories', label: 'Catégories', icon: 'ph:tag' },
  { to: '/admin/users', label: 'Utilisateurs', icon: 'ph:users' },
  { to: '/admin/riders', label: 'Candidatures livreurs', icon: 'ph:motorcycle' },
  { to: '/admin/analytics', label: 'Analytics', icon: 'ph:chart-line-up' },
]

const route = useRoute()

// `active-class` de NuxtLink marquerait « Tableau de bord » actif sur toutes les
// sous-pages /admin/*, on calcule donc l'état actif nous-mêmes.
function isActive(link: { to: string, exact?: boolean }): boolean {
  return link.exact ? route.path === link.to : route.path.startsWith(link.to)
}

const baseItem
  = 'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-body-sm font-medium transition-colors'
const activeItem = 'bg-primary-50 text-primary-700'
const idleItem = 'text-text-muted hover:bg-neutral-100 hover:text-text-primary'
</script>

<template>
  <div class="min-h-screen bg-bg-muted">
    <TheAppBar />

    <main class="pt-16">
      <div class="mx-auto flex max-w-[100rem] gap-6 px-4 py-6 sm:px-6">
        <!-- Sidebar (lg+) -->
        <aside class="hidden w-60 shrink-0 lg:block">
          <nav
            class="sticky top-20 rounded-2xl border border-border bg-white p-3"
            aria-label="Navigation administration"
          >
            <p class="px-3 pb-2 pt-1 text-caption font-bold uppercase tracking-widest text-text-muted">
              Administration
            </p>
            <ul class="space-y-1">
              <li v-for="l in links" :key="l.to">
                <NuxtLink
                  :to="l.to"
                  :class="[baseItem, 'w-full', isActive(l) ? activeItem : idleItem]"
                  :aria-current="isActive(l) ? 'page' : undefined"
                >
                  <Icon :name="l.icon" class="size-4 shrink-0" />
                  <span class="truncate">{{ l.label }}</span>
                </NuxtLink>
              </li>
            </ul>
          </nav>
        </aside>

        <!-- Contenu -->
        <div class="min-w-0 flex-1">
          <!-- Nav horizontale scrollable (mobile / tablette) -->
          <nav
            class="-mx-4 mb-4 overflow-x-auto border-b border-border px-4 pb-3 lg:hidden"
            aria-label="Navigation administration"
          >
            <ul class="flex w-max gap-2">
              <li v-for="l in links" :key="l.to">
                <NuxtLink
                  :to="l.to"
                  :class="[baseItem, 'whitespace-nowrap', isActive(l) ? activeItem : idleItem]"
                  :aria-current="isActive(l) ? 'page' : undefined"
                >
                  <Icon :name="l.icon" class="size-4 shrink-0" />
                  {{ l.label }}
                </NuxtLink>
              </li>
            </ul>
          </nav>

          <slot />
        </div>
      </div>
    </main>
  </div>
</template>
