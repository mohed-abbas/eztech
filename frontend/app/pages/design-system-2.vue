<script setup lang="ts">
/**
 * EzTech Design System 2.0 Showcase
 *
 * Interactive reference page showcasing all v2.0 design tokens, components,
 * and section patterns. Adapted from TroxRide UI with EzTech purple brand.
 */

useHead({
  title: 'EzTech Design System 2.0',
  meta: [
    { name: 'description', content: 'EzTech design system 2.0 — tokens, components, and patterns' },
  ],
})

const sections = [
  { id: 'colors', label: 'Colors' },
  { id: 'surfaces', label: 'Surface Tints' },
  { id: 'typography', label: 'Typography' },
  { id: 'spacing', label: 'Spacing' },
  { id: 'radius', label: 'Border Radius' },
  { id: 'shadows', label: 'Shadows' },
  { id: 'buttons', label: 'Buttons' },
  { id: 'cards', label: 'Cards' },
  { id: 'forms', label: 'Form Elements' },
  { id: 'nav-footer', label: 'Nav & Footer' },
  { id: 'sections', label: 'Section Patterns' },
  { id: 'icons', label: 'Icons' },
]

const activeSection = ref('colors')

function scrollToSection(id: string) {
  activeSection.value = id
  const el = document.getElementById(id)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function handleScroll() {
  for (const section of [...sections].reverse()) {
    const el = document.getElementById(section.id)
    if (el) {
      const rect = el.getBoundingClientRect()
      if (rect.top <= 160) {
        activeSection.value = section.id
        break
      }
    }
  }
}

onMounted(() => window.addEventListener('scroll', handleScroll, { passive: true }))
onUnmounted(() => window.removeEventListener('scroll', handleScroll))
</script>

<template>
  <div class="min-h-screen bg-background font-sans text-foreground">
    <!-- ═══════════════════════════════════════════
         TOP HEADER
         ═══════════════════════════════════════════ -->
    <header class="fixed top-0 inset-x-0 z-50 flex items-center gap-4 border-b border-border bg-white/80 backdrop-blur-md px-6 py-3">
      <div class="flex items-center gap-3">
        <div class="flex size-9 items-center justify-center rounded-full bg-primary-500 text-white font-bold text-body-sm">
          Ez
        </div>
        <div>
          <h1 class="text-body font-bold text-text-primary leading-tight">EzTech</h1>
          <p class="text-caption text-text-muted leading-tight">Design System v2.0</p>
        </div>
      </div>
      <div class="ml-auto flex items-center gap-4">
        <NuxtLink to="/" class="text-body-sm text-text-secondary hover:text-primary-500 transition-colors">
          Back to Home
        </NuxtLink>
        <span class="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-3 py-1.5 text-caption font-medium text-primary-600">
          <Icon name="ph:sparkle" class="size-3.5" />
          {{ sections.length }} Sections
        </span>
      </div>
    </header>

    <div class="flex pt-[60px]">
      <!-- ═══════════════════════════════════════════
           SIDEBAR
           ═══════════════════════════════════════════ -->
      <nav class="fixed left-0 top-[60px] bottom-0 z-40 hidden w-60 flex-col gap-1 overflow-y-auto border-r border-border bg-white px-3 py-4 lg:flex">
        <p class="mb-2 px-3 text-caption font-semibold uppercase tracking-wider text-text-muted">Sections</p>
        <button
          v-for="section in sections"
          :key="section.id"
          :class="[
            'flex items-center gap-2 rounded-full px-3 py-2 text-body-sm font-medium transition-all text-left',
            activeSection === section.id
              ? 'bg-primary-50 text-primary-600'
              : 'text-text-secondary hover:bg-neutral-50 hover:text-text-primary',
          ]"
          @click="scrollToSection(section.id)"
        >
          <span :class="['size-1.5 rounded-full transition-colors', activeSection === section.id ? 'bg-primary-500' : 'bg-neutral-300']" />
          {{ section.label }}
        </button>
        <div class="mt-auto border-t border-border pt-4 px-3">
          <p class="text-caption text-text-muted">Tailwind CSS v4 + Nuxt 4</p>
        </div>
      </nav>

      <!-- ═══════════════════════════════════════════
           MAIN CONTENT
           ═══════════════════════════════════════════ -->
      <main class="min-h-screen flex-1 lg:ml-60">

        <!-- Hero -->
        <div class="relative overflow-hidden bg-section-dark px-8 py-20 text-white sm:px-12 sm:py-28 rounded-b-3xl">
          <div class="pointer-events-none absolute -right-20 -top-20 size-96 rounded-full bg-primary-500/20 blur-3xl" />
          <div class="pointer-events-none absolute -bottom-16 -left-16 size-80 rounded-full bg-primary-400/15 blur-2xl" />
          <div class="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-[600px] rounded-full bg-primary-600/10 blur-3xl" />
          <div class="relative max-w-3xl mx-auto text-center">
            <span class="mb-6 inline-flex items-center gap-1.5 rounded-full bg-primary-500/20 border border-primary-400/30 px-4 py-1.5 text-caption font-medium backdrop-blur-sm">
              <Icon name="ph:package" class="size-3.5" />
              Design System 2.0
            </span>
            <h1 class="text-display font-semibold leading-display capitalize">
              EzTech Design System
            </h1>
            <p class="mt-4 max-w-lg mx-auto text-body-lg leading-body text-neutral-300">
              Tokens, components, and patterns for the EzTech delivery and rental platform.
            </p>
            <div class="mt-8 flex items-center justify-center gap-3">
              <button class="btn-gradient-primary rounded-full px-6 py-3 text-body-sm font-medium text-white capitalize border border-white/10">
                Get Started
              </button>
              <button class="btn-glass bg-white rounded-full px-6 py-2.5 text-body-sm font-medium text-text-primary capitalize">
                Explore Demo
              </button>
            </div>
          </div>
        </div>

        <div class="mx-auto max-w-5xl px-6 py-12 sm:px-8">

          <!-- ═══════════════════════════════════════
               COLORS
               ═══════════════════════════════════════ -->
          <section id="colors" class="scroll-mt-20 pb-16">
            <div class="mb-8">
              <h2 class="text-h2 font-bold text-text-primary">Color Palette</h2>
              <p class="mt-2 max-w-2xl text-body text-text-secondary leading-relaxed">
                All brand, semantic, and neutral colors. The full EzTech palette preserved from v1.
              </p>
            </div>

            <!-- Primary -->
            <h3 class="mb-3 text-h4 font-semibold text-text-primary">Primary &mdash; Purple</h3>
            <p class="mb-4 text-body-sm text-text-muted">Main brand color for CTAs, links, and interactive elements.</p>
            <div class="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-5 lg:grid-cols-10">
              <div v-for="(hex, i) in ['#F5F3FF','#EDE9FE','#DDD6FE','#C4B5FD','#A78BFA','#8B5CF6','#7C3AED','#6D28D9','#5B21B6','#4C1D95']" :key="i" class="overflow-hidden rounded-xl" :class="i < 4 ? 'border border-border' : ''">
                <div class="h-16" :class="`bg-primary-${[50,100,200,300,400,500,600,700,800,900][i]}`" />
                <div class="bg-white p-2 border-t border-neutral-100">
                  <p class="text-caption font-semibold text-text-primary">{{ [50,100,200,300,400,500,600,700,800,900][i] }}</p>
                  <p class="text-caption text-text-muted font-mono">{{ hex }}</p>
                </div>
              </div>
            </div>

            <!-- Accent -->
            <h3 class="mb-3 text-h4 font-semibold text-text-primary">Accent &mdash; Violet</h3>
            <p class="mb-4 text-body-sm text-text-muted">Secondary brand for decorative elements and complementary CTAs.</p>
            <div class="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-5 lg:grid-cols-9">
              <div v-for="(hex, i) in ['#F3E8FF','#E9D5FF','#D8B4FE','#C084FC','#A855F7','#9333EA','#7E22CE','#6B21A8','#581C87']" :key="i" class="overflow-hidden rounded-xl" :class="i < 3 ? 'border border-border' : ''">
                <div class="h-16" :class="`bg-accent-${[100,200,300,400,500,600,700,800,900][i]}`" />
                <div class="bg-white p-2 border-t border-neutral-100">
                  <p class="text-caption font-semibold text-text-primary">{{ [100,200,300,400,500,600,700,800,900][i] }}</p>
                  <p class="text-caption text-text-muted font-mono">{{ hex }}</p>
                </div>
              </div>
            </div>

            <!-- Neutral -->
            <h3 class="mb-3 text-h4 font-semibold text-text-primary">Neutral &mdash; Gray</h3>
            <p class="mb-4 text-body-sm text-text-muted">Text, borders, backgrounds, and structural elements.</p>
            <div class="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-5 lg:grid-cols-10">
              <div v-for="(hex, i) in ['#F9FAFB','#F3F4F6','#E5E7EB','#D1D5DB','#9CA3AF','#6B7280','#4B5563','#374151','#1F2937','#111827']" :key="i" class="overflow-hidden rounded-xl" :class="i < 3 ? 'border border-border' : ''">
                <div class="h-16" :class="`bg-neutral-${[50,100,200,300,400,500,600,700,800,900][i]}`" />
                <div class="bg-white p-2 border-t border-neutral-100">
                  <p class="text-caption font-semibold text-text-primary">{{ [50,100,200,300,400,500,600,700,800,900][i] }}</p>
                  <p class="text-caption text-text-muted font-mono">{{ hex }}</p>
                </div>
              </div>
            </div>

            <!-- Semantic -->
            <h3 class="mb-3 text-h4 font-semibold text-text-primary">Semantic</h3>
            <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div v-for="{ name: n, hex, cls } in [
                { name: 'Success', hex: '#10B981', cls: 'bg-success' },
                { name: 'Warning', hex: '#F59E0B', cls: 'bg-warning' },
                { name: 'Error', hex: '#EF4444', cls: 'bg-error' },
                { name: 'Info', hex: '#3B82F6', cls: 'bg-info' },
              ]" :key="n" class="overflow-hidden rounded-xl border border-border">
                <div class="h-20" :class="cls" />
                <div class="p-3">
                  <p class="text-body-sm font-semibold text-text-primary">{{ n }}</p>
                  <p class="text-caption text-text-muted font-mono">{{ hex }}</p>
                </div>
              </div>
            </div>
          </section>

          <!-- ═══════════════════════════════════════
               SURFACE TINTS (v2.0)
               ═══════════════════════════════════════ -->
          <section id="surfaces" class="scroll-mt-20 border-t border-border pt-16 pb-16">
            <div class="mb-8">
              <h2 class="text-h2 font-bold text-text-primary">Surface Tints</h2>
              <p class="mt-2 max-w-2xl text-body text-text-secondary leading-relaxed">
                Subtle tinted backgrounds for stat cards, feature sections, and visual variety. New in v2.0.
              </p>
            </div>

            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div v-for="{ name: n, hex, cls, desc } in [
                { name: 'Purple', hex: '#F5F3FF', cls: 'bg-surface-purple', desc: 'Primary-tinted cards' },
                { name: 'Violet', hex: '#F3E8FF', cls: 'bg-surface-violet', desc: 'Accent-tinted cards' },
                { name: 'Lavender', hex: '#FAF5FF', cls: 'bg-surface-lavender', desc: 'Warm-tinted cards' },
                { name: 'Lilac', hex: '#EDE9FE', cls: 'bg-surface-lilac', desc: 'Cool-tinted cards' },
              ]" :key="n" class="overflow-hidden rounded-xl border border-border">
                <div class="h-24 flex items-center justify-center" :class="cls">
                  <p class="text-body-sm font-medium text-neutral-600">surface-{{ n.toLowerCase() }}</p>
                </div>
                <div class="p-3 bg-white">
                  <p class="text-body-sm font-semibold text-text-primary">{{ n }}</p>
                  <p class="text-caption text-text-muted font-mono">{{ hex }}</p>
                  <p class="text-caption text-text-muted">{{ desc }}</p>
                </div>
              </div>
            </div>

            <!-- Dark backgrounds -->
            <h3 class="mt-10 mb-4 text-h4 font-semibold text-text-primary">Dark Backgrounds</h3>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div v-for="{ name: n, hex, cls } in [
                { name: 'Dark', hex: '#1F2937', cls: 'bg-neutral-800' },
                { name: 'Darker', hex: '#111827', cls: 'bg-neutral-900' },
                { name: 'Section Dark', hex: 'gradient', cls: 'bg-section-dark' },
              ]" :key="n" class="overflow-hidden rounded-xl border border-border">
                <div class="h-24 flex items-center justify-center" :class="cls">
                  <p class="text-body-sm font-medium text-white">{{ n }}</p>
                </div>
                <div class="p-3 bg-white">
                  <p class="text-body-sm font-semibold text-text-primary">{{ n }}</p>
                  <p class="text-caption text-text-muted font-mono">{{ hex }}</p>
                </div>
              </div>
            </div>
          </section>

          <!-- ═══════════════════════════════════════
               TYPOGRAPHY
               ═══════════════════════════════════════ -->
          <section id="typography" class="scroll-mt-20 border-t border-border pt-16 pb-16">
            <div class="mb-8">
              <h2 class="text-h2 font-bold text-text-primary">Typography</h2>
              <p class="mt-2 max-w-2xl text-body text-text-secondary leading-relaxed">
                Expanded type scale with bolder hero headlines (76px display) and a new display-sm (56px) for CTA banners.
              </p>
            </div>

            <div class="space-y-6">
              <div v-for="{ label, cls, size, weight, leading, sample, heading } in [
                { label: 'Display', cls: 'text-display', size: '4.75rem / 76px', weight: 'font-semibold', leading: '1.2', sample: 'Rent Premium. Deliver Smart.', heading: true },
                { label: 'Display SM', cls: 'text-[3.5rem]', size: '3.5rem / 56px', weight: 'font-medium', leading: '1.2', sample: 'Get your tech — in style.', heading: true },
                { label: 'H1', cls: 'text-h1', size: '3rem / 48px', weight: 'font-medium', leading: '1.2', sample: 'Browse Smarter, Rent Faster', heading: true },
                { label: 'H2', cls: 'text-h2', size: '2.25rem / 36px', weight: 'font-medium', leading: '1.2', sample: '250+ Products Available', heading: true },
                { label: 'H3', cls: 'text-h3', size: '1.5rem / 24px', weight: 'font-semibold', leading: '1.2', sample: 'MacBook Pro M3 Max', heading: true },
                { label: 'H4', cls: 'text-h4', size: '1.25rem / 20px', weight: 'font-medium', leading: '1.2', sample: 'Active Renters Worldwide', heading: true },
                { label: 'Body LG', cls: 'text-body-lg', size: '1.25rem / 20px', weight: 'font-normal', leading: '1.5', sample: 'Premium tech equipment delivered to your door. Browse, rent, and receive — all from your phone.', heading: false },
                { label: 'Body', cls: 'text-body', size: '1rem / 16px', weight: 'font-normal', leading: '1.5', sample: 'Schedule deliveries, manage rentals, and track your equipment all in one place.', heading: false },
                { label: 'Body SM', cls: 'text-body-sm', size: '0.875rem / 14px', weight: 'font-medium', leading: '1.5', sample: 'Get Started Now — free delivery on your first order.', heading: false },
                { label: 'Caption', cls: 'text-caption', size: '0.75rem / 12px', weight: 'font-normal', leading: '1.5', sample: 'Terms and conditions apply. Equipment subject to availability.', heading: false },
              ]" :key="label" class="rounded-xl border border-border p-5">
                <div class="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <span class="text-body-sm font-semibold text-primary-500">{{ label }}</span>
                  <code class="text-caption font-mono text-text-muted">{{ cls }}</code>
                  <span class="text-caption text-text-muted">{{ size }}</span>
                  <span class="text-caption text-text-muted">line-height: {{ leading }}</span>
                </div>
                <component :is="heading ? 'h3' : 'p'" :class="[cls, weight, heading ? 'text-text-primary' : 'text-text-secondary']" :style="{ lineHeight: leading }">
                  {{ sample }}
                </component>
              </div>
            </div>

            <!-- Font Families -->
            <h3 class="mt-12 mb-4 text-h4 font-semibold text-text-primary">Font Families</h3>
            <div class="grid gap-4 sm:grid-cols-3">
              <div class="rounded-xl border border-border p-5">
                <p class="mb-1 text-caption font-medium uppercase tracking-wider text-text-muted">Sans / UI</p>
                <p class="font-sans text-h3 text-text-primary">Inter</p>
                <p class="mt-2 font-sans text-body-sm text-text-secondary">ABCDEFGHIJKLMNOPQRSTUVWXYZ</p>
                <p class="font-sans text-body-sm text-text-secondary">abcdefghijklmnopqrstuvwxyz 0123456789</p>
                <code class="mt-2 inline-block text-caption text-primary-500">font-sans</code>
              </div>
              <div class="rounded-xl border border-border p-5">
                <p class="mb-1 text-caption font-medium uppercase tracking-wider text-text-muted">Heading</p>
                <p class="font-heading text-h3 text-text-primary">Inter</p>
                <p class="mt-2 font-heading text-body-sm font-semibold text-text-secondary">Semibold for headings</p>
                <p class="font-heading text-body-sm font-medium text-text-secondary">Medium for subheadings</p>
                <code class="mt-2 inline-block text-caption text-primary-500">font-heading</code>
              </div>
              <div class="rounded-xl border border-border p-5">
                <p class="mb-1 text-caption font-medium uppercase tracking-wider text-text-muted">Monospace</p>
                <p class="font-mono text-h3 text-text-primary">JetBrains</p>
                <p class="mt-2 font-mono text-body-sm text-text-secondary">const rental = "active";</p>
                <p class="font-mono text-body-sm text-text-secondary">bg-primary-500</p>
                <code class="mt-2 inline-block font-mono text-caption text-primary-500">font-mono</code>
              </div>
            </div>
          </section>

          <!-- ═══════════════════════════════════════
               SPACING
               ═══════════════════════════════════════ -->
          <section id="spacing" class="scroll-mt-20 border-t border-border pt-16 pb-16">
            <div class="mb-8">
              <h2 class="text-h2 font-bold text-text-primary">Spacing System</h2>
              <p class="mt-2 max-w-2xl text-body text-text-secondary leading-relaxed">
                Generous section padding (100px horizontal, 160px vertical) matching the TroxRide layout proportions.
              </p>
            </div>

            <div class="space-y-3">
              <div v-for="{ token, value, width } in [
                { token: 'xs', value: '0.25rem / 4px', width: 'w-1' },
                { token: 'sm', value: '0.5rem / 8px', width: 'w-2' },
                { token: 'md', value: '1rem / 16px', width: 'w-4' },
                { token: 'lg', value: '1.5rem / 24px', width: 'w-6' },
                { token: 'xl', value: '2rem / 32px', width: 'w-8' },
                { token: '2xl', value: '2.5rem / 40px', width: 'w-10' },
                { token: '3xl', value: '4rem / 64px', width: 'w-16' },
                { token: '4xl', value: '6rem / 96px', width: 'w-24' },
                { token: 'section-x', value: '6.25rem / 100px', width: 'w-25' },
                { token: 'section-y', value: '10rem / 160px', width: 'w-40' },
                { token: 'section-y-sm', value: '5rem / 80px', width: 'w-20' },
              ]" :key="token" class="flex items-center gap-4 rounded-lg border border-border px-4 py-3">
                <code class="w-24 flex-shrink-0 text-body-sm font-semibold text-primary-500 font-mono">{{ token }}</code>
                <div class="h-6 rounded-md bg-primary-400" :class="width" />
                <span class="ml-auto flex-shrink-0 text-caption text-text-muted font-mono">{{ value }}</span>
              </div>
            </div>
          </section>

          <!-- ═══════════════════════════════════════
               BORDER RADIUS
               ═══════════════════════════════════════ -->
          <section id="radius" class="scroll-mt-20 border-t border-border pt-16 pb-16">
            <div class="mb-8">
              <h2 class="text-h2 font-bold text-text-primary">Border Radius</h2>
              <p class="mt-2 max-w-2xl text-body text-text-secondary leading-relaxed">
                New in v2.0: radius-3xl (32px) for sections, radius-feature (47px) for asymmetric card corners, and pill-shaped everything.
              </p>
            </div>

            <!-- Standard radius -->
            <div class="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8">
              <div v-for="{ name: n, value, cls } in [
                { name: 'sm', value: '6px', cls: 'rounded-[--radius-sm]' },
                { name: 'md', value: '8px', cls: 'rounded-[--radius-md]' },
                { name: 'lg', value: '12px', cls: 'rounded-[--radius-lg]' },
                { name: 'xl', value: '16px', cls: 'rounded-[--radius-xl]' },
                { name: '2xl', value: '24px', cls: 'rounded-[--radius-2xl]' },
                { name: '3xl', value: '32px', cls: 'rounded-3xl' },
                { name: 'feature', value: '47px', cls: 'rounded-[--radius-feature]' },
                { name: 'full', value: '9999px', cls: 'rounded-full' },
              ]" :key="n" class="flex flex-col items-center gap-2">
                <div class="size-20 border-2 border-primary-400 bg-primary-50" :class="cls" />
                <p class="text-caption font-semibold text-text-primary">{{ n }}</p>
                <p class="text-caption text-text-muted">{{ value }}</p>
              </div>
            </div>

            <!-- Asymmetric radius showcase -->
            <h3 class="mb-4 text-h4 font-semibold text-text-primary">Asymmetric Corners (v2.0)</h3>
            <p class="mb-6 text-body-sm text-text-muted">One oversized corner (47px) creates visual interest on stat/feature cards.</p>
            <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div class="rounded-tl-feature bg-surface-purple p-5 h-32 flex items-end">
                <code class="text-caption text-primary-600 font-mono">rounded-tl-feature</code>
              </div>
              <div class="rounded-tr-feature bg-surface-lilac p-5 h-32 flex items-end">
                <code class="text-caption text-primary-700 font-mono">rounded-tr-feature</code>
              </div>
              <div class="rounded-bl-feature bg-surface-violet p-5 h-32 flex items-end">
                <code class="text-caption text-accent-600 font-mono">rounded-bl-feature</code>
              </div>
              <div class="rounded-br-feature bg-surface-lavender p-5 h-32 flex items-end">
                <code class="text-caption text-primary-500 font-mono">rounded-br-feature</code>
              </div>
            </div>
          </section>

          <!-- ═══════════════════════════════════════
               SHADOWS
               ═══════════════════════════════════════ -->
          <section id="shadows" class="scroll-mt-20 border-t border-border pt-16 pb-16">
            <div class="mb-8">
              <h2 class="text-h2 font-bold text-text-primary">Shadows</h2>
              <p class="mt-2 max-w-2xl text-body text-text-secondary leading-relaxed">
                Soft elevation using Tailwind shadow utilities. Product cards use a wide soft shadow.
              </p>
            </div>

            <div class="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
              <div v-for="{ name: n, cls } in [
                { name: 'shadow-sm', cls: 'shadow-sm' },
                { name: 'shadow', cls: 'shadow' },
                { name: 'shadow-md', cls: 'shadow-md' },
                { name: 'shadow-lg', cls: 'shadow-lg' },
                { name: 'shadow-xl', cls: 'shadow-xl' },
                { name: 'card (custom)', cls: 'shadow-[0_0_50px_0_rgba(0,0,0,0.1)]' },
              ]" :key="n" class="flex flex-col items-center gap-3">
                <div class="size-24 rounded-xl bg-white" :class="cls" />
                <code class="text-caption text-text-muted font-mono text-center">{{ n }}</code>
              </div>
            </div>
          </section>

          <!-- ═══════════════════════════════════════
               BUTTONS
               ═══════════════════════════════════════ -->
          <section id="buttons" class="scroll-mt-20 border-t border-border pt-16 pb-16">
            <div class="mb-8">
              <h2 class="text-h2 font-bold text-text-primary">Button Patterns</h2>
              <p class="mt-2 max-w-2xl text-body text-text-secondary leading-relaxed">
                Pill-shaped buttons with gradient primary CTAs, glass secondary, and solid in-card actions. All buttons use rounded-full.
              </p>
            </div>

            <!-- Primary Dark Gradient -->
            <h3 class="mb-4 text-h4 font-semibold text-text-primary">Primary CTA &mdash; Dark Gradient Pill</h3>
            <div class="mb-8 flex flex-wrap items-center gap-4 rounded-xl border border-border p-6">
              <button class="btn-gradient-primary rounded-full px-8 py-4 text-body font-medium text-white capitalize border border-white/10">
                Get Started
              </button>
              <button class="btn-gradient-primary rounded-full px-6 py-3 text-body-sm font-medium text-white capitalize border border-white/10">
                Get Started
              </button>
              <button class="btn-gradient-primary rounded-full px-4 py-2 text-body-sm font-medium text-white capitalize border border-white/10">
                Get Started
              </button>
              <code class="text-caption text-text-muted font-mono ml-auto">btn-gradient-primary + rounded-full</code>
            </div>

            <!-- Solid Dark -->
            <h3 class="mb-4 text-h4 font-semibold text-text-primary">Solid Dark CTA &mdash; Pill</h3>
            <div class="mb-8 flex flex-wrap items-center gap-4 rounded-xl border border-border p-6">
              <button class="bg-neutral-800 hover:bg-neutral-900 rounded-full px-6 py-3 text-body-sm font-medium text-white capitalize transition-colors">
                Browse Equipment
              </button>
              <button class="bg-neutral-800 hover:bg-neutral-900 rounded-full px-6 py-3 text-body-sm font-medium text-white capitalize transition-colors">
                Get Started Now
              </button>
              <code class="text-caption text-text-muted font-mono ml-auto">bg-neutral-800 + rounded-full</code>
            </div>

            <!-- Secondary Glass -->
            <h3 class="mb-4 text-h4 font-semibold text-text-primary">Secondary &mdash; Glass Pill</h3>
            <div class="mb-8 flex flex-wrap items-center gap-4 rounded-xl border border-border p-6">
              <button class="btn-glass bg-white rounded-full px-6 py-2.5 text-body-sm font-medium text-text-primary capitalize">
                Explore Demo
              </button>
              <button class="btn-glass bg-white rounded-full px-6 py-2.5 text-body-sm font-medium text-text-primary capitalize">
                Learn More
              </button>
              <code class="text-caption text-text-muted font-mono ml-auto">btn-glass + bg-white</code>
            </div>

            <!-- Action Buttons (In-Card) -->
            <h3 class="mb-4 text-h4 font-semibold text-text-primary">Action &mdash; Solid Pill (In-Card)</h3>
            <div class="mb-8 flex flex-wrap items-center gap-4 rounded-xl border border-border p-6">
              <button class="bg-neutral-800 hover:bg-neutral-900 rounded-full px-4 py-2 text-body-sm font-medium text-white transition-colors">
                Rent Now
              </button>
              <button class="bg-neutral-800 hover:bg-neutral-900 rounded-full px-4 py-2 text-body-sm font-medium text-white transition-colors">
                Add to Cart
              </button>
              <button class="bg-neutral-800 hover:bg-neutral-900 rounded-full px-4 py-2 text-body-sm font-medium text-white transition-colors">
                Rent Now
              </button>
              <code class="text-caption text-text-muted font-mono ml-auto">bg-neutral-800 + rounded-full</code>
            </div>

            <!-- CTA With Icon -->
            <h3 class="mb-4 text-h4 font-semibold text-text-primary">CTA With Icon &mdash; White Pill</h3>
            <div class="flex flex-wrap items-center gap-4 rounded-xl bg-neutral-800 p-6">
              <button class="bg-white rounded-full px-5 py-2.5 flex items-center gap-2.5 text-body font-medium text-neutral-800 hover:bg-neutral-50 transition-colors">
                Book Your Ride Now
                <Icon name="ph:arrow-right" class="size-5" />
              </button>
              <button class="bg-white rounded-full px-5 py-2.5 flex items-center gap-2.5 text-body font-medium text-neutral-800 hover:bg-neutral-50 transition-colors">
                Download App
                <Icon name="ph:download-simple" class="size-5" />
              </button>
              <code class="text-caption text-neutral-400 font-mono ml-auto">bg-white + icon</code>
            </div>
          </section>

          <!-- ═══════════════════════════════════════
               CARDS
               ═══════════════════════════════════════ -->
          <section id="cards" class="scroll-mt-20 border-t border-border pt-16 pb-16">
            <div class="mb-8">
              <h2 class="text-h2 font-bold text-text-primary">Card Patterns</h2>
              <p class="mt-2 max-w-2xl text-body text-text-secondary leading-relaxed">
                Product cards, stat cards with asymmetric corners, feature info cards, and testimonial layout.
              </p>
            </div>

            <!-- Product Card -->
            <h3 class="mb-4 text-h4 font-semibold text-text-primary">Product Card</h3>
            <div class="mb-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <div v-for="product in [
                { name: 'MacBook Pro M3', type: 'Laptop', spec1: 'M3 Pro', spec2: '18GB', spec3: '512GB', price: '$25.00', icon1: 'ph:cpu', icon2: 'ph:memory', icon3: 'ph:hard-drive' },
                { name: 'Sony A7 IV', type: 'Camera', spec1: '33MP', spec2: '4K 60', spec3: '693 AF', price: '$18.00', icon1: 'ph:aperture', icon2: 'ph:film-strip', icon3: 'ph:crosshair' },
                { name: 'DJI Mavic 3', type: 'Drone', spec1: '4/3 CMOS', spec2: '46min', spec3: '15km', price: '$32.00', icon1: 'ph:camera', icon2: 'ph:battery-high', icon3: 'ph:wifi-high' },
              ]" :key="product.name" class="bg-neutral-50 border border-neutral-200 rounded-xl p-4 shadow-[0_0_50px_0_rgba(0,0,0,0.1)] transition-all hover:border-primary-300 hover:shadow-[0_0_50px_0_rgba(139,92,246,0.12)]">
                <div class="leading-[1.4]">
                  <p class="text-[18px] font-semibold text-neutral-800">{{ product.name }}</p>
                  <p class="text-caption font-medium text-neutral-500">{{ product.type }}</p>
                </div>
                <div class="h-28 w-full my-3 bg-neutral-100 rounded-md flex items-center justify-center">
                  <Icon name="ph:package" class="size-12 text-neutral-300" />
                </div>
                <div class="flex items-center justify-between mb-3">
                  <div class="flex items-center gap-1">
                    <Icon :name="product.icon1" class="size-4.5 text-neutral-500" />
                    <span class="text-caption font-medium text-neutral-500">{{ product.spec1 }}</span>
                  </div>
                  <div class="flex items-center gap-1">
                    <Icon :name="product.icon2" class="size-4.5 text-neutral-500" />
                    <span class="text-caption font-medium text-neutral-500">{{ product.spec2 }}</span>
                  </div>
                  <div class="flex items-center gap-1">
                    <Icon :name="product.icon3" class="size-4.5 text-neutral-500" />
                    <span class="text-caption font-medium text-neutral-500">{{ product.spec3 }}</span>
                  </div>
                </div>
                <hr class="border-neutral-200" />
                <div class="flex items-center justify-between mt-3">
                  <div class="flex items-end leading-[1.4]">
                    <span class="text-h3 font-semibold text-neutral-800">{{ product.price }}/</span>
                    <span class="text-caption font-medium text-neutral-500">Day</span>
                  </div>
                  <button class="bg-neutral-800 hover:bg-neutral-900 rounded-full px-4 py-2 text-body-sm font-medium text-white transition-colors">
                    Rent Now
                  </button>
                </div>
              </div>
            </div>

            <!-- Stat Cards -->
            <h3 class="mb-4 text-h4 font-semibold text-text-primary">Stat Cards (Asymmetric Corners)</h3>
            <div class="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div class="rounded-tl-feature bg-surface-purple p-5">
                <p class="text-h2 font-medium leading-heading text-neutral-800">250+</p>
                <div class="mt-3 flex flex-col gap-2">
                  <p class="text-h4 font-medium text-neutral-800">Products</p>
                  <p class="text-body text-neutral-500 leading-body">Laptops, cameras, drones, and more.</p>
                </div>
              </div>
              <div class="rounded-tr-feature bg-surface-lilac p-5">
                <p class="text-h2 font-medium leading-heading text-neutral-800">40+</p>
                <div class="mt-3 flex flex-col gap-2">
                  <p class="text-h4 font-medium text-neutral-800">Cities</p>
                  <p class="text-body text-neutral-500 leading-body">Same-day delivery across major cities.</p>
                </div>
              </div>
              <div class="rounded-bl-feature bg-surface-lavender p-5">
                <p class="text-h2 font-medium leading-heading text-neutral-800">10K+</p>
                <div class="mt-3 flex flex-col gap-2">
                  <p class="text-h4 font-medium text-neutral-800">Users</p>
                  <p class="text-body text-neutral-500 leading-body">Active renters on the platform.</p>
                </div>
              </div>
              <div class="rounded-br-feature bg-surface-violet p-5">
                <p class="text-h2 font-medium leading-heading text-neutral-800">4.9</p>
                <div class="mt-3 flex flex-col gap-2">
                  <p class="text-h4 font-medium text-neutral-800">Rating</p>
                  <p class="text-body text-neutral-500 leading-body">Average user satisfaction score.</p>
                </div>
              </div>
            </div>

            <!-- Feature Info Card -->
            <h3 class="mb-4 text-h4 font-semibold text-text-primary">Feature Info Card</h3>
            <div class="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div class="rounded-br-feature bg-neutral-100 p-5">
                <div class="bg-neutral-100 rounded-full p-2 w-fit">
                  <Icon name="ph:users" class="size-6 text-neutral-800" />
                </div>
                <div class="mt-3 flex flex-col gap-2">
                  <p class="text-h4 font-medium text-neutral-800">Active Renters</p>
                  <p class="text-body text-neutral-500 leading-body">Join thousands of users enjoying EzTech daily.</p>
                </div>
              </div>
              <div class="rounded-tl-feature bg-neutral-100 p-5">
                <div class="bg-neutral-100 rounded-full p-2 w-fit">
                  <Icon name="ph:lightning" class="size-6 text-neutral-800" />
                </div>
                <div class="mt-3 flex flex-col gap-2">
                  <p class="text-h4 font-medium text-neutral-800">Instant Delivery</p>
                  <p class="text-body text-neutral-500 leading-body">Get your tech delivered within hours, not days.</p>
                </div>
              </div>
            </div>

            <!-- Rental Booking Card (adapted from DS1 Appointment Card) -->
            <h3 class="mb-4 text-h4 font-semibold text-text-primary">Rental Booking Card</h3>
            <p class="mb-4 text-body-sm text-text-muted">Confirmed rental with pickup details, date/time metadata, and quick actions.</p>
            <div class="mb-10 max-w-lg">
              <div class="rounded-2xl border border-border border-l-4 border-l-primary-400 bg-white p-5 shadow-sm">
                <div class="flex items-start gap-4">
                  <div class="flex size-14 flex-shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-600">
                    <Icon name="ph:package" class="size-7" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between gap-2">
                      <h4 class="text-body font-semibold text-text-primary truncate">MacBook Pro M3 Max</h4>
                      <span class="flex-shrink-0 rounded-full bg-green-50 px-2.5 py-0.5 text-caption font-medium text-success">Confirmed</span>
                    </div>
                    <p class="mt-1 text-body-sm text-text-secondary">3-day rental &middot; Standard delivery</p>
                    <div class="mt-3 flex flex-wrap items-center gap-4 text-body-sm text-text-muted">
                      <span class="inline-flex items-center gap-1.5">
                        <Icon name="ph:calendar" class="size-4" />
                        March 18, 2026
                      </span>
                      <span class="inline-flex items-center gap-1.5">
                        <Icon name="ph:clock" class="size-4" />
                        10:00 AM
                      </span>
                      <span class="inline-flex items-center gap-1.5">
                        <Icon name="ph:map-pin" class="size-4" />
                        Paris, 75001
                      </span>
                    </div>
                  </div>
                </div>
                <div class="mt-4 flex gap-3 border-t border-border pt-4">
                  <button type="button" class="flex-1 rounded-full bg-neutral-800 py-2 text-body-sm font-medium text-white transition hover:bg-neutral-900">
                    Track Delivery
                  </button>
                  <button type="button" class="flex-1 rounded-full border border-border py-2 text-body-sm font-medium text-text-secondary transition hover:bg-neutral-50">
                    Reschedule
                  </button>
                </div>
              </div>
            </div>

            <!-- Service Feature Cards (adapted from DS1 Feature Cards 2x2) -->
            <h3 class="mb-4 text-h4 font-semibold text-text-primary">Service Feature Cards</h3>
            <p class="mb-4 text-body-sm text-text-muted">2x2 grid with icon, title, and description. Hover reveals subtle elevation and border tint.</p>
            <div class="mb-10 grid gap-6 sm:grid-cols-2">
              <div class="group rounded-2xl border border-border bg-white p-6 shadow-sm transition-all hover:shadow-md hover:border-primary-200">
                <div class="mb-4 flex size-12 items-center justify-center rounded-xl bg-surface-purple text-primary-500 transition-colors group-hover:bg-primary-100">
                  <Icon name="ph:lightning" class="size-6" />
                </div>
                <h4 class="text-h4 font-semibold text-text-primary">Instant Delivery</h4>
                <p class="mt-2 text-body-sm text-text-secondary leading-body">
                  Get your tech delivered within hours. Same-day shipping available in 40+ cities nationwide.
                </p>
              </div>
              <div class="group rounded-2xl border border-border bg-white p-6 shadow-sm transition-all hover:shadow-md hover:border-primary-200">
                <div class="mb-4 flex size-12 items-center justify-center rounded-xl bg-surface-violet text-accent-500 transition-colors group-hover:bg-accent-200">
                  <Icon name="ph:shield-check" class="size-6" />
                </div>
                <h4 class="text-h4 font-semibold text-text-primary">Premium Protection</h4>
                <p class="mt-2 text-body-sm text-text-secondary leading-body">
                  Every rental includes full coverage insurance. No hidden fees, no surprises &mdash; just peace of mind.
                </p>
              </div>
              <div class="group rounded-2xl border border-border bg-white p-6 shadow-sm transition-all hover:shadow-md hover:border-primary-200">
                <div class="mb-4 flex size-12 items-center justify-center rounded-xl bg-surface-lavender text-primary-600 transition-colors group-hover:bg-primary-100">
                  <Icon name="ph:devices" class="size-6" />
                </div>
                <h4 class="text-h4 font-semibold text-text-primary">Wide Catalog</h4>
                <p class="mt-2 text-body-sm text-text-secondary leading-body">
                  250+ premium devices from laptops and cameras to drones and tablets &mdash; always the latest models.
                </p>
              </div>
              <div class="group rounded-2xl border border-border bg-white p-6 shadow-sm transition-all hover:shadow-md hover:border-primary-200">
                <div class="mb-4 flex size-12 items-center justify-center rounded-xl bg-surface-lilac text-primary-700 transition-colors group-hover:bg-primary-100">
                  <Icon name="ph:arrows-clockwise" class="size-6" />
                </div>
                <h4 class="text-h4 font-semibold text-text-primary">Flexible Returns</h4>
                <p class="mt-2 text-body-sm text-text-secondary leading-body">
                  Extend your rental or return early &mdash; no penalties. Schedule pickup at your convenience.
                </p>
              </div>
            </div>

            <!-- Equipment Expert Card (adapted from DS1 Doctor Card) -->
            <h3 class="mb-4 text-h4 font-semibold text-text-primary">Equipment Expert Card</h3>
            <p class="mb-4 text-body-sm text-text-muted">Staff cards with avatar, specialty badge, star rating, and CTA. Uses gradient header and pill badge.</p>
            <div class="mb-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <div class="overflow-hidden rounded-2xl border border-border bg-white shadow-sm transition-all hover:shadow-md">
                <div class="flex h-40 items-center justify-center bg-gradient-to-br from-primary-100 to-primary-50">
                  <div class="flex size-20 items-center justify-center rounded-full bg-primary-200 text-primary-600">
                    <Icon name="ph:user" class="size-10" />
                  </div>
                </div>
                <div class="p-5">
                  <span class="inline-block rounded-full bg-primary-50 px-2.5 py-0.5 text-caption font-medium text-primary-600">Laptop Specialist</span>
                  <h4 class="mt-2 text-body-lg font-semibold text-text-primary">Alex Moreau</h4>
                  <p class="mt-1 text-body-sm text-text-muted">5 years at EzTech</p>
                  <div class="mt-3 flex items-center gap-1 text-warning">
                    <Icon name="ph:star-fill" class="size-4" />
                    <Icon name="ph:star-fill" class="size-4" />
                    <Icon name="ph:star-fill" class="size-4" />
                    <Icon name="ph:star-fill" class="size-4" />
                    <Icon name="ph:star-half-fill" class="size-4" />
                    <span class="ml-1 text-body-sm font-medium text-text-secondary">4.8</span>
                  </div>
                  <button type="button" class="mt-4 w-full rounded-full bg-neutral-800 py-2.5 text-body-sm font-medium text-white transition hover:bg-neutral-900">
                    Get Advice
                  </button>
                </div>
              </div>

              <div class="overflow-hidden rounded-2xl border border-border bg-white shadow-sm transition-all hover:shadow-md">
                <div class="flex h-40 items-center justify-center bg-gradient-to-br from-accent-100 to-accent-100/40">
                  <div class="flex size-20 items-center justify-center rounded-full bg-accent-200 text-accent-600">
                    <Icon name="ph:user" class="size-10" />
                  </div>
                </div>
                <div class="p-5">
                  <span class="inline-block rounded-full bg-accent-100 px-2.5 py-0.5 text-caption font-medium text-accent-600">Camera Expert</span>
                  <h4 class="mt-2 text-body-lg font-semibold text-text-primary">Lina Dupont</h4>
                  <p class="mt-1 text-body-sm text-text-muted">3 years at EzTech</p>
                  <div class="mt-3 flex items-center gap-1 text-warning">
                    <Icon name="ph:star-fill" class="size-4" />
                    <Icon name="ph:star-fill" class="size-4" />
                    <Icon name="ph:star-fill" class="size-4" />
                    <Icon name="ph:star-fill" class="size-4" />
                    <Icon name="ph:star-fill" class="size-4" />
                    <span class="ml-1 text-body-sm font-medium text-text-secondary">5.0</span>
                  </div>
                  <button type="button" class="mt-4 w-full rounded-full bg-neutral-800 py-2.5 text-body-sm font-medium text-white transition hover:bg-neutral-900">
                    Get Advice
                  </button>
                </div>
              </div>

              <div class="overflow-hidden rounded-2xl border border-border bg-white shadow-sm transition-all hover:shadow-md">
                <div class="flex h-40 items-center justify-center bg-gradient-to-br from-primary-200/50 to-surface-lavender">
                  <div class="flex size-20 items-center justify-center rounded-full bg-primary-100 text-primary-500">
                    <Icon name="ph:user" class="size-10" />
                  </div>
                </div>
                <div class="p-5">
                  <span class="inline-block rounded-full bg-surface-lavender px-2.5 py-0.5 text-caption font-medium text-primary-600">Drone Pilot</span>
                  <h4 class="mt-2 text-body-lg font-semibold text-text-primary">Marc Lefebvre</h4>
                  <p class="mt-1 text-body-sm text-text-muted">4 years at EzTech</p>
                  <div class="mt-3 flex items-center gap-1 text-warning">
                    <Icon name="ph:star-fill" class="size-4" />
                    <Icon name="ph:star-fill" class="size-4" />
                    <Icon name="ph:star-fill" class="size-4" />
                    <Icon name="ph:star-fill" class="size-4" />
                    <Icon name="ph:star" class="size-4 text-neutral-300" />
                    <span class="ml-1 text-body-sm font-medium text-text-secondary">4.6</span>
                  </div>
                  <button type="button" class="mt-4 w-full rounded-full bg-neutral-800 py-2.5 text-body-sm font-medium text-white transition hover:bg-neutral-900">
                    Get Advice
                  </button>
                </div>
              </div>
            </div>

            <!-- Testimonial Section -->
            <h3 class="mb-4 text-h4 font-semibold text-text-primary">Testimonial</h3>
            <div class="rounded-xl border border-border overflow-hidden">
              <div class="relative bg-white py-16 flex flex-col items-center gap-12">
                <!-- Section heading -->
                <h2 class="text-h1 font-medium leading-heading capitalize text-text-primary text-center max-w-lg">
                  Trusted by Thousands of Users Worldwide
                </h2>

                <!-- Testimonial area with map background -->
                <div class="relative w-full">
                  <!-- World map background -->
                  <img
                    src="/assets/testimonial-map-bg.png"
                    alt=""
                    aria-hidden="true"
                    class="absolute inset-0 w-full h-full object-contain opacity-60 pointer-events-none"
                  />

                  <!-- Scattered avatars (decorative) -->
                  <img src="/assets/avatar-1.png" alt="" class="absolute size-8 rounded-full ring-2 ring-white shadow-md left-[12%] top-[8%] object-cover" />
                  <img src="/assets/avatar-2.png" alt="" class="absolute size-12 rounded-full ring-2 ring-white shadow-md right-[14%] top-[5%] object-cover" />
                  <img src="/assets/avatar-5.png" alt="" class="absolute size-10 rounded-full ring-2 ring-white shadow-md left-[6%] top-[42%] object-cover" />
                  <img src="/assets/avatar-3.png" alt="" class="absolute size-8 rounded-full ring-2 ring-white shadow-md right-[10%] top-[45%] object-cover" />
                  <img src="/assets/avatar-6.png" alt="" class="absolute size-14 rounded-full ring-2 ring-white shadow-md left-[13%] bottom-[8%] object-cover" />
                  <img src="/assets/avatar-4.png" alt="" class="absolute size-11 rounded-full ring-2 ring-white shadow-md right-[12%] bottom-[12%] object-cover" />

                  <!-- Center content -->
                  <div class="relative flex flex-col items-center gap-8 px-8 py-8 max-w-2xl mx-auto">
                    <!-- Main avatar -->
                    <img
                      src="/assets/avatar-main.png"
                      alt="Cameron Williamson"
                      class="size-28 rounded-full ring-4 ring-white shadow-lg object-cover"
                    />

                    <!-- Quote -->
                    <div class="flex items-start gap-4">
                      <span class="text-h1 leading-none text-primary-300 font-serif shrink-0">&ldquo;</span>
                      <blockquote class="text-h3 font-normal leading-body text-neutral-800 text-center">
                        Finding premium tech gear used to be a headache. Now with EzTech, I can rent exactly what I need &mdash; in minutes. It's fast, clean, and always reliable.
                      </blockquote>
                      <span class="text-h1 leading-none text-primary-300 font-serif shrink-0">&rdquo;</span>
                    </div>

                    <!-- Author -->
                    <div class="text-center">
                      <p class="text-h3 font-medium text-neutral-800 leading-heading">Cameron Williamson</p>
                      <p class="text-body text-neutral-500 leading-body">Business Professional, UAE</p>
                    </div>
                  </div>

                  <!-- Navigation arrows -->
                  <div class="relative flex items-center justify-center gap-4 pb-4">
                    <button class="size-14 rounded-full bg-neutral-100 flex items-center justify-center hover:bg-primary-50 transition-colors">
                      <Icon name="ph:arrow-left" class="size-6 text-neutral-600" />
                    </button>
                    <button class="size-14 rounded-full bg-neutral-100 flex items-center justify-center hover:bg-primary-50 transition-colors">
                      <Icon name="ph:arrow-right" class="size-6 text-neutral-600" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <!-- ═══════════════════════════════════════
               FORM ELEMENTS
               ═══════════════════════════════════════ -->
          <section id="forms" class="scroll-mt-20 border-t border-border pt-16 pb-16">
            <div class="mb-8">
              <h2 class="text-h2 font-bold text-text-primary">Form Elements</h2>
              <p class="mt-2 max-w-2xl text-body text-text-secondary leading-relaxed">
                Pill-shaped inputs for search and newsletter. Standard inputs for forms.
              </p>
            </div>

            <div class="grid grid-cols-1 gap-8 sm:grid-cols-2">
              <!-- Pill search input -->
              <div>
                <h4 class="mb-3 text-body-sm font-semibold text-text-primary">Pill Search Input</h4>
                <div class="bg-neutral-50 rounded-full p-3 flex items-center gap-2 w-full">
                  <Icon name="ph:magnifying-glass" class="size-4 text-neutral-500" />
                  <input type="text" placeholder="Search Here" class="bg-transparent text-body-sm text-neutral-500 outline-none flex-1" />
                </div>
                <code class="mt-2 block text-caption text-text-muted font-mono">rounded-full + bg-neutral-50</code>
              </div>

              <!-- Newsletter input -->
              <div>
                <h4 class="mb-3 text-body-sm font-semibold text-text-primary">Newsletter Input + Button</h4>
                <div class="bg-neutral-50 rounded-full flex items-center pl-4 pr-1.5 py-1.5">
                  <input type="email" placeholder="Enter Your Email" class="bg-transparent text-body-sm text-neutral-500 outline-none flex-1" />
                  <button class="bg-neutral-800 hover:bg-neutral-900 rounded-full p-3 transition-colors">
                    <Icon name="ph:arrow-right" class="size-5 text-white" />
                  </button>
                </div>
                <code class="mt-2 block text-caption text-text-muted font-mono">pill input + embedded circle button</code>
              </div>

              <!-- Standard input -->
              <div>
                <h4 class="mb-3 text-body-sm font-semibold text-text-primary">Standard Form Input</h4>
                <div class="flex flex-col gap-1.5">
                  <label class="text-body-sm font-medium text-neutral-800">Email</label>
                  <input type="email" placeholder="you@example.com" class="bg-white border border-neutral-200 rounded-[--radius-md] px-4 py-3 text-body text-text-primary outline-none focus:ring-2 focus:ring-primary-400/30 focus:border-primary-500 transition" />
                  <p class="text-caption text-neutral-500">We'll never share your email.</p>
                </div>
              </div>

              <!-- Standard input with label -->
              <div>
                <h4 class="mb-3 text-body-sm font-semibold text-text-primary">Password Input</h4>
                <div class="flex flex-col gap-1.5">
                  <label class="text-body-sm font-medium text-neutral-800">Password</label>
                  <input type="password" placeholder="Enter password" class="bg-white border border-neutral-200 rounded-[--radius-md] px-4 py-3 text-body text-text-primary outline-none focus:ring-2 focus:ring-primary-400/30 focus:border-primary-500 transition" />
                  <p class="text-caption text-neutral-500">Min 8 characters.</p>
                </div>
              </div>
            </div>
          </section>

          <!-- ═══════════════════════════════════════
               NAV & FOOTER
               ═══════════════════════════════════════ -->
          <section id="nav-footer" class="scroll-mt-20 border-t border-border pt-16 pb-16">
            <div class="mb-8">
              <h2 class="text-h2 font-bold text-text-primary">Navigation &amp; Footer</h2>
              <p class="mt-2 max-w-2xl text-body text-text-secondary leading-relaxed">
                Minimal navbar with logo + CTA. Rounded card-style footer with brand info, links, and newsletter.
              </p>
            </div>

            <!-- Navbar Preview -->
            <h3 class="mb-4 text-h4 font-semibold text-text-primary">Navbar</h3>
            <div class="mb-10 rounded-xl border border-border overflow-hidden">
              <div class="bg-white px-8 py-4 flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <div class="size-8.5 rounded-full bg-primary-500 flex items-center justify-center">
                    <Icon name="ph:package" class="size-4 text-white" />
                  </div>
                  <span class="text-h3 font-semibold text-neutral-900">EzTech</span>
                </div>
                <div class="hidden sm:flex items-center gap-8 text-body-sm text-neutral-600">
                  <a href="#" class="hover:text-neutral-900 transition-colors">Products</a>
                  <a href="#" class="hover:text-neutral-900 transition-colors">How It Works</a>
                  <a href="#" class="hover:text-neutral-900 transition-colors">Pricing</a>
                </div>
                <button class="btn-gradient-primary rounded-full px-5 py-2.5 text-body-sm font-medium text-white capitalize border border-white/10">
                  Get Started
                </button>
              </div>
            </div>

            <!-- Footer Preview -->
            <h3 class="mb-4 text-h4 font-semibold text-text-primary">Footer</h3>
            <div class="rounded-3xl border border-neutral-200 bg-white p-8">
              <div class="flex flex-col lg:flex-row items-start justify-between gap-8">
                <!-- Left: brand -->
                <div class="max-w-md flex flex-col gap-5">
                  <div class="flex items-center gap-2">
                    <div class="size-8.5 rounded-full bg-primary-500 flex items-center justify-center">
                      <Icon name="ph:package" class="size-4 text-white" />
                    </div>
                    <span class="text-h3 font-semibold text-neutral-900">EzTech</span>
                  </div>
                  <p class="text-body text-neutral-600 leading-body capitalize">
                    EzTech is a premium tech rental platform, making laptops, cameras, and equipment accessible with just a few taps.
                  </p>
                  <div class="flex items-center gap-3">
                    <a href="#" class="size-10 rounded-full border border-neutral-900/25 flex items-center justify-center hover:border-neutral-900/50 transition-colors">
                      <Icon name="ph:facebook-logo" class="size-5 text-neutral-800" />
                    </a>
                    <a href="#" class="size-10 rounded-full border border-neutral-900/25 flex items-center justify-center hover:border-neutral-900/50 transition-colors">
                      <Icon name="ph:linkedin-logo" class="size-5 text-neutral-800" />
                    </a>
                    <a href="#" class="size-10 rounded-full border border-neutral-900/25 flex items-center justify-center hover:border-neutral-900/50 transition-colors">
                      <Icon name="ph:x-logo" class="size-5 text-neutral-800" />
                    </a>
                  </div>
                </div>

                <!-- Right: links + newsletter -->
                <div class="flex flex-col sm:flex-row gap-12">
                  <div class="flex flex-col gap-5">
                    <p class="text-h4 font-medium text-neutral-800">Company</p>
                    <nav class="flex flex-col gap-4 text-body text-neutral-500 leading-body">
                      <a href="#" class="hover:text-neutral-800 transition-colors">About Us</a>
                      <a href="#" class="hover:text-neutral-800 transition-colors">Careers</a>
                      <a href="#" class="hover:text-neutral-800 transition-colors">Terms of Service</a>
                      <a href="#" class="hover:text-neutral-800 transition-colors">Privacy Policy</a>
                      <a href="#" class="hover:text-neutral-800 transition-colors">Contact Us</a>
                    </nav>
                  </div>
                  <div class="flex flex-col gap-5 sm:w-80">
                    <p class="text-h4 font-medium text-neutral-800">Newsletter</p>
                    <div class="bg-neutral-50 rounded-full flex items-center pl-4 pr-1.5 py-1.5">
                      <input type="email" placeholder="Enter Your Email" class="bg-transparent text-body-sm text-neutral-500 outline-none flex-1" />
                      <button class="bg-neutral-800 hover:bg-neutral-900 rounded-full p-3 transition-colors">
                        <Icon name="ph:arrow-right" class="size-5 text-white" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <!-- ═══════════════════════════════════════
               SECTION PATTERNS
               ═══════════════════════════════════════ -->
          <section id="sections" class="scroll-mt-20 border-t border-border pt-16 pb-16">
            <div class="mb-8">
              <h2 class="text-h2 font-bold text-text-primary">Section Patterns</h2>
              <p class="mt-2 max-w-2xl text-body text-text-secondary leading-relaxed">
                Reusable page section layouts: hero, feature two-column, CTA banner, testimonial, and brand logos.
              </p>
            </div>

            <!-- Hero Section -->
            <h3 class="mb-4 text-h4 font-semibold text-text-primary">Hero Section</h3>
            <div class="mb-10 rounded-xl border border-border overflow-hidden">
              <div class="relative bg-white overflow-hidden">
                <!-- Geometric pattern background -->
                <img
                  src="/assets/hero-pattern-bg.svg"
                  alt=""
                  aria-hidden="true"
                  class="absolute inset-0 w-full h-full object-cover opacity-30 pointer-events-none select-none"
                />

                <div class="relative flex flex-col items-center px-6 sm:px-8 pt-14 sm:pt-16 pb-0 overflow-hidden">
                  <!-- Heading + description + CTA -->
                  <div class="flex flex-col items-center gap-5 text-center">
                    <h2 class="text-4xl sm:text-5xl lg:text-display font-semibold leading-tight lg:leading-display capitalize text-neutral-800 max-w-[605px]">
                      Rent Premium.<br />Deliver Smart.
                    </h2>
                    <p class="text-base sm:text-body-lg text-[var(--color-text-subtle)] leading-body max-w-[749px]">
                      Experience tech at your fingertips. Browse, rent, and receive — all from your phone with EzTech's intelligent rental platform.
                    </p>
                    <div class="flex items-center gap-2.5">
                      <button class="btn-gradient-dark rounded-full px-6 py-3 text-body-sm font-medium text-white capitalize border border-white/10">
                        Get Started
                      </button>
                      <button class="btn-glass bg-white rounded-full px-6 py-2.5 text-body-sm font-medium text-text-primary capitalize">
                        Explore Demo
                      </button>
                    </div>
                  </div>

                  <!-- Phone mockup (centered, above cards) -->
                  <div class="relative mt-10 flex justify-center z-10">
                    <img
                      src="/assets/CenterImage.png"
                      alt="EzTech app interface showing product listings"
                      class="w-56 sm:w-64 lg:w-72 h-auto drop-shadow-2xl"
                    />
                  </div>

                  <!-- Product cards row (aligned at bottom, behind phone) -->
                  <div class="absolute bottom-0 -mt-16 z-0 w-full overflow-x-clip pb-10">
                    <div class="flex items-start justify-center gap-4 px-4">
                      <!-- Card: MacBook Pro M3 -->
                      <div class="hidden lg:block w-56 shrink-0 bg-neutral-50 border border-neutral-200 rounded-lg p-4 shadow-[0_0_50px_0_rgba(0,0,0,0.1)]">
                        <div class="leading-[1.4]">
                          <p class="text-body-sm font-semibold text-neutral-800">MacBook Pro M3</p>
                          <p class="text-caption font-medium text-neutral-500">Laptop</p>
                        </div>
                        <div class="h-24 w-full my-2 bg-neutral-100 rounded-md flex items-center justify-center">
                          <Icon name="ph:laptop" class="size-12 text-neutral-300" />
                        </div>
                        <div class="flex items-center justify-between text-caption text-neutral-500">
                          <div class="flex items-center gap-1"><Icon name="ph:cpu" class="size-3.5" /><span>M3 Pro</span></div>
                          <div class="flex items-center gap-1"><Icon name="ph:hard-drives" class="size-3.5" /><span>512GB</span></div>
                          <div class="flex items-center gap-1"><Icon name="ph:memory" class="size-3.5" /><span>18GB</span></div>
                        </div>
                        <hr class="border-neutral-200 my-2" />
                        <div class="flex items-center justify-between">
                          <div class="flex items-end leading-[1.4]"><span class="text-body-sm font-semibold text-neutral-800">$25.00</span><span class="text-caption font-medium text-neutral-500">/Day</span></div>
                          <button class="bg-neutral-800 hover:bg-neutral-900 rounded-full px-3 py-1.5 text-caption font-medium text-white transition-colors">Rent Now</button>
                        </div>
                      </div>

                      <!-- Card: Sony A7 IV -->
                      <div class="hidden md:block w-56 shrink-0 bg-neutral-50 border border-neutral-200 rounded-lg p-4 shadow-[0_0_50px_0_rgba(0,0,0,0.1)]">
                        <div class="leading-[1.4]">
                          <p class="text-body-sm font-semibold text-neutral-800">Sony A7 IV</p>
                          <p class="text-caption font-medium text-neutral-500">Camera</p>
                        </div>
                        <div class="h-24 w-full my-2 bg-neutral-100 rounded-md flex items-center justify-center">
                          <Icon name="ph:camera" class="size-12 text-neutral-300" />
                        </div>
                        <div class="flex items-center justify-between text-caption text-neutral-500">
                          <div class="flex items-center gap-1"><Icon name="ph:aperture" class="size-3.5" /><span>33MP</span></div>
                          <div class="flex items-center gap-1"><Icon name="ph:film-strip" class="size-3.5" /><span>4K 60</span></div>
                          <div class="flex items-center gap-1"><Icon name="ph:crosshair" class="size-3.5" /><span>693 AF</span></div>
                        </div>
                        <hr class="border-neutral-200 my-2" />
                        <div class="flex items-center justify-between">
                          <div class="flex items-end leading-[1.4]"><span class="text-body-sm font-semibold text-neutral-800">$18.00</span><span class="text-caption font-medium text-neutral-500">/Day</span></div>
                          <button class="bg-neutral-800 hover:bg-neutral-900 rounded-full px-3 py-1.5 text-caption font-medium text-white transition-colors">Rent Now</button>
                        </div>
                      </div>

                      <!-- Card: DJI Mavic 3 -->
                      <div class="hidden md:block w-56 shrink-0 bg-neutral-50 border border-neutral-200 rounded-lg p-4 shadow-[0_0_50px_0_rgba(0,0,0,0.1)]">
                        <div class="leading-[1.4]">
                          <p class="text-body-sm font-semibold text-neutral-800">DJI Mavic 3</p>
                          <p class="text-caption font-medium text-neutral-500">Drone</p>
                        </div>
                        <div class="h-24 w-full my-2 bg-neutral-100 rounded-md flex items-center justify-center">
                          <Icon name="ph:drone" class="size-12 text-neutral-300" />
                        </div>
                        <div class="flex items-center justify-between text-caption text-neutral-500">
                          <div class="flex items-center gap-1"><Icon name="ph:timer" class="size-3.5" /><span>46min</span></div>
                          <div class="flex items-center gap-1"><Icon name="ph:video-camera" class="size-3.5" /><span>5.1K</span></div>
                          <div class="flex items-center gap-1"><Icon name="ph:wifi-high" class="size-3.5" /><span>15km</span></div>
                        </div>
                        <hr class="border-neutral-200 my-2" />
                        <div class="flex items-center justify-between">
                          <div class="flex items-end leading-[1.4]"><span class="text-body-sm font-semibold text-neutral-800">$32.00</span><span class="text-caption font-medium text-neutral-500">/Day</span></div>
                          <button class="bg-neutral-800 hover:bg-neutral-900 rounded-full px-3 py-1.5 text-caption font-medium text-white transition-colors">Rent Now</button>
                        </div>
                      </div>

                      <!-- Card: iPad Pro M2 -->
                      <div class="hidden lg:block w-56 shrink-0 bg-neutral-50 border border-neutral-200 rounded-lg p-4 shadow-[0_0_50px_0_rgba(0,0,0,0.1)]">
                        <div class="leading-[1.4]">
                          <p class="text-body-sm font-semibold text-neutral-800">iPad Pro M2</p>
                          <p class="text-caption font-medium text-neutral-500">Tablet</p>
                        </div>
                        <div class="h-24 w-full my-2 bg-neutral-100 rounded-md flex items-center justify-center">
                          <Icon name="ph:device-tablet" class="size-12 text-neutral-300" />
                        </div>
                        <div class="flex items-center justify-between text-caption text-neutral-500">
                          <div class="flex items-center gap-1"><Icon name="ph:cpu" class="size-3.5" /><span>M2</span></div>
                          <div class="flex items-center gap-1"><Icon name="ph:monitor" class="size-3.5" /><span>12.9"</span></div>
                          <div class="flex items-center gap-1"><Icon name="ph:pencil-simple" class="size-3.5" /><span>Pencil</span></div>
                        </div>
                        <hr class="border-neutral-200 my-2" />
                        <div class="flex items-center justify-between">
                          <div class="flex items-end leading-[1.4]"><span class="text-body-sm font-semibold text-neutral-800">$15.00</span><span class="text-caption font-medium text-neutral-500">/Day</span></div>
                          <button class="bg-neutral-800 hover:bg-neutral-900 rounded-full px-3 py-1.5 text-caption font-medium text-white transition-colors">Rent Now</button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Feature Two-Column Preview -->
            <h3 class="mb-4 text-h4 font-semibold text-text-primary">Feature Section (Two-Column)</h3>
            <div class="mb-10 rounded-xl border border-border overflow-hidden">
              <div class="bg-white py-16 px-8 lg:px-12">
                <div class="flex flex-col lg:flex-row items-start gap-12">
                  <!-- Left — Text + CTA -->
                  <div class="flex flex-col gap-10 lg:w-5/12 shrink-0">
                    <h2 class="text-h1 font-medium leading-heading capitalize text-text-primary">
                      Browse Smarter, Rent Faster
                    </h2>
                    <p class="text-body-lg text-neutral-500/70 leading-body">
                      From weekend projects to business trips, EzTech helps you rent premium equipment instantly — with real-time availability, seamless checkout, and smart suggestions.
                    </p>
                    <button class="btn-gradient-dark rounded-full px-6 py-3 text-body-sm font-medium text-white capitalize border border-white/10 w-fit">
                      Get Started Now
                    </button>
                  </div>

                  <!-- Right — Cards grid -->
                  <div class="flex items-center gap-4 lg:w-7/12">
                    <!-- Column 1: phone mockup + info card -->
                    <div class="flex flex-col gap-6 w-1/2">
                      <!-- Phone mockup card -->
                      <div class="relative bg-neutral-50 rounded-tl-feature w-full aspect-324/292 overflow-hidden">
                        <img
                          src="/assets/phone-mockup.png"
                          alt="EzTech app mockup"
                          class="absolute left-1/4 -top-[15%] w-3/4 h-[120%] object-cover object-top"
                        />
                      </div>
                      <!-- Active Renters card -->
                      <div class="bg-neutral-100 rounded-br-feature p-5 flex flex-col gap-3">
                        <div class="bg-neutral-200 rounded-full p-2 w-fit">
                          <Icon name="ph:users" class="size-6 text-neutral-800" />
                        </div>
                        <div class="flex flex-col gap-2">
                          <p class="text-h4 font-medium text-neutral-800 leading-heading">Active Renters</p>
                          <p class="text-body text-neutral-500 leading-body">Join thousands of users enjoying EzTech daily</p>
                        </div>
                      </div>
                    </div>

                    <!-- Column 2: stat cards -->
                    <div class="flex flex-col gap-4 w-1/2">
                      <!-- 250+ card -->
                      <div class="bg-surface-lilac rounded-tr-feature p-5 flex flex-col gap-3">
                        <p class="text-h2 font-medium text-neutral-800 leading-heading">250+</p>
                        <div class="flex flex-col gap-2">
                          <p class="text-h4 font-medium text-neutral-800 leading-heading">Products Available</p>
                          <p class="text-body text-neutral-500 leading-body">Laptops, cameras, drones, and more — ready to rent instantly.</p>
                        </div>
                      </div>
                      <!-- 40+ card -->
                      <div class="bg-surface-lavender rounded-br-feature p-5 flex flex-col gap-3">
                        <p class="text-h2 font-medium text-neutral-800 leading-heading">40+</p>
                        <div class="flex flex-col gap-2">
                          <p class="text-h4 font-medium text-neutral-800 leading-heading">Cities Covered</p>
                          <p class="text-body text-neutral-500 leading-body">Same-day delivery across major cities nationwide.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- CTA Banner -->
            <h3 class="mb-4 text-h4 font-semibold text-text-primary">CTA Banner (Dark)</h3>
            <div class="mb-10 bg-section-dark rounded-3xl py-12 flex flex-col items-center gap-6 text-center px-8">
              <div class="flex flex-col gap-3 items-center">
                <h2 class="text-h1 sm:text-[3.5rem] font-medium leading-heading text-white max-w-md">
                  Let's get your tech &mdash; delivered in style.
                </h2>
                <p class="text-body-lg font-light text-neutral-300 leading-body">
                  Join thousands of users who trust EzTech for premium, hassle-free rentals.
                </p>
              </div>
              <button class="bg-white rounded-full px-5 py-2.5 flex items-center gap-2.5 text-body font-medium text-neutral-800 hover:bg-neutral-50 transition-colors">
                Book Your Ride Now
                <Icon name="ph:arrow-right" class="size-5" />
              </button>
            </div>

            <!-- Brand Logos -->
            <h3 class="mb-4 text-h4 font-semibold text-text-primary">Brand Logos Strip</h3>
            <div class="rounded-xl border border-border bg-white py-6 px-8">
              <div class="flex items-center justify-between flex-wrap gap-6">
                <div v-for="brand in ['Zentora', 'Pulseframe', 'Nexvio', 'Cloudova', 'Quantura']" :key="brand" class="flex items-center gap-3">
                  <div class="size-5 rounded bg-neutral-300" />
                  <span class="text-[22px] sm:text-[28px] font-semibold text-neutral-400 leading-body">{{ brand }}</span>
                </div>
              </div>
            </div>
          </section>

          <!-- ═══════════════════════════════════════
               ICONS
               ═══════════════════════════════════════ -->
          <section id="icons" class="scroll-mt-20 border-t border-border pt-16 pb-16">
            <div class="mb-8">
              <h2 class="text-h2 font-bold text-text-primary">Icons</h2>
              <p class="mt-2 max-w-2xl text-body text-text-secondary leading-relaxed">
                Phosphor icons via @nuxt/icon. Common icons used across the platform.
              </p>
            </div>

            <div class="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-8">
              <div v-for="{ name: n, label } in [
                { name: 'ph:package', label: 'Package' },
                { name: 'ph:arrow-right', label: 'Arrow Right' },
                { name: 'ph:magnifying-glass', label: 'Search' },
                { name: 'ph:user', label: 'User' },
                { name: 'ph:users', label: 'Users' },
                { name: 'ph:cpu', label: 'CPU' },
                { name: 'ph:camera', label: 'Camera' },
                { name: 'ph:lightning', label: 'Lightning' },
                { name: 'ph:heart', label: 'Heart' },
                { name: 'ph:star', label: 'Star' },
                { name: 'ph:shopping-cart', label: 'Cart' },
                { name: 'ph:map-pin', label: 'Location' },
                { name: 'ph:truck', label: 'Truck' },
                { name: 'ph:download-simple', label: 'Download' },
                { name: 'ph:facebook-logo', label: 'Facebook' },
                { name: 'ph:linkedin-logo', label: 'LinkedIn' },
                { name: 'ph:x-logo', label: 'X / Twitter' },
                { name: 'ph:sparkle', label: 'Sparkle' },
                { name: 'ph:device-mobile', label: 'Mobile' },
                { name: 'ph:check-circle', label: 'Check' },
                { name: 'ph:warning', label: 'Warning' },
                { name: 'ph:info', label: 'Info' },
                { name: 'ph:x-circle', label: 'Error' },
                { name: 'ph:gear', label: 'Settings' },
              ]" :key="n" class="flex flex-col items-center gap-2 rounded-xl border border-border bg-white p-3 text-center hover:border-primary-300 hover:bg-primary-50/50 hover:shadow-sm transition-all group">
                <Icon :name="n" class="size-6 text-text-secondary group-hover:text-primary-500 transition-colors" />
                <span class="text-caption text-text-muted leading-tight">{{ label }}</span>
              </div>
            </div>

            <!-- Icon sizes -->
            <h3 class="mt-10 mb-4 text-h4 font-semibold text-text-primary">Icon Sizes</h3>
            <div class="flex items-end gap-8 rounded-xl border border-border p-6">
              <div class="flex flex-col items-center gap-2">
                <Icon name="ph:package" class="size-4 text-text-secondary" />
                <code class="text-caption text-text-muted font-mono">size-4</code>
                <span class="text-caption text-text-muted">16px</span>
              </div>
              <div class="flex flex-col items-center gap-2">
                <Icon name="ph:package" class="size-5 text-text-secondary" />
                <code class="text-caption text-text-muted font-mono">size-5</code>
                <span class="text-caption text-text-muted">20px</span>
              </div>
              <div class="flex flex-col items-center gap-2">
                <Icon name="ph:package" class="size-6 text-text-secondary" />
                <code class="text-caption text-text-muted font-mono">size-6</code>
                <span class="text-caption text-text-muted">24px</span>
              </div>
              <div class="flex flex-col items-center gap-2">
                <Icon name="ph:package" class="size-8 text-text-secondary" />
                <code class="text-caption text-text-muted font-mono">size-8</code>
                <span class="text-caption text-text-muted">32px</span>
              </div>
              <div class="flex flex-col items-center gap-2">
                <Icon name="ph:package" class="size-12 text-text-secondary" />
                <code class="text-caption text-text-muted font-mono">size-12</code>
                <span class="text-caption text-text-muted">48px</span>
              </div>
            </div>
          </section>

        </div>
      </main>
    </div>
  </div>
</template>
