<script setup lang="ts">
/**
 * Curepath Design System Showcase
 *
 * A comprehensive, self-contained design system reference page that documents
 * all tokens, components, and patterns used across the Curepath healthcare app.
 *
 * Uses pure Tailwind CSS classes mapped to the project's @theme tokens.
 * No shadcn-vue component imports -- all elements are native HTML styled with Tailwind.
 */

useHead({
  title: 'Curepath Design System',
  meta: [
    { name: 'description', content: 'Curepath healthcare app design system reference' },
  ],
})

const sections = [
  { id: 'colors', label: 'Colors' },
  { id: 'typography', label: 'Typography' },
  { id: 'spacing', label: 'Spacing' },
  { id: 'buttons', label: 'Buttons' },
  { id: 'cards', label: 'Cards' },
  { id: 'forms', label: 'Form Elements' },
  { id: 'badges', label: 'Badges & Pills' },
  { id: 'navigation', label: 'Navigation' },
  { id: 'icons', label: 'Icons' },
  { id: 'layout', label: 'Layout Patterns' },
  { id: 'shadows', label: 'Shadows & Borders' },
  { id: 'cta-banner', label: 'CTA Banner' },
]

const activeSection = ref('colors')

function scrollToSection(id: string) {
  activeSection.value = id
  const el = document.getElementById(id)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

// Track scroll position to highlight active sidebar item
function handleScroll() {
  const scrollContainer = document.getElementById('ds-content')
  if (!scrollContainer) return

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

onMounted(() => {
  window.addEventListener('scroll', handleScroll, { passive: true })
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
})

// ── Inline child components (using h() render functions) ────────────

const SectionHeading = defineComponent({
  name: 'SectionHeading',
  props: {
    title: { type: String, required: true },
    description: { type: String, required: true },
  },
  setup(props) {
    return () => h('div', { class: 'mb-8' }, [
      h('h2', { class: 'text-h2 font-bold text-text-primary' }, props.title),
      h('p', { class: 'mt-2 max-w-2xl text-body text-text-secondary leading-body' }, props.description),
    ])
  },
})

const ColorSwatch = defineComponent({
  name: 'ColorSwatch',
  props: {
    label: { type: String, required: true },
    hex: { type: String, required: true },
    cssClass: { type: String, required: true },
    dark: { type: Boolean, default: false },
    border: { type: Boolean, default: false },
  },
  setup(props) {
    return () => h('div', { class: ['overflow-hidden rounded-xl', props.border ? 'border border-border' : ''] }, [
      h('div', { class: ['h-16', props.cssClass] }),
      h('div', { class: 'bg-white p-2 border-t border-neutral-100' }, [
        h('p', { class: 'text-caption font-semibold text-text-primary' }, props.label),
        h('p', { class: 'text-caption text-text-muted font-mono' }, props.hex),
      ]),
    ])
  },
})

const TypographyRow = defineComponent({
  name: 'TypographyRow',
  props: {
    label: { type: String, required: true },
    cssClass: { type: String, required: true },
    size: { type: String, required: true },
    leading: { type: String, required: true },
    sample: { type: String, required: true },
    isHeading: { type: Boolean, default: true },
  },
  setup(props) {
    return () => h('div', { class: 'rounded-xl border border-border p-5' }, [
      h('div', { class: 'mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1' }, [
        h('span', { class: 'text-body-sm font-semibold text-primary-500' }, props.label),
        h('code', { class: 'text-caption font-mono text-text-muted' }, props.cssClass),
        h('span', { class: 'text-caption text-text-muted' }, props.size),
        h('span', { class: 'text-caption text-text-muted' }, `line-height: ${props.leading}`),
      ]),
      h(props.isHeading ? 'h3' : 'p', {
        class: [props.cssClass, props.isHeading ? 'font-bold text-text-primary' : 'text-text-secondary'],
        style: { lineHeight: props.leading },
      }, props.sample),
    ])
  },
})

const SpacingRow = defineComponent({
  name: 'SpacingRow',
  props: {
    token: { type: String, required: true },
    value: { type: String, required: true },
    cssClass: { type: String, required: true },
  },
  setup(props) {
    return () => h('div', { class: 'flex items-center gap-4 rounded-lg border border-border px-4 py-3' }, [
      h('code', { class: 'w-20 flex-shrink-0 text-body-sm font-semibold text-primary-500 font-mono' }, props.token),
      h('div', { class: ['h-6 rounded-md bg-primary-400', props.cssClass] }),
      h('span', { class: 'ml-auto flex-shrink-0 text-caption text-text-muted font-mono' }, props.value),
    ])
  },
})

const IconSwatch = defineComponent({
  name: 'IconSwatch',
  props: {
    name: { type: String, required: true },
    label: { type: String, required: true },
  },
  setup(props) {
    const IconComponent = resolveComponent('Icon')
    return () => h('div', { class: 'flex flex-col items-center gap-2 rounded-xl border border-border bg-white p-3 text-center transition-all hover:border-primary-200 hover:shadow-sm' }, [
      h(IconComponent, { name: props.name, class: 'h-6 w-6 text-text-secondary' }),
      h('span', { class: 'text-caption text-text-muted leading-tight' }, props.label),
    ])
  },
})
</script>

<template>
  <div class="min-h-screen bg-background font-sans text-foreground">
    <!-- Top Header Bar -->
    <header
      class="fixed top-0 left-0 right-0 z-50 flex items-center gap-4 border-b border-border bg-white/80 backdrop-blur-md px-6 py-3"
    >
      <div class="flex items-center gap-3">
        <div
          class="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-500 text-white font-bold text-body-sm"
        >
          C
        </div>
        <div>
          <h1 class="text-body font-bold text-text-primary leading-tight">
            Curepath
          </h1>
          <p class="text-caption text-text-muted leading-tight">
            Design System v1.0
          </p>
        </div>
      </div>
      <div class="ml-auto flex items-center gap-4">
        <NuxtLink
          to="/"
          class="text-body-sm text-text-secondary hover:text-primary-500 transition-colors"
        >
          Back to Home
        </NuxtLink>
        <a
          href="#colors"
          class="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-3 py-1.5 text-caption font-medium text-primary-600"
        >
          <Icon name="ph:palette" class="h-3.5 w-3.5" />
          12 Sections
        </a>
      </div>
    </header>

    <div class="flex pt-[60px]">
      <!-- Sidebar Navigation -->
      <nav
        class="fixed left-0 top-[60px] bottom-0 z-40 hidden w-60 flex-col gap-1 overflow-y-auto border-r border-border bg-white px-3 py-4 lg:flex"
        aria-label="Design system sections"
      >
        <p class="mb-2 px-3 text-caption font-semibold uppercase tracking-wider text-text-muted">
          Sections
        </p>
        <button
          v-for="section in sections"
          :key="section.id"
          :class="[
            'flex items-center gap-2 rounded-lg px-3 py-2 text-body-sm font-medium transition-all text-left',
            activeSection === section.id
              ? 'bg-primary-50 text-primary-600'
              : 'text-text-secondary hover:bg-neutral-50 hover:text-text-primary',
          ]"
          @click="scrollToSection(section.id)"
        >
          <span
            :class="[
              'h-1.5 w-1.5 rounded-full transition-colors',
              activeSection === section.id ? 'bg-primary-500' : 'bg-neutral-300',
            ]"
          />
          {{ section.label }}
        </button>

        <div class="mt-auto border-t border-border pt-4 px-3">
          <p class="text-caption text-text-muted">
            Built with Tailwind CSS v4 + Nuxt 3
          </p>
        </div>
      </nav>

      <!-- Main Content -->
      <main
        id="ds-content"
        class="min-h-screen flex-1 lg:ml-60"
      >
        <!-- Hero -->
        <div class="relative overflow-hidden bg-gradient-to-br from-primary-500 via-primary-600 to-accent-500 px-8 py-16 text-white sm:px-12 sm:py-20">
          <!-- Decorative circles matching Figma CTA pattern -->
          <div class="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-white/10" />
          <div class="pointer-events-none absolute -bottom-16 -left-16 h-64 w-64 rounded-full bg-white/5" />
          <div class="pointer-events-none absolute right-1/4 top-1/3 h-32 w-32 rounded-full bg-white/5" />

          <div class="relative max-w-3xl">
            <span class="mb-4 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-caption font-medium backdrop-blur-sm">
              <Icon name="ph:sparkle" class="h-3.5 w-3.5" />
              Healthcare Design System
            </span>
            <h1 class="text-display font-bold leading-display tracking-tight">
              Curepath<br />Design System
            </h1>
            <p class="mt-4 max-w-lg text-body-lg leading-body text-white/80">
              A comprehensive reference for all visual tokens, components, and patterns
              used across the Curepath healthcare platform.
            </p>
          </div>
        </div>

        <div class="mx-auto max-w-5xl px-6 py-12 sm:px-8">
          <!-- =================================================================
               SECTION: Color Palette
               ================================================================= -->
          <section id="colors" class="scroll-mt-20 pb-16">
            <SectionHeading title="Color Palette" description="All brand, semantic, and neutral colors with their Tailwind classes and hex values." />

            <!-- Primary -->
            <h3 class="mb-3 text-h4 font-semibold text-text-primary">Primary &mdash; Purple</h3>
            <p class="mb-4 text-body-sm text-text-muted">
              Main brand color used for CTAs, links, and interactive elements.
            </p>
            <div class="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-5 lg:grid-cols-10">
              <ColorSwatch label="50" hex="#F5F3FF" css-class="bg-primary-50" />
              <ColorSwatch label="100" hex="#EDE9FE" css-class="bg-primary-100" />
              <ColorSwatch label="200" hex="#DDD6FE" css-class="bg-primary-200" />
              <ColorSwatch label="300" hex="#C4B5FD" css-class="bg-primary-300" />
              <ColorSwatch label="400" hex="#A78BFA" css-class="bg-primary-400" />
              <ColorSwatch label="500" hex="#8B5CF6" css-class="bg-primary-500" dark />
              <ColorSwatch label="600" hex="#7C3AED" css-class="bg-primary-600" dark />
              <ColorSwatch label="700" hex="#6D28D9" css-class="bg-primary-700" dark />
              <ColorSwatch label="800" hex="#5B21B6" css-class="bg-primary-800" dark />
              <ColorSwatch label="900" hex="#4C1D95" css-class="bg-primary-900" dark />
            </div>

            <!-- Accent -->
            <h3 class="mb-3 text-h4 font-semibold text-text-primary">Accent &mdash; Blue</h3>
            <p class="mb-4 text-body-sm text-text-muted">
              Secondary brand color for supporting UI accents and highlights.
            </p>
            <div class="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-5 lg:grid-cols-9">
              <ColorSwatch label="100" hex="#E4E4FF" css-class="bg-accent-100" />
              <ColorSwatch label="200" hex="#C6C6FF" css-class="bg-accent-200" />
              <ColorSwatch label="300" hex="#A8A8FF" css-class="bg-accent-300" />
              <ColorSwatch label="400" hex="#7272FF" css-class="bg-accent-400" dark />
              <ColorSwatch label="500" hex="#6366F1" css-class="bg-accent-500" dark />
              <ColorSwatch label="600" hex="#4F46E5" css-class="bg-accent-600" dark />
              <ColorSwatch label="700" hex="#4338CA" css-class="bg-accent-700" dark />
              <ColorSwatch label="800" hex="#3730A3" css-class="bg-accent-800" dark />
              <ColorSwatch label="900" hex="#312E81" css-class="bg-accent-900" dark />
            </div>

            <!-- Neutral -->
            <h3 class="mb-3 text-h4 font-semibold text-text-primary">Neutral &mdash; Gray</h3>
            <p class="mb-4 text-body-sm text-text-muted">
              Used for text, borders, backgrounds, and structural elements.
            </p>
            <div class="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-5 lg:grid-cols-10">
              <ColorSwatch label="50" hex="#F9FAFB" css-class="bg-neutral-50" border />
              <ColorSwatch label="100" hex="#F3F4F6" css-class="bg-neutral-100" />
              <ColorSwatch label="200" hex="#E5E7EB" css-class="bg-neutral-200" />
              <ColorSwatch label="300" hex="#D1D5DB" css-class="bg-neutral-300" />
              <ColorSwatch label="400" hex="#9CA3AF" css-class="bg-neutral-400" />
              <ColorSwatch label="500" hex="#6B7280" css-class="bg-neutral-500" dark />
              <ColorSwatch label="600" hex="#4B5563" css-class="bg-neutral-600" dark />
              <ColorSwatch label="700" hex="#374151" css-class="bg-neutral-700" dark />
              <ColorSwatch label="800" hex="#1F2937" css-class="bg-neutral-800" dark />
              <ColorSwatch label="900" hex="#111827" css-class="bg-neutral-900" dark />
            </div>

            <!-- Semantic -->
            <h3 class="mb-3 text-h4 font-semibold text-text-primary">Semantic</h3>
            <p class="mb-4 text-body-sm text-text-muted">
              Feedback colors for success states, warnings, errors, and informational messages.
            </p>
            <div class="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div class="overflow-hidden rounded-xl border border-border">
                <div class="h-20 bg-success" />
                <div class="p-3">
                  <p class="text-body-sm font-semibold text-text-primary">Success</p>
                  <p class="text-caption text-text-muted">#10B981</p>
                  <code class="text-caption text-primary-500">bg-success</code>
                </div>
              </div>
              <div class="overflow-hidden rounded-xl border border-border">
                <div class="h-20 bg-warning" />
                <div class="p-3">
                  <p class="text-body-sm font-semibold text-text-primary">Warning</p>
                  <p class="text-caption text-text-muted">#F59E0B</p>
                  <code class="text-caption text-primary-500">bg-warning</code>
                </div>
              </div>
              <div class="overflow-hidden rounded-xl border border-border">
                <div class="h-20 bg-error" />
                <div class="p-3">
                  <p class="text-body-sm font-semibold text-text-primary">Error</p>
                  <p class="text-caption text-text-muted">#EF4444</p>
                  <code class="text-caption text-primary-500">bg-error</code>
                </div>
              </div>
              <div class="overflow-hidden rounded-xl border border-border">
                <div class="h-20 bg-info" />
                <div class="p-3">
                  <p class="text-body-sm font-semibold text-text-primary">Info</p>
                  <p class="text-caption text-text-muted">#3B82F6</p>
                  <code class="text-caption text-primary-500">bg-info</code>
                </div>
              </div>
            </div>

            <!-- Text & Background Colors -->
            <h3 class="mb-3 text-h4 font-semibold text-text-primary">Text & Background</h3>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div class="rounded-xl border border-border p-4">
                <p class="text-body font-semibold text-text-primary">Primary Text</p>
                <p class="text-caption text-text-muted">#262730</p>
                <code class="text-caption text-primary-500">text-text-primary</code>
              </div>
              <div class="rounded-xl border border-border p-4">
                <p class="text-body font-semibold text-text-secondary">Secondary Text</p>
                <p class="text-caption text-text-muted">#4B5563</p>
                <code class="text-caption text-primary-500">text-text-secondary</code>
              </div>
              <div class="rounded-xl border border-border p-4">
                <p class="text-body font-semibold text-text-muted">Muted Text</p>
                <p class="text-caption text-text-muted">#6B7280</p>
                <code class="text-caption text-primary-500">text-text-muted</code>
              </div>
              <div class="rounded-xl border border-border bg-neutral-800 p-4">
                <p class="text-body font-semibold text-text-inverse">Inverse Text</p>
                <p class="text-caption text-neutral-400">#FFFFFF</p>
                <code class="text-caption text-primary-300">text-text-inverse</code>
              </div>
            </div>
          </section>

          <!-- =================================================================
               SECTION: Typography
               ================================================================= -->
          <section id="typography" class="scroll-mt-20 border-t border-border pt-16 pb-16">
            <SectionHeading title="Typography" description="Type scale using the Inter typeface. All sizes map to custom --text-* tokens." />

            <div class="space-y-8">
              <TypographyRow
                label="Display"
                css-class="text-display"
                size="4rem / 64px"
                leading="1.1"
                sample="Healthcare Made Effortless"
              />
              <TypographyRow
                label="H1"
                css-class="text-h1"
                size="3rem / 48px"
                leading="1.2"
                sample="Book Your Appointment"
              />
              <TypographyRow
                label="H2"
                css-class="text-h2"
                size="2.25rem / 36px"
                leading="1.2"
                sample="Our Medical Specialists"
              />
              <TypographyRow
                label="H3"
                css-class="text-h3"
                size="1.5rem / 24px"
                leading="1.2"
                sample="Patient Dashboard Overview"
              />
              <TypographyRow
                label="H4"
                css-class="text-h4"
                size="1.25rem / 20px"
                leading="1.2"
                sample="Upcoming Appointments"
              />
              <TypographyRow
                label="Body Large"
                css-class="text-body-lg"
                size="1.125rem / 18px"
                leading="1.6"
                sample="We connect patients with qualified healthcare professionals for seamless medical consultations."
                :is-heading="false"
              />
              <TypographyRow
                label="Body"
                css-class="text-body"
                size="1rem / 16px"
                leading="1.6"
                sample="Schedule appointments, manage prescriptions, and access your health records all in one place."
                :is-heading="false"
              />
              <TypographyRow
                label="Body Small"
                css-class="text-body-sm"
                size="0.875rem / 14px"
                leading="1.6"
                sample="Last updated 5 minutes ago. Your next appointment is on Monday at 2:00 PM."
                :is-heading="false"
              />
              <TypographyRow
                label="Caption"
                css-class="text-caption"
                size="0.75rem / 12px"
                leading="1.6"
                sample="Terms and conditions apply. Consult your physician for medical advice."
                :is-heading="false"
              />
            </div>

            <!-- Font Families -->
            <h3 class="mt-12 mb-4 text-h4 font-semibold text-text-primary">Font Families</h3>
            <div class="grid gap-4 sm:grid-cols-3">
              <div class="rounded-xl border border-border p-5">
                <p class="mb-1 text-caption font-medium uppercase tracking-wider text-text-muted">Sans / UI</p>
                <p class="font-sans text-h3 text-text-primary">Inter</p>
                <p class="mt-2 font-sans text-body-sm text-text-secondary">ABCDEFGHIJKLMNOPQRSTUVWXYZ</p>
                <p class="font-sans text-body-sm text-text-secondary">abcdefghijklmnopqrstuvwxyz</p>
                <p class="font-sans text-body-sm text-text-secondary">0123456789</p>
                <code class="mt-2 inline-block text-caption text-primary-500">font-sans</code>
              </div>
              <div class="rounded-xl border border-border p-5">
                <p class="mb-1 text-caption font-medium uppercase tracking-wider text-text-muted">Heading</p>
                <p class="font-heading text-h3 text-text-primary">Inter</p>
                <p class="mt-2 font-heading text-body-sm font-bold text-text-secondary">Bold weight for headings</p>
                <p class="font-heading text-body-sm font-semibold text-text-secondary">Semibold for subheadings</p>
                <p class="font-heading text-body-sm font-medium text-text-secondary">Medium for labels</p>
                <code class="mt-2 inline-block text-caption text-primary-500">font-heading</code>
              </div>
              <div class="rounded-xl border border-border p-5">
                <p class="mb-1 text-caption font-medium uppercase tracking-wider text-text-muted">Monospace</p>
                <p class="font-mono text-h3 text-text-primary">JetBrains</p>
                <p class="mt-2 font-mono text-body-sm text-text-secondary">const health = "good";</p>
                <p class="font-mono text-body-sm text-text-secondary">bg-primary-500</p>
                <p class="font-mono text-body-sm text-text-secondary">--color-ring</p>
                <code class="mt-2 inline-block font-mono text-caption text-primary-500">font-mono</code>
              </div>
            </div>
          </section>

          <!-- =================================================================
               SECTION: Spacing
               ================================================================= -->
          <section id="spacing" class="scroll-mt-20 border-t border-border pt-16 pb-16">
            <SectionHeading title="Spacing Scale" description="Consistent spacing tokens used for padding, margins, and gaps." />

            <div class="space-y-3">
              <SpacingRow token="xs" value="0.25rem / 4px" css-class="w-[var(--ds-space-xs)]" />
              <SpacingRow token="sm" value="0.5rem / 8px" css-class="w-[var(--ds-space-sm)]" />
              <SpacingRow token="md" value="1rem / 16px" css-class="w-[var(--ds-space-md)]" />
              <SpacingRow token="lg" value="1.5rem / 24px" css-class="w-[var(--ds-space-lg)]" />
              <SpacingRow token="xl" value="2rem / 32px" css-class="w-[var(--ds-space-xl)]" />
              <SpacingRow token="2xl" value="3rem / 48px" css-class="w-[var(--ds-space-2xl)]" />
              <SpacingRow token="3xl" value="4rem / 64px" css-class="w-[var(--ds-space-3xl)]" />
              <SpacingRow token="4xl" value="6rem / 96px" css-class="w-[var(--ds-space-4xl)]" />
              <SpacingRow token="section" value="5rem / 80px" css-class="w-[var(--ds-space-section)]" />
            </div>
          </section>

          <!-- =================================================================
               SECTION: Buttons
               ================================================================= -->
          <section id="buttons" class="scroll-mt-20 border-t border-border pt-16 pb-16">
            <SectionHeading title="Buttons" description="Button variants for primary actions, secondary controls, and utilities." />

            <!-- Primary Buttons -->
            <h3 class="mb-4 text-h4 font-semibold text-text-primary">Primary</h3>
            <div class="mb-8 flex flex-wrap items-center gap-3">
              <button
                type="button"
                class="inline-flex items-center justify-center gap-2 rounded-full bg-primary-500 px-6 py-2.5 text-body-sm font-medium text-white shadow-sm transition-all hover:bg-primary-600 hover:shadow-md active:bg-primary-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
              >
                Get Started
              </button>
              <button
                type="button"
                class="inline-flex items-center justify-center gap-2 rounded-full bg-primary-500 px-6 py-2.5 text-body-sm font-medium text-white shadow-sm transition-all hover:bg-primary-600 hover:shadow-md active:bg-primary-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
              >
                Book Appointment
                <Icon name="ph:arrow-right" class="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled
                class="inline-flex items-center justify-center gap-2 rounded-full bg-primary-300 px-6 py-2.5 text-body-sm font-medium text-white cursor-not-allowed opacity-60"
              >
                Disabled
              </button>
            </div>

            <!-- Secondary Buttons -->
            <h3 class="mb-4 text-h4 font-semibold text-text-primary">Secondary / Outline</h3>
            <div class="mb-8 flex flex-wrap items-center gap-3">
              <button
                type="button"
                class="inline-flex items-center justify-center gap-2 rounded-full border-2 border-primary-500 bg-transparent px-6 py-2.5 text-body-sm font-medium text-primary-500 transition-all hover:bg-primary-50 active:bg-primary-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
              >
                Learn More
              </button>
              <button
                type="button"
                class="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-white px-6 py-2.5 text-body-sm font-medium text-text-primary shadow-sm transition-all hover:bg-neutral-50 active:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
              >
                <Icon name="ph:calendar" class="h-4 w-4" />
                View Schedule
              </button>
              <button
                type="button"
                class="inline-flex items-center justify-center gap-2 rounded-full border border-neutral-300 bg-transparent px-6 py-2.5 text-body-sm font-medium text-text-secondary transition-all hover:bg-neutral-50 active:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
              >
                Cancel
              </button>
            </div>

            <!-- Ghost & Link -->
            <h3 class="mb-4 text-h4 font-semibold text-text-primary">Ghost & Link</h3>
            <div class="mb-8 flex flex-wrap items-center gap-3">
              <button
                type="button"
                class="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-body-sm font-medium text-text-secondary transition-all hover:bg-neutral-100 active:bg-neutral-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
              >
                Ghost Button
              </button>
              <button
                type="button"
                class="inline-flex items-center gap-1 text-body-sm font-medium text-primary-500 underline-offset-4 transition-all hover:underline hover:text-primary-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
              >
                Link Button
                <Icon name="ph:arrow-right" class="h-3.5 w-3.5" />
              </button>
            </div>

            <!-- Destructive -->
            <h3 class="mb-4 text-h4 font-semibold text-text-primary">Destructive</h3>
            <div class="mb-8 flex flex-wrap items-center gap-3">
              <button
                type="button"
                class="inline-flex items-center justify-center gap-2 rounded-full bg-error px-6 py-2.5 text-body-sm font-medium text-white shadow-sm transition-all hover:bg-red-600 active:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error"
              >
                Delete Account
              </button>
              <button
                type="button"
                class="inline-flex items-center justify-center gap-2 rounded-full border border-error bg-transparent px-6 py-2.5 text-body-sm font-medium text-error transition-all hover:bg-red-50 active:bg-red-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error"
              >
                Cancel Appointment
              </button>
            </div>

            <!-- Icon Buttons -->
            <h3 class="mb-4 text-h4 font-semibold text-text-primary">Icon Buttons</h3>
            <div class="mb-8 flex flex-wrap items-center gap-3">
              <button
                type="button"
                aria-label="Notifications"
                class="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary-500 text-white shadow-sm transition-all hover:bg-primary-600 active:bg-primary-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
              >
                <Icon name="ph:bell" class="h-5 w-5" />
              </button>
              <button
                type="button"
                aria-label="Settings"
                class="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-white text-text-secondary shadow-sm transition-all hover:bg-neutral-50 active:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
              >
                <Icon name="ph:gear-six" class="h-5 w-5" />
              </button>
              <button
                type="button"
                aria-label="Close"
                class="inline-flex h-10 w-10 items-center justify-center rounded-full text-text-muted transition-all hover:bg-neutral-100 active:bg-neutral-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
              >
                <Icon name="ph:x" class="h-5 w-5" />
              </button>
              <button
                type="button"
                aria-label="Favorite"
                class="inline-flex h-10 w-10 items-center justify-center rounded-full text-error transition-all hover:bg-red-50 active:bg-red-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error"
              >
                <Icon name="ph:heart-fill" class="h-5 w-5" />
              </button>
            </div>

            <!-- Sizes -->
            <h3 class="mb-4 text-h4 font-semibold text-text-primary">Sizes</h3>
            <div class="flex flex-wrap items-center gap-3">
              <button
                type="button"
                class="inline-flex items-center justify-center rounded-full bg-primary-500 px-3.5 py-1.5 text-caption font-medium text-white transition-all hover:bg-primary-600"
              >
                Small
              </button>
              <button
                type="button"
                class="inline-flex items-center justify-center rounded-full bg-primary-500 px-6 py-2.5 text-body-sm font-medium text-white transition-all hover:bg-primary-600"
              >
                Default
              </button>
              <button
                type="button"
                class="inline-flex items-center justify-center rounded-full bg-primary-500 px-8 py-3.5 text-body font-medium text-white transition-all hover:bg-primary-600"
              >
                Large
              </button>
            </div>
          </section>

          <!-- =================================================================
               SECTION: Cards
               ================================================================= -->
          <section id="cards" class="scroll-mt-20 border-t border-border pt-16 pb-16">
            <SectionHeading title="Cards" description="Card patterns used throughout the Curepath interface." />

            <!-- Basic Card -->
            <h3 class="mb-4 text-h4 font-semibold text-text-primary">Basic Card</h3>
            <div class="mb-10 max-w-md">
              <div class="rounded-2xl border border-border bg-white p-6 shadow-sm">
                <h4 class="text-h4 font-semibold text-text-primary">Card Title</h4>
                <p class="mt-2 text-body-sm text-text-secondary leading-body">
                  This is a basic card component with a subtle border and shadow.
                  It uses rounded-2xl corners matching the Figma design patterns.
                </p>
                <div class="mt-4 flex gap-3">
                  <button type="button" class="rounded-full bg-primary-500 px-4 py-2 text-body-sm font-medium text-white transition hover:bg-primary-600">
                    Action
                  </button>
                  <button type="button" class="rounded-full border border-border px-4 py-2 text-body-sm font-medium text-text-secondary transition hover:bg-neutral-50">
                    Secondary
                  </button>
                </div>
              </div>
            </div>

            <!-- Feature Cards (2x2 Grid) -->
            <h3 class="mb-4 text-h4 font-semibold text-text-primary">Feature Cards</h3>
            <p class="mb-4 text-body-sm text-text-muted">Matching the Figma 2x2 feature grid pattern with icon, title, and description.</p>
            <div class="mb-10 grid gap-6 sm:grid-cols-2">
              <div class="group rounded-2xl border border-border bg-white p-6 shadow-sm transition-all hover:shadow-md hover:border-primary-200">
                <div class="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-primary-500 transition-colors group-hover:bg-primary-100">
                  <Icon name="ph:calendar-check" class="h-6 w-6" />
                </div>
                <h4 class="text-h4 font-semibold text-text-primary">Easy Scheduling</h4>
                <p class="mt-2 text-body-sm text-text-secondary leading-body">
                  Book appointments instantly with your preferred healthcare provider at a time that suits you.
                </p>
              </div>
              <div class="group rounded-2xl border border-border bg-white p-6 shadow-sm transition-all hover:shadow-md hover:border-primary-200">
                <div class="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent-100 text-accent-500 transition-colors group-hover:bg-accent-200">
                  <Icon name="ph:video-camera" class="h-6 w-6" />
                </div>
                <h4 class="text-h4 font-semibold text-text-primary">Video Consultations</h4>
                <p class="mt-2 text-body-sm text-text-secondary leading-body">
                  Connect face-to-face with doctors through secure, high-quality video calls from anywhere.
                </p>
              </div>
              <div class="group rounded-2xl border border-border bg-white p-6 shadow-sm transition-all hover:shadow-md hover:border-primary-200">
                <div class="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-green-50 text-success transition-colors group-hover:bg-green-100">
                  <Icon name="ph:prescription" class="h-6 w-6" />
                </div>
                <h4 class="text-h4 font-semibold text-text-primary">Digital Prescriptions</h4>
                <p class="mt-2 text-body-sm text-text-secondary leading-body">
                  Receive and manage prescriptions digitally. Send them directly to your preferred pharmacy.
                </p>
              </div>
              <div class="group rounded-2xl border border-border bg-white p-6 shadow-sm transition-all hover:shadow-md hover:border-primary-200">
                <div class="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-warning transition-colors group-hover:bg-amber-100">
                  <Icon name="ph:shield-check" class="h-6 w-6" />
                </div>
                <h4 class="text-h4 font-semibold text-text-primary">Secure Records</h4>
                <p class="mt-2 text-body-sm text-text-secondary leading-body">
                  Your health data is encrypted and protected with enterprise-grade security standards.
                </p>
              </div>
            </div>

            <!-- Doctor Card -->
            <h3 class="mb-4 text-h4 font-semibold text-text-primary">Doctor Card</h3>
            <div class="mb-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <div class="overflow-hidden rounded-2xl border border-border bg-white shadow-sm transition-all hover:shadow-md">
                <div class="flex h-40 items-center justify-center bg-gradient-to-br from-primary-100 to-primary-50">
                  <div class="flex h-20 w-20 items-center justify-center rounded-full bg-primary-200 text-primary-600">
                    <Icon name="ph:user" class="h-10 w-10" />
                  </div>
                </div>
                <div class="p-5">
                  <span class="inline-block rounded-full bg-primary-50 px-2.5 py-0.5 text-caption font-medium text-primary-600">Cardiologist</span>
                  <h4 class="mt-2 text-body-lg font-semibold text-text-primary">Dr. Sarah Johnson</h4>
                  <p class="mt-1 text-body-sm text-text-muted">15 years experience</p>
                  <div class="mt-3 flex items-center gap-1 text-warning">
                    <Icon name="ph:star-fill" class="h-4 w-4" />
                    <Icon name="ph:star-fill" class="h-4 w-4" />
                    <Icon name="ph:star-fill" class="h-4 w-4" />
                    <Icon name="ph:star-fill" class="h-4 w-4" />
                    <Icon name="ph:star-half-fill" class="h-4 w-4" />
                    <span class="ml-1 text-body-sm font-medium text-text-secondary">4.8</span>
                  </div>
                  <button type="button" class="mt-4 w-full rounded-full bg-primary-500 py-2.5 text-body-sm font-medium text-white transition hover:bg-primary-600">
                    Book Appointment
                  </button>
                </div>
              </div>

              <div class="overflow-hidden rounded-2xl border border-border bg-white shadow-sm transition-all hover:shadow-md">
                <div class="flex h-40 items-center justify-center bg-gradient-to-br from-accent-100 to-accent-100/40">
                  <div class="flex h-20 w-20 items-center justify-center rounded-full bg-accent-200 text-accent-600">
                    <Icon name="ph:user" class="h-10 w-10" />
                  </div>
                </div>
                <div class="p-5">
                  <span class="inline-block rounded-full bg-accent-100 px-2.5 py-0.5 text-caption font-medium text-accent-600">Neurologist</span>
                  <h4 class="mt-2 text-body-lg font-semibold text-text-primary">Dr. Michael Chen</h4>
                  <p class="mt-1 text-body-sm text-text-muted">12 years experience</p>
                  <div class="mt-3 flex items-center gap-1 text-warning">
                    <Icon name="ph:star-fill" class="h-4 w-4" />
                    <Icon name="ph:star-fill" class="h-4 w-4" />
                    <Icon name="ph:star-fill" class="h-4 w-4" />
                    <Icon name="ph:star-fill" class="h-4 w-4" />
                    <Icon name="ph:star-fill" class="h-4 w-4" />
                    <span class="ml-1 text-body-sm font-medium text-text-secondary">5.0</span>
                  </div>
                  <button type="button" class="mt-4 w-full rounded-full bg-primary-500 py-2.5 text-body-sm font-medium text-white transition hover:bg-primary-600">
                    Book Appointment
                  </button>
                </div>
              </div>

              <div class="overflow-hidden rounded-2xl border border-border bg-white shadow-sm transition-all hover:shadow-md">
                <div class="flex h-40 items-center justify-center bg-gradient-to-br from-green-100 to-green-50">
                  <div class="flex h-20 w-20 items-center justify-center rounded-full bg-green-200 text-green-600">
                    <Icon name="ph:user" class="h-10 w-10" />
                  </div>
                </div>
                <div class="p-5">
                  <span class="inline-block rounded-full bg-green-50 px-2.5 py-0.5 text-caption font-medium text-green-600">Dermatologist</span>
                  <h4 class="mt-2 text-body-lg font-semibold text-text-primary">Dr. Emily Park</h4>
                  <p class="mt-1 text-body-sm text-text-muted">8 years experience</p>
                  <div class="mt-3 flex items-center gap-1 text-warning">
                    <Icon name="ph:star-fill" class="h-4 w-4" />
                    <Icon name="ph:star-fill" class="h-4 w-4" />
                    <Icon name="ph:star-fill" class="h-4 w-4" />
                    <Icon name="ph:star-fill" class="h-4 w-4" />
                    <Icon name="ph:star" class="h-4 w-4 text-neutral-300" />
                    <span class="ml-1 text-body-sm font-medium text-text-secondary">4.6</span>
                  </div>
                  <button type="button" class="mt-4 w-full rounded-full bg-primary-500 py-2.5 text-body-sm font-medium text-white transition hover:bg-primary-600">
                    Book Appointment
                  </button>
                </div>
              </div>
            </div>

            <!-- Appointment Card -->
            <h3 class="mb-4 text-h4 font-semibold text-text-primary">Appointment Card</h3>
            <div class="max-w-lg">
              <div class="rounded-2xl border border-border bg-white p-5 shadow-sm">
                <div class="flex items-start gap-4">
                  <div class="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-500">
                    <Icon name="ph:calendar-check" class="h-7 w-7" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between gap-2">
                      <h4 class="text-body font-semibold text-text-primary truncate">General Checkup</h4>
                      <span class="flex-shrink-0 rounded-full bg-green-50 px-2.5 py-0.5 text-caption font-medium text-success">Confirmed</span>
                    </div>
                    <p class="mt-1 text-body-sm text-text-secondary">Dr. Sarah Johnson</p>
                    <div class="mt-3 flex flex-wrap items-center gap-4 text-body-sm text-text-muted">
                      <span class="inline-flex items-center gap-1.5">
                        <Icon name="ph:calendar" class="h-4 w-4" />
                        March 15, 2026
                      </span>
                      <span class="inline-flex items-center gap-1.5">
                        <Icon name="ph:clock" class="h-4 w-4" />
                        2:00 PM
                      </span>
                      <span class="inline-flex items-center gap-1.5">
                        <Icon name="ph:video-camera" class="h-4 w-4" />
                        Video Call
                      </span>
                    </div>
                  </div>
                </div>
                <div class="mt-4 flex gap-3 border-t border-border pt-4">
                  <button type="button" class="flex-1 rounded-full bg-primary-500 py-2 text-body-sm font-medium text-white transition hover:bg-primary-600">
                    Join Call
                  </button>
                  <button type="button" class="flex-1 rounded-full border border-border py-2 text-body-sm font-medium text-text-secondary transition hover:bg-neutral-50">
                    Reschedule
                  </button>
                </div>
              </div>
            </div>
          </section>

          <!-- =================================================================
               SECTION: Form Elements
               ================================================================= -->
          <section id="forms" class="scroll-mt-20 border-t border-border pt-16 pb-16">
            <SectionHeading title="Form Elements" description="Input fields, selects, checkboxes, and other form controls styled with design tokens." />

            <div class="max-w-2xl space-y-8">
              <!-- Text Inputs -->
              <div>
                <h3 class="mb-4 text-h4 font-semibold text-text-primary">Text Inputs</h3>
                <div class="space-y-4">
                  <div>
                    <label for="ds-name" class="mb-1.5 block text-body-sm font-medium text-text-primary">Full Name</label>
                    <input
                      id="ds-name"
                      type="text"
                      placeholder="Enter your full name"
                      class="block w-full rounded-xl border border-input bg-white px-4 py-2.5 text-body-sm text-text-primary placeholder:text-text-muted outline-none transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                    />
                  </div>
                  <div>
                    <label for="ds-email" class="mb-1.5 block text-body-sm font-medium text-text-primary">Email Address</label>
                    <div class="relative">
                      <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                        <Icon name="ph:envelope" class="h-4.5 w-4.5 text-text-muted" />
                      </div>
                      <input
                        id="ds-email"
                        type="email"
                        placeholder="you@example.com"
                        class="block w-full rounded-xl border border-input bg-white py-2.5 pl-10 pr-4 text-body-sm text-text-primary placeholder:text-text-muted outline-none transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                      />
                    </div>
                  </div>
                  <div>
                    <label for="ds-error-field" class="mb-1.5 block text-body-sm font-medium text-text-primary">Error State</label>
                    <input
                      id="ds-error-field"
                      type="text"
                      value="invalid@"
                      class="block w-full rounded-xl border border-error bg-white px-4 py-2.5 text-body-sm text-text-primary outline-none transition-colors focus:ring-2 focus:ring-error/20"
                    />
                    <p class="mt-1.5 text-body-sm text-error">Please enter a valid email address.</p>
                  </div>
                  <div>
                    <label for="ds-disabled-field" class="mb-1.5 block text-body-sm font-medium text-text-muted">Disabled</label>
                    <input
                      id="ds-disabled-field"
                      type="text"
                      disabled
                      placeholder="This field is disabled"
                      class="block w-full rounded-xl border border-input bg-neutral-50 px-4 py-2.5 text-body-sm text-text-muted cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>

              <!-- Textarea -->
              <div>
                <h3 class="mb-4 text-h4 font-semibold text-text-primary">Textarea</h3>
                <label for="ds-notes" class="mb-1.5 block text-body-sm font-medium text-text-primary">Medical Notes</label>
                <textarea
                  id="ds-notes"
                  rows="4"
                  placeholder="Describe your symptoms or add notes for the doctor..."
                  class="block w-full rounded-xl border border-input bg-white px-4 py-2.5 text-body-sm text-text-primary placeholder:text-text-muted outline-none transition-colors resize-y focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                />
              </div>

              <!-- Select -->
              <div>
                <h3 class="mb-4 text-h4 font-semibold text-text-primary">Select</h3>
                <label for="ds-specialty" class="mb-1.5 block text-body-sm font-medium text-text-primary">Specialty</label>
                <select
                  id="ds-specialty"
                  class="block w-full appearance-none rounded-xl border border-input bg-white px-4 py-2.5 pr-10 text-body-sm text-text-primary outline-none transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                >
                  <option value="">Select a specialty</option>
                  <option>General Practice</option>
                  <option>Cardiology</option>
                  <option>Neurology</option>
                  <option>Dermatology</option>
                  <option>Pediatrics</option>
                </select>
              </div>

              <!-- Checkboxes & Radios -->
              <div class="grid gap-8 sm:grid-cols-2">
                <div>
                  <h3 class="mb-4 text-h4 font-semibold text-text-primary">Checkboxes</h3>
                  <div class="space-y-3">
                    <label class="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked
                        class="h-4.5 w-4.5 rounded-md border-neutral-300 text-primary-500 focus:ring-primary-500/20 focus:ring-2 focus:ring-offset-1 transition"
                      />
                      <span class="text-body-sm text-text-primary group-hover:text-primary-600 transition-colors">Email notifications</span>
                    </label>
                    <label class="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        class="h-4.5 w-4.5 rounded-md border-neutral-300 text-primary-500 focus:ring-primary-500/20 focus:ring-2 focus:ring-offset-1 transition"
                      />
                      <span class="text-body-sm text-text-primary group-hover:text-primary-600 transition-colors">SMS reminders</span>
                    </label>
                    <label class="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        class="h-4.5 w-4.5 rounded-md border-neutral-300 text-primary-500 focus:ring-primary-500/20 focus:ring-2 focus:ring-offset-1 transition"
                      />
                      <span class="text-body-sm text-text-primary group-hover:text-primary-600 transition-colors">Push notifications</span>
                    </label>
                  </div>
                </div>
                <div>
                  <h3 class="mb-4 text-h4 font-semibold text-text-primary">Radio Buttons</h3>
                  <div class="space-y-3">
                    <label class="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="radio"
                        name="ds-visit-type"
                        checked
                        class="h-4.5 w-4.5 border-neutral-300 text-primary-500 focus:ring-primary-500/20 focus:ring-2 focus:ring-offset-1 transition"
                      />
                      <span class="text-body-sm text-text-primary group-hover:text-primary-600 transition-colors">In-Person Visit</span>
                    </label>
                    <label class="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="radio"
                        name="ds-visit-type"
                        class="h-4.5 w-4.5 border-neutral-300 text-primary-500 focus:ring-primary-500/20 focus:ring-2 focus:ring-offset-1 transition"
                      />
                      <span class="text-body-sm text-text-primary group-hover:text-primary-600 transition-colors">Video Consultation</span>
                    </label>
                    <label class="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="radio"
                        name="ds-visit-type"
                        class="h-4.5 w-4.5 border-neutral-300 text-primary-500 focus:ring-primary-500/20 focus:ring-2 focus:ring-offset-1 transition"
                      />
                      <span class="text-body-sm text-text-primary group-hover:text-primary-600 transition-colors">Phone Call</span>
                    </label>
                  </div>
                </div>
              </div>

              <!-- Toggle / Switch -->
              <div>
                <h3 class="mb-4 text-h4 font-semibold text-text-primary">Toggle Switch</h3>
                <div class="space-y-3">
                  <label class="flex items-center gap-3 cursor-pointer">
                    <button
                      type="button"
                      role="switch"
                      aria-checked="true"
                      class="relative inline-flex h-6 w-11 items-center rounded-full bg-primary-500 transition-colors"
                    >
                      <span class="inline-block h-4 w-4 translate-x-6 rounded-full bg-white shadow transition-transform" />
                    </button>
                    <span class="text-body-sm text-text-primary">Appointment reminders</span>
                  </label>
                  <label class="flex items-center gap-3 cursor-pointer">
                    <button
                      type="button"
                      role="switch"
                      aria-checked="false"
                      class="relative inline-flex h-6 w-11 items-center rounded-full bg-neutral-200 transition-colors"
                    >
                      <span class="inline-block h-4 w-4 translate-x-1 rounded-full bg-white shadow transition-transform" />
                    </button>
                    <span class="text-body-sm text-text-primary">Marketing emails</span>
                  </label>
                </div>
              </div>
            </div>
          </section>

          <!-- =================================================================
               SECTION: Badges & Pills
               ================================================================= -->
          <section id="badges" class="scroll-mt-20 border-t border-border pt-16 pb-16">
            <SectionHeading title="Badges & Pills" description="Status indicators, tags, and small informational labels." />

            <h3 class="mb-4 text-h4 font-semibold text-text-primary">Status Badges</h3>
            <div class="mb-8 flex flex-wrap items-center gap-3">
              <span class="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-3 py-1 text-caption font-medium text-primary-600">
                <span class="h-1.5 w-1.5 rounded-full bg-primary-500" />
                Primary
              </span>
              <span class="inline-flex items-center gap-1.5 rounded-full bg-accent-100 px-3 py-1 text-caption font-medium text-accent-600">
                <span class="h-1.5 w-1.5 rounded-full bg-accent-500" />
                Accent
              </span>
              <span class="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-caption font-medium text-success">
                <span class="h-1.5 w-1.5 rounded-full bg-success" />
                Confirmed
              </span>
              <span class="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-caption font-medium text-warning">
                <span class="h-1.5 w-1.5 rounded-full bg-warning" />
                Pending
              </span>
              <span class="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-caption font-medium text-error">
                <span class="h-1.5 w-1.5 rounded-full bg-error" />
                Cancelled
              </span>
              <span class="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1 text-caption font-medium text-text-secondary">
                <span class="h-1.5 w-1.5 rounded-full bg-neutral-400" />
                Neutral
              </span>
            </div>

            <h3 class="mb-4 text-h4 font-semibold text-text-primary">Specialty Tags</h3>
            <div class="mb-8 flex flex-wrap items-center gap-2">
              <span class="rounded-full bg-primary-50 px-3 py-1 text-caption font-medium text-primary-600">Cardiology</span>
              <span class="rounded-full bg-accent-100 px-3 py-1 text-caption font-medium text-accent-600">Neurology</span>
              <span class="rounded-full bg-green-50 px-3 py-1 text-caption font-medium text-green-600">Dermatology</span>
              <span class="rounded-full bg-amber-50 px-3 py-1 text-caption font-medium text-amber-600">Pediatrics</span>
              <span class="rounded-full bg-blue-50 px-3 py-1 text-caption font-medium text-blue-600">Orthopedics</span>
              <span class="rounded-full bg-pink-50 px-3 py-1 text-caption font-medium text-pink-600">Psychiatry</span>
            </div>

            <h3 class="mb-4 text-h4 font-semibold text-text-primary">Solid Badges</h3>
            <div class="mb-8 flex flex-wrap items-center gap-2">
              <span class="rounded-full bg-primary-500 px-3 py-1 text-caption font-medium text-white">New</span>
              <span class="rounded-full bg-success px-3 py-1 text-caption font-medium text-white">Online</span>
              <span class="rounded-full bg-error px-3 py-1 text-caption font-medium text-white">Urgent</span>
              <span class="rounded-full bg-warning px-3 py-1 text-caption font-medium text-white">Soon</span>
              <span class="rounded-full bg-neutral-800 px-3 py-1 text-caption font-medium text-white">Default</span>
            </div>

            <h3 class="mb-4 text-h4 font-semibold text-text-primary">Outline Badges</h3>
            <div class="flex flex-wrap items-center gap-2">
              <span class="rounded-full border border-primary-300 px-3 py-1 text-caption font-medium text-primary-600">Primary</span>
              <span class="rounded-full border border-green-300 px-3 py-1 text-caption font-medium text-success">Success</span>
              <span class="rounded-full border border-red-300 px-3 py-1 text-caption font-medium text-error">Error</span>
              <span class="rounded-full border border-border px-3 py-1 text-caption font-medium text-text-secondary">Default</span>
            </div>
          </section>

          <!-- =================================================================
               SECTION: Navigation
               ================================================================= -->
          <section id="navigation" class="scroll-mt-20 border-t border-border pt-16 pb-16">
            <SectionHeading title="Navigation" description="Navbar pattern matching the Figma design -- logo, links, and CTA." />

            <!-- Light Navbar -->
            <h3 class="mb-4 text-h4 font-semibold text-text-primary">Light Navbar</h3>
            <div class="mb-8 overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
              <div class="flex items-center justify-between px-6 py-4">
                <div class="flex items-center gap-2">
                  <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-500 text-white font-bold text-body-sm">
                    C
                  </div>
                  <span class="text-body-lg font-bold text-text-primary">Curepath</span>
                </div>
                <nav class="hidden items-center gap-8 md:flex" aria-label="Light navbar example">
                  <a href="#" class="text-body-sm font-medium text-primary-500">Home</a>
                  <a href="#" class="text-body-sm font-medium text-text-secondary hover:text-primary-500 transition-colors">Services</a>
                  <a href="#" class="text-body-sm font-medium text-text-secondary hover:text-primary-500 transition-colors">Doctors</a>
                  <a href="#" class="text-body-sm font-medium text-text-secondary hover:text-primary-500 transition-colors">About</a>
                  <a href="#" class="text-body-sm font-medium text-text-secondary hover:text-primary-500 transition-colors">Contact</a>
                </nav>
                <div class="flex items-center gap-3">
                  <a href="#" class="hidden text-body-sm font-medium text-text-secondary hover:text-primary-500 transition-colors sm:block">Sign In</a>
                  <button type="button" class="rounded-full bg-primary-500 px-5 py-2 text-body-sm font-medium text-white transition hover:bg-primary-600">
                    Get Started
                  </button>
                </div>
              </div>
            </div>

            <!-- Dark Navbar -->
            <h3 class="mb-4 text-h4 font-semibold text-text-primary">Dark Navbar</h3>
            <div class="overflow-hidden rounded-2xl border border-neutral-700 bg-neutral-900 shadow-sm">
              <div class="flex items-center justify-between px-6 py-4">
                <div class="flex items-center gap-2">
                  <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-500 text-white font-bold text-body-sm">
                    C
                  </div>
                  <span class="text-body-lg font-bold text-white">Curepath</span>
                </div>
                <nav class="hidden items-center gap-8 md:flex" aria-label="Dark navbar example">
                  <a href="#" class="text-body-sm font-medium text-white">Home</a>
                  <a href="#" class="text-body-sm font-medium text-neutral-400 hover:text-white transition-colors">Services</a>
                  <a href="#" class="text-body-sm font-medium text-neutral-400 hover:text-white transition-colors">Doctors</a>
                  <a href="#" class="text-body-sm font-medium text-neutral-400 hover:text-white transition-colors">About</a>
                  <a href="#" class="text-body-sm font-medium text-neutral-400 hover:text-white transition-colors">Contact</a>
                </nav>
                <div class="flex items-center gap-3">
                  <a href="#" class="hidden text-body-sm font-medium text-neutral-400 hover:text-white transition-colors sm:block">Sign In</a>
                  <button type="button" class="rounded-full bg-primary-500 px-5 py-2 text-body-sm font-medium text-white transition hover:bg-primary-600">
                    Get Started
                  </button>
                </div>
              </div>
            </div>
          </section>

          <!-- =================================================================
               SECTION: Icons
               ================================================================= -->
          <section id="icons" class="scroll-mt-20 border-t border-border pt-16 pb-16">
            <SectionHeading title="Icons" description="Phosphor icon set via @nuxt/icon. Prefix: ph: for regular, ph:*-fill for filled, ph:*-bold for bold." />

            <h3 class="mb-4 text-h4 font-semibold text-text-primary">Healthcare Icons</h3>
            <div class="mb-8 grid grid-cols-4 gap-4 sm:grid-cols-6 lg:grid-cols-8">
              <IconSwatch name="ph:heart" label="Heart" />
              <IconSwatch name="ph:heartbeat" label="Heartbeat" />
              <IconSwatch name="ph:first-aid-kit" label="First Aid" />
              <IconSwatch name="ph:prescription" label="Prescription" />
              <IconSwatch name="ph:pill" label="Pill" />
              <IconSwatch name="ph:thermometer" label="Thermometer" />
              <IconSwatch name="ph:stethoscope" label="Stethoscope" />
              <IconSwatch name="ph:syringe" label="Syringe" />
              <IconSwatch name="ph:tooth" label="Tooth" />
              <IconSwatch name="ph:eye" label="Eye" />
              <IconSwatch name="ph:brain" label="Brain" />
              <IconSwatch name="ph:bandaids" label="Bandaids" />
              <IconSwatch name="ph:wheelchair" label="Wheelchair" />
              <IconSwatch name="ph:hospital" label="Hospital" />
              <IconSwatch name="ph:ambulance" label="Ambulance" />
              <IconSwatch name="ph:dna" label="DNA" />
            </div>

            <h3 class="mb-4 text-h4 font-semibold text-text-primary">UI Icons</h3>
            <div class="mb-8 grid grid-cols-4 gap-4 sm:grid-cols-6 lg:grid-cols-8">
              <IconSwatch name="ph:user" label="User" />
              <IconSwatch name="ph:calendar" label="Calendar" />
              <IconSwatch name="ph:clock" label="Clock" />
              <IconSwatch name="ph:magnifying-glass" label="Search" />
              <IconSwatch name="ph:bell" label="Bell" />
              <IconSwatch name="ph:gear-six" label="Settings" />
              <IconSwatch name="ph:chat-circle" label="Chat" />
              <IconSwatch name="ph:video-camera" label="Video" />
              <IconSwatch name="ph:phone" label="Phone" />
              <IconSwatch name="ph:envelope" label="Email" />
              <IconSwatch name="ph:map-pin" label="Location" />
              <IconSwatch name="ph:star" label="Star" />
              <IconSwatch name="ph:shield-check" label="Shield" />
              <IconSwatch name="ph:arrow-right" label="Arrow" />
              <IconSwatch name="ph:check-circle" label="Check" />
              <IconSwatch name="ph:x-circle" label="Close" />
            </div>

            <h3 class="mb-4 text-h4 font-semibold text-text-primary">Icon Sizes</h3>
            <div class="flex flex-wrap items-end gap-6">
              <div class="flex flex-col items-center gap-2">
                <Icon name="ph:heart" class="h-4 w-4 text-primary-500" />
                <span class="text-caption text-text-muted">16px</span>
              </div>
              <div class="flex flex-col items-center gap-2">
                <Icon name="ph:heart" class="h-5 w-5 text-primary-500" />
                <span class="text-caption text-text-muted">20px</span>
              </div>
              <div class="flex flex-col items-center gap-2">
                <Icon name="ph:heart" class="h-6 w-6 text-primary-500" />
                <span class="text-caption text-text-muted">24px</span>
              </div>
              <div class="flex flex-col items-center gap-2">
                <Icon name="ph:heart" class="h-8 w-8 text-primary-500" />
                <span class="text-caption text-text-muted">32px</span>
              </div>
              <div class="flex flex-col items-center gap-2">
                <Icon name="ph:heart" class="h-10 w-10 text-primary-500" />
                <span class="text-caption text-text-muted">40px</span>
              </div>
              <div class="flex flex-col items-center gap-2">
                <Icon name="ph:heart" class="h-12 w-12 text-primary-500" />
                <span class="text-caption text-text-muted">48px</span>
              </div>
            </div>
          </section>

          <!-- =================================================================
               SECTION: Layout Patterns
               ================================================================= -->
          <section id="layout" class="scroll-mt-20 border-t border-border pt-16 pb-16">
            <SectionHeading title="Layout Patterns" description="Grid configurations, container sizes, and spacing patterns." />

            <h3 class="mb-4 text-h4 font-semibold text-text-primary">Grid - 2 Columns</h3>
            <div class="mb-8 grid grid-cols-2 gap-4">
              <div class="flex h-20 items-center justify-center rounded-xl bg-primary-50 text-body-sm font-medium text-primary-600 border border-primary-200">1</div>
              <div class="flex h-20 items-center justify-center rounded-xl bg-primary-50 text-body-sm font-medium text-primary-600 border border-primary-200">2</div>
            </div>

            <h3 class="mb-4 text-h4 font-semibold text-text-primary">Grid - 3 Columns</h3>
            <div class="mb-8 grid grid-cols-3 gap-4">
              <div class="flex h-20 items-center justify-center rounded-xl bg-accent-100 text-body-sm font-medium text-accent-600 border border-accent-200">1</div>
              <div class="flex h-20 items-center justify-center rounded-xl bg-accent-100 text-body-sm font-medium text-accent-600 border border-accent-200">2</div>
              <div class="flex h-20 items-center justify-center rounded-xl bg-accent-100 text-body-sm font-medium text-accent-600 border border-accent-200">3</div>
            </div>

            <h3 class="mb-4 text-h4 font-semibold text-text-primary">Grid - 4 Columns</h3>
            <div class="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div class="flex h-20 items-center justify-center rounded-xl bg-green-50 text-body-sm font-medium text-green-600 border border-green-200">1</div>
              <div class="flex h-20 items-center justify-center rounded-xl bg-green-50 text-body-sm font-medium text-green-600 border border-green-200">2</div>
              <div class="flex h-20 items-center justify-center rounded-xl bg-green-50 text-body-sm font-medium text-green-600 border border-green-200">3</div>
              <div class="flex h-20 items-center justify-center rounded-xl bg-green-50 text-body-sm font-medium text-green-600 border border-green-200">4</div>
            </div>

            <h3 class="mb-4 text-h4 font-semibold text-text-primary">Sidebar + Content</h3>
            <div class="mb-8 grid gap-4 lg:grid-cols-[280px_1fr]">
              <div class="flex h-40 items-center justify-center rounded-xl bg-neutral-100 text-body-sm font-medium text-text-secondary border border-border">
                Sidebar (280px)
              </div>
              <div class="flex h-40 items-center justify-center rounded-xl bg-neutral-50 text-body-sm font-medium text-text-secondary border border-border">
                Main Content (1fr)
              </div>
            </div>

            <h3 class="mb-4 text-h4 font-semibold text-text-primary">Responsive Stack</h3>
            <p class="mb-4 text-body-sm text-text-muted">
              Items stack vertically on mobile, become horizontal from the <code class="rounded bg-neutral-100 px-1 py-0.5 text-caption font-mono">sm:</code> breakpoint.
            </p>
            <div class="flex flex-col gap-4 sm:flex-row">
              <div class="flex h-24 flex-1 items-center justify-center rounded-xl bg-amber-50 text-body-sm font-medium text-amber-600 border border-amber-200">A</div>
              <div class="flex h-24 flex-1 items-center justify-center rounded-xl bg-amber-50 text-body-sm font-medium text-amber-600 border border-amber-200">B</div>
              <div class="flex h-24 flex-1 items-center justify-center rounded-xl bg-amber-50 text-body-sm font-medium text-amber-600 border border-amber-200">C</div>
            </div>
          </section>

          <!-- =================================================================
               SECTION: Shadows & Borders
               ================================================================= -->
          <section id="shadows" class="scroll-mt-20 border-t border-border pt-16 pb-16">
            <SectionHeading title="Shadows & Borders" description="Elevation levels and border radius tokens for depth and shape." />

            <h3 class="mb-4 text-h4 font-semibold text-text-primary">Shadow Scale</h3>
            <div class="mb-12 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
              <div class="flex h-28 flex-col items-center justify-center rounded-2xl bg-white shadow-none border border-border">
                <p class="text-body-sm font-medium text-text-primary">None</p>
                <code class="text-caption text-text-muted">shadow-none</code>
              </div>
              <div class="flex h-28 flex-col items-center justify-center rounded-2xl bg-white shadow-sm">
                <p class="text-body-sm font-medium text-text-primary">Small</p>
                <code class="text-caption text-text-muted">shadow-sm</code>
              </div>
              <div class="flex h-28 flex-col items-center justify-center rounded-2xl bg-white shadow-md">
                <p class="text-body-sm font-medium text-text-primary">Medium</p>
                <code class="text-caption text-text-muted">shadow-md</code>
              </div>
              <div class="flex h-28 flex-col items-center justify-center rounded-2xl bg-white shadow-lg">
                <p class="text-body-sm font-medium text-text-primary">Large</p>
                <code class="text-caption text-text-muted">shadow-lg</code>
              </div>
              <div class="flex h-28 flex-col items-center justify-center rounded-2xl bg-white shadow-xl">
                <p class="text-body-sm font-medium text-text-primary">XL</p>
                <code class="text-caption text-text-muted">shadow-xl</code>
              </div>
            </div>

            <h3 class="mb-4 text-h4 font-semibold text-text-primary">Border Radius</h3>
            <div class="mb-12 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
              <div class="flex flex-col items-center gap-3">
                <div class="flex h-20 w-20 items-center justify-center rounded-[var(--radius-sm)] border-2 border-primary-300 bg-primary-50">
                  <code class="text-caption text-primary-600">sm</code>
                </div>
                <div class="text-center">
                  <p class="text-body-sm font-medium text-text-primary">0.375rem</p>
                  <code class="text-caption text-text-muted">radius-sm</code>
                </div>
              </div>
              <div class="flex flex-col items-center gap-3">
                <div class="flex h-20 w-20 items-center justify-center rounded-[var(--radius-md)] border-2 border-primary-300 bg-primary-50">
                  <code class="text-caption text-primary-600">md</code>
                </div>
                <div class="text-center">
                  <p class="text-body-sm font-medium text-text-primary">0.5rem</p>
                  <code class="text-caption text-text-muted">radius-md</code>
                </div>
              </div>
              <div class="flex flex-col items-center gap-3">
                <div class="flex h-20 w-20 items-center justify-center rounded-[var(--radius-lg)] border-2 border-primary-300 bg-primary-50">
                  <code class="text-caption text-primary-600">lg</code>
                </div>
                <div class="text-center">
                  <p class="text-body-sm font-medium text-text-primary">0.75rem</p>
                  <code class="text-caption text-text-muted">radius-lg</code>
                </div>
              </div>
              <div class="flex flex-col items-center gap-3">
                <div class="flex h-20 w-20 items-center justify-center rounded-[var(--radius-xl)] border-2 border-primary-300 bg-primary-50">
                  <code class="text-caption text-primary-600">xl</code>
                </div>
                <div class="text-center">
                  <p class="text-body-sm font-medium text-text-primary">1rem</p>
                  <code class="text-caption text-text-muted">radius-xl</code>
                </div>
              </div>
              <div class="flex flex-col items-center gap-3">
                <div class="flex h-20 w-20 items-center justify-center rounded-[var(--radius-2xl)] border-2 border-primary-300 bg-primary-50">
                  <code class="text-caption text-primary-600">2xl</code>
                </div>
                <div class="text-center">
                  <p class="text-body-sm font-medium text-text-primary">1.5rem</p>
                  <code class="text-caption text-text-muted">radius-2xl</code>
                </div>
              </div>
              <div class="flex flex-col items-center gap-3">
                <div class="flex h-20 w-20 items-center justify-center rounded-[var(--radius-full)] border-2 border-primary-300 bg-primary-50">
                  <code class="text-caption text-primary-600">full</code>
                </div>
                <div class="text-center">
                  <p class="text-body-sm font-medium text-text-primary">9999px</p>
                  <code class="text-caption text-text-muted">radius-full</code>
                </div>
              </div>
            </div>

            <h3 class="mb-4 text-h4 font-semibold text-text-primary">Border Colors</h3>
            <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div class="rounded-xl border-2 border-border p-4 text-center">
                <p class="text-body-sm font-medium text-text-primary">Default</p>
                <code class="text-caption text-text-muted">border-border</code>
              </div>
              <div class="rounded-xl border-2 border-primary-300 p-4 text-center">
                <p class="text-body-sm font-medium text-text-primary">Primary</p>
                <code class="text-caption text-text-muted">border-primary-300</code>
              </div>
              <div class="rounded-xl border-2 border-success p-4 text-center">
                <p class="text-body-sm font-medium text-text-primary">Success</p>
                <code class="text-caption text-text-muted">border-success</code>
              </div>
              <div class="rounded-xl border-2 border-error p-4 text-center">
                <p class="text-body-sm font-medium text-text-primary">Error</p>
                <code class="text-caption text-text-muted">border-error</code>
              </div>
            </div>
          </section>

          <!-- =================================================================
               SECTION: CTA Banner (Gradient Card)
               ================================================================= -->
          <section id="cta-banner" class="scroll-mt-20 border-t border-border pt-16 pb-16">
            <SectionHeading title="CTA Banner (Gradient Card)" description="Asymmetric-radius gradient banner with left-aligned content and decorative concentric circles. Used as an inline call-to-action." />

            <!-- Live preview -->
            <div
              class="relative overflow-hidden rounded-tl-[100px] rounded-tr-[20px] rounded-br-[100px] rounded-bl-[20px] px-10 py-16 lg:px-[70px] lg:py-[100px]"
              style="background: linear-gradient(161deg, var(--color-primary-500) 0%, var(--color-primary-300) 100%)"
            >
              <!-- Content -->
              <div class="relative z-10 flex max-w-xl flex-col gap-8">
                <div class="flex flex-col gap-4">
                  <h2 class="text-h1 font-bold leading-display text-white lg:text-[3.5rem]">
                    Let's Redefine Healthcare Together
                  </h2>
                  <p class="text-body-lg leading-body text-neutral-200 lg:text-xl">
                    Partner with Curepath to make expert medical care faster, smarter,
                    and truly accessible — anytime, anywhere.
                  </p>
                </div>
                <div>
                  <a
                    href="#"
                    class="inline-flex items-center gap-2.5 rounded-full bg-white px-5 py-2.5 text-body font-medium text-neutral-800 transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    Get Started Now
                    <Icon name="ph:arrow-right" class="size-5" aria-hidden="true" />
                  </a>
                </div>
              </div>

              <!-- Decorative circles -->
              <img
                src="/assets/cta-banner-circles.svg"
                alt=""
                aria-hidden="true"
                class="pointer-events-none absolute right-0 top-1/2 h-auto w-[500px] -translate-y-1/2 translate-x-1/4 lg:w-[900px]"
              />
            </div>

            <!-- Specs table -->
            <div class="mt-8">
              <h3 class="mb-4 text-h4 font-semibold text-text-primary">Design Specs</h3>
              <div class="overflow-x-auto rounded-xl border border-border">
                <table class="w-full text-left text-body-sm">
                  <thead class="bg-neutral-50">
                    <tr>
                      <th class="px-4 py-3 font-semibold text-text-primary">Property</th>
                      <th class="px-4 py-3 font-semibold text-text-primary">Value</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-border">
                    <tr>
                      <td class="px-4 py-3 text-text-secondary">Background</td>
                      <td class="px-4 py-3 font-mono text-caption text-text-primary">linear-gradient(161deg, primary-500, primary-300)</td>
                    </tr>
                    <tr>
                      <td class="px-4 py-3 text-text-secondary">Border Radius</td>
                      <td class="px-4 py-3 font-mono text-caption text-text-primary">TL 100px, TR 20px, BR 100px, BL 20px</td>
                    </tr>
                    <tr>
                      <td class="px-4 py-3 text-text-secondary">Padding (desktop)</td>
                      <td class="px-4 py-3 font-mono text-caption text-text-primary">px-[70px] py-[100px]</td>
                    </tr>
                    <tr>
                      <td class="px-4 py-3 text-text-secondary">Heading</td>
                      <td class="px-4 py-3 font-mono text-caption text-text-primary">3.5rem (56px), leading-display, white</td>
                    </tr>
                    <tr>
                      <td class="px-4 py-3 text-text-secondary">Subtitle</td>
                      <td class="px-4 py-3 font-mono text-caption text-text-primary">text-xl (20px), leading-body, neutral-200</td>
                    </tr>
                    <tr>
                      <td class="px-4 py-3 text-text-secondary">Button</td>
                      <td class="px-4 py-3 font-mono text-caption text-text-primary">White pill, text-neutral-800, rounded-full</td>
                    </tr>
                    <tr>
                      <td class="px-4 py-3 text-text-secondary">Decorative Circles</td>
                      <td class="px-4 py-3 font-mono text-caption text-text-primary">/assets/cta-banner-circles.svg, absolute right</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <!-- =================================================================
               CTA Section (matching Figma pattern)
               ================================================================= -->
          <section class="mt-8 mb-12 relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-500 via-primary-600 to-accent-500 px-8 py-14 text-center text-white sm:px-12 sm:py-20">
            <div class="pointer-events-none absolute -right-12 -top-12 h-56 w-56 rounded-full bg-white/10" />
            <div class="pointer-events-none absolute -bottom-8 -left-8 h-40 w-40 rounded-full bg-white/5" />
            <div class="pointer-events-none absolute right-1/3 bottom-1/4 h-24 w-24 rounded-full bg-white/5" />

            <div class="relative">
              <span class="mb-4 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-caption font-medium backdrop-blur-sm">
                <Icon name="ph:sparkle" class="h-3.5 w-3.5" />
                Design System Complete
              </span>
              <h2 class="text-h1 font-bold leading-heading">
                Ready to Build
              </h2>
              <p class="mx-auto mt-3 max-w-md text-body-lg text-white/80 leading-body">
                Use these tokens and patterns to create consistent, accessible interfaces across the entire Curepath platform.
              </p>
              <div class="mt-8 flex flex-wrap items-center justify-center gap-4">
                <NuxtLink
                  to="/"
                  class="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-body-sm font-semibold text-primary-600 shadow-lg transition hover:bg-neutral-50"
                >
                  Back to Home
                  <Icon name="ph:arrow-right" class="h-4 w-4" />
                </NuxtLink>
                <a
                  href="#colors"
                  class="inline-flex items-center gap-2 rounded-full border-2 border-white/30 px-6 py-3 text-body-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/10"
                >
                  Back to Top
                </a>
              </div>
            </div>
          </section>

          <!-- Footer -->
          <footer class="border-t border-border pt-8 pb-12 text-center">
            <p class="text-body-sm text-text-muted">
              Curepath Design System v1.0 &mdash; Built with Nuxt 3, Tailwind CSS v4, and Inter typeface.
            </p>
          </footer>
        </div>
      </main>
    </div>
  </div>
</template>

<!-- ===================================================================
     Inline child components (scoped to this page to keep it self-contained)
     =================================================================== -->

