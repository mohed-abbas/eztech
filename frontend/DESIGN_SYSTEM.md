# Curepath Design System

Comprehensive design system reference for the Curepath healthcare platform.
This document serves as the single source of truth for building UI components
and pages. All token names, class utilities, and patterns referenced here map
directly to the Tailwind CSS v4 theme defined in
`app/assets/css/tailwind.css`.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Color Palette](#2-color-palette)
3. [Typography](#3-typography)
4. [Spacing System](#4-spacing-system)
5. [Border Radius](#5-border-radius)
6. [Shadow System](#6-shadow-system)
7. [Component Patterns](#7-component-patterns)
8. [Layout Patterns](#8-layout-patterns)
9. [Icon Usage](#9-icon-usage)
10. [Responsive Breakpoints](#10-responsive-breakpoints)
11. [Animation and Transitions](#11-animation-and-transitions)
12. [Accessibility Requirements](#12-accessibility-requirements)
13. [File Structure Conventions](#13-file-structure-conventions)

---

## 1. Project Overview

**Product:** Curepath -- a healthcare platform for booking appointments,
chatting with doctors, and managing medical records.

### Tech Stack

| Layer            | Technology                        |
| ---------------- | --------------------------------- |
| Framework        | Nuxt.js 4 (Vue 3, Composition API) |
| Styling          | Tailwind CSS v4                   |
| Component Library | shadcn-vue (via `shadcn-nuxt`)   |
| Primitives       | Reka UI (headless components)     |
| Class Utilities  | `clsx` + `tailwind-merge` via `cn()` |
| Icons            | `@nuxt/icon` (Phosphor icon set)  |
| Fonts            | `@nuxt/fonts` (Inter, JetBrains Mono) |
| Routing          | Nuxt file-based routing (`app/pages/`) |

### Key Dependencies

```
nuxt ^4.3.1
vue ^3.5.28
shadcn-nuxt ^2.4.3
reka-ui ^2.8.2
class-variance-authority ^0.7.1
@nuxt/icon ^2.2.1
@nuxt/fonts ^0.14.0
@nuxtjs/tailwindcss ^6.14.0
```

### Utility Helper

All dynamic class merging uses the `cn()` function from `~/lib/utils`:

```ts
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

---

## 2. Color Palette

All colors are defined as CSS custom properties inside `@theme` in
`app/assets/css/tailwind.css`. Use the Tailwind class name (e.g.,
`bg-primary-500`, `text-neutral-600`) -- never use raw hex values.

### Primary -- Purple (Brand)

| Token             | Hex       | Tailwind Class       | Usage                             |
| ----------------- | --------- | -------------------- | --------------------------------- |
| `primary-50`      | `#F5F3FF` | `bg-primary-50`      | Light tinted backgrounds          |
| `primary-100`     | `#EDE9FE` | `bg-primary-100`     | Badge backgrounds, hover states   |
| `primary-200`     | `#DDD6FE` | `bg-primary-200`     | Subtle borders, focus rings       |
| `primary-300`     | `#C4B5FD` | `bg-primary-300`     | Decorative accents                |
| `primary-400`     | `#A78BFA` | `bg-primary-400`     | Hover on primary elements         |
| `primary-500`     | `#8B5CF6` | `bg-primary-500`     | **Main brand color** -- buttons, links, icons |
| `primary-600`     | `#7C3AED` | `bg-primary-600`     | Active / pressed states           |
| `primary-700`     | `#6D28D9` | `bg-primary-700`     | Dark hover / emphasis             |
| `primary-800`     | `#5B21B6` | `bg-primary-800`     | Dark backgrounds                  |
| `primary-900`     | `#4C1D95` | `bg-primary-900`     | Deepest brand surface             |

### Accent -- Blue (Secondary Brand)

| Token            | Hex       | Tailwind Class      | Usage                           |
| ---------------- | --------- | ------------------- | ------------------------------- |
| `accent-100`     | `#E4E4FF` | `bg-accent-100`     | Light accent backgrounds        |
| `accent-200`     | `#C6C6FF` | `bg-accent-200`     | Accent borders                  |
| `accent-300`     | `#A8A8FF` | `bg-accent-300`     | Decorative elements             |
| `accent-400`     | `#7272FF` | `bg-accent-400`     | Secondary interactive elements  |
| `accent-500`     | `#6366F1` | `bg-accent-500`     | **Main accent** (indigo)        |
| `accent-600`     | `#4F46E5` | `bg-accent-600`     | Accent hover                    |
| `accent-700`     | `#4338CA` | `bg-accent-700`     | Accent active                   |
| `accent-800`     | `#3730A3` | `bg-accent-800`     | Deep accent surfaces            |
| `accent-900`     | `#312E81` | `bg-accent-900`     | Darkest accent surface          |

### Neutral -- Gray

| Token            | Hex       | Tailwind Class      | Usage                           |
| ---------------- | --------- | ------------------- | ------------------------------- |
| `neutral-50`     | `#F9FAFB` | `bg-neutral-50`     | Page backgrounds                |
| `neutral-100`    | `#F3F4F6` | `bg-neutral-100`    | Card backgrounds, muted areas   |
| `neutral-200`    | `#E5E7EB` | `bg-neutral-200`    | Borders, dividers               |
| `neutral-300`    | `#D1D5DB` | `bg-neutral-300`    | Disabled borders                |
| `neutral-400`    | `#9CA3AF` | `bg-neutral-400`    | Placeholder text                |
| `neutral-500`    | `#6B7280` | `bg-neutral-500`    | Muted text, captions            |
| `neutral-600`    | `#4B5563` | `bg-neutral-600`    | Secondary text                  |
| `neutral-700`    | `#374151` | `bg-neutral-700`    | Dark text emphasis              |
| `neutral-800`    | `#1F2937` | `bg-neutral-800`    | Headings, dark backgrounds      |
| `neutral-900`    | `#111827` | `bg-neutral-900`    | Near-black surface              |

### Semantic Colors

| Token       | Hex       | Tailwind Class  | Usage                    |
| ----------- | --------- | --------------- | ------------------------ |
| `success`   | `#10B981` | `bg-success`    | Confirmations, approved  |
| `warning`   | `#F59E0B` | `bg-warning`    | Alerts, caution          |
| `error`     | `#EF4444` | `bg-error`      | Errors, destructive      |
| `info`      | `#3B82F6` | `bg-info`       | Informational banners    |

### Text Colors

| Token            | Hex       | Tailwind Class        | Usage                    |
| ---------------- | --------- | --------------------- | ------------------------ |
| `text-primary`   | `#262730` | `text-text-primary`   | Headings, body text      |
| `text-secondary` | `#4B5563` | `text-text-secondary` | Secondary body text      |
| `text-muted`     | `#6B7280` | `text-text-muted`     | Captions, helper text    |
| `text-inverse`   | `#FFFFFF` | `text-text-inverse`   | Text on dark backgrounds |

### Background Colors

| Token          | Hex       | Tailwind Class    | Usage                       |
| -------------- | --------- | ----------------- | --------------------------- |
| `bg-primary`   | `#FFFFFF` | `bg-bg-primary`   | Main page background        |
| `bg-secondary` | `#F5F3FF` | `bg-bg-secondary` | Purple-tinted sections      |
| `bg-muted`     | `#F3F4F6` | `bg-bg-muted`     | Muted section backgrounds   |
| `bg-dark`      | `#1F2937` | `bg-bg-dark`      | Dark sections (footer, CTA) |

### shadcn Semantic Tokens

These tokens are used by shadcn-vue components internally. Prefer the named
tokens above for custom components.

| Token                    | Hex       | Tailwind Class               |
| ------------------------ | --------- | ---------------------------- |
| `background`             | `#FFFFFF` | `bg-background`              |
| `foreground`             | `#262730` | `text-foreground`            |
| `card`                   | `#FFFFFF` | `bg-card`                    |
| `card-foreground`        | `#262730` | `text-card-foreground`       |
| `popover`                | `#FFFFFF` | `bg-popover`                 |
| `popover-foreground`     | `#262730` | `text-popover-foreground`    |
| `muted`                  | `#F3F4F6` | `bg-muted`                   |
| `muted-foreground`       | `#6B7280` | `text-muted-foreground`      |
| `accent` (shadcn)        | `#F5F3FF` | `bg-accent`                  |
| `accent-foreground`      | `#262730` | `text-accent-foreground`     |
| `destructive`            | `#EF4444` | `bg-destructive`             |
| `destructive-foreground` | `#FFFFFF` | `text-destructive-foreground` |
| `border`                 | `#E5E7EB` | `border-border`              |
| `input`                  | `#E5E7EB` | `border-input`               |
| `ring`                   | `#8B5CF6` | `ring-ring`                  |

---

## 3. Typography

### Font Families

| Token          | Stack                                          | Tailwind Class |
| -------------- | ---------------------------------------------- | -------------- |
| `--font-sans`  | `"Inter", ui-sans-serif, system-ui, sans-serif` | `font-sans`    |
| `--font-heading` | `"Inter", ui-sans-serif, system-ui, sans-serif` | `font-heading` |
| `--font-mono`  | `"JetBrains Mono", ui-monospace, monospace`     | `font-mono`    |

Fonts are loaded automatically by `@nuxt/fonts`. No manual `<link>` tags
needed.

### Type Scale

| Name         | Size     | rem    | Tailwind Class   | Weight     | Line Height        |
| ------------ | -------- | ------ | ---------------- | ---------- | ------------------ |
| Display      | 64px     | 4rem   | `text-display`   | `font-bold`   | `leading-display` (1.1) |
| H1           | 48px     | 3rem   | `text-h1`        | `font-bold`   | `leading-heading` (1.2) |
| H2           | 36px     | 2.25rem | `text-h2`       | `font-bold`   | `leading-heading` (1.2) |
| H3           | 24px     | 1.5rem | `text-h3`        | `font-semibold` | `leading-heading` (1.2) |
| H4           | 20px     | 1.25rem | `text-h4`       | `font-semibold` | `leading-heading` (1.2) |
| Body Large   | 18px     | 1.125rem | `text-body-lg` | `font-normal` | `leading-body` (1.6) |
| Body         | 16px     | 1rem   | `text-body`      | `font-normal` | `leading-body` (1.6) |
| Body Small   | 14px     | 0.875rem | `text-body-sm` | `font-normal` | `leading-body` (1.6) |
| Caption      | 12px     | 0.75rem | `text-caption`  | `font-normal` | `leading-body` (1.6) |

### Usage Examples

```vue
<!-- Display heading (hero section) -->
<h1 class="text-display font-bold leading-display text-text-primary">
  Healthcare Made Effortless
</h1>

<!-- Section heading -->
<h2 class="text-h2 font-bold leading-heading text-text-primary">
  Our Features
</h2>

<!-- Subsection heading -->
<h3 class="text-h3 font-semibold leading-heading text-text-primary">
  Book Appointments
</h3>

<!-- Body text -->
<p class="text-body leading-body text-text-secondary">
  Schedule appointments with top healthcare providers in minutes.
</p>

<!-- Small text / caption -->
<span class="text-caption text-text-muted">
  Last updated 2 hours ago
</span>
```

### Heading Base Styles

All heading elements (`h1`--`h6`) automatically receive `font-heading`,
`font-bold`, and `tracking-tight` via the base layer. You only need to add
size, color, and line-height classes.

---

## 4. Spacing System

Custom spacing tokens are defined in the theme. Use them with any Tailwind
spacing utility (`p-`, `m-`, `gap-`, `space-`, etc.).

| Token            | Value   | px   | Tailwind Usage           | Typical Use                  |
| ---------------- | ------- | ---- | ------------------------ | ---------------------------- |
| `--spacing-xs`   | 0.25rem | 4px  | `p-[--spacing-xs]`       | Tight inner padding          |
| `--spacing-sm`   | 0.5rem  | 8px  | `p-[--spacing-sm]`       | Small gaps, icon spacing     |
| `--spacing-md`   | 1rem    | 16px | `p-[--spacing-md]`       | Default component padding    |
| `--spacing-lg`   | 1.5rem  | 24px | `p-[--spacing-lg]`       | Card padding, group spacing  |
| `--spacing-xl`   | 2rem    | 32px | `p-[--spacing-xl]`       | Section inner padding        |
| `--spacing-2xl`  | 3rem    | 48px | `p-[--spacing-2xl]`      | Large section gaps           |
| `--spacing-3xl`  | 4rem    | 64px | `p-[--spacing-3xl]`      | Major section separation     |
| `--spacing-4xl`  | 6rem    | 96px | `p-[--spacing-4xl]`      | Hero section padding         |
| `--spacing-section` | 5rem | 80px | `py-[--spacing-section]` | Vertical section rhythm      |

### Practical Spacing Guide

For standard Tailwind numeric utilities, use these equivalents:

| Context                   | Recommended Classes                |
| ------------------------- | ---------------------------------- |
| Between icon and label    | `gap-2` (8px)                      |
| Inside a button           | `px-6 py-3` or `px-8 py-4`        |
| Card inner padding        | `p-6` (24px)                       |
| Between form fields       | `space-y-4` (16px)                 |
| Between section heading and content | `mb-6` to `mb-12`        |
| Section vertical padding  | `py-20` (80px) or `py-[--spacing-section]` |
| Between grid items        | `gap-6` or `gap-8`                 |
| Container horizontal padding | `px-4 sm:px-6 lg:px-8`         |

---

## 5. Border Radius

| Token          | Value     | Tailwind Class      | Usage                              |
| -------------- | --------- | ------------------- | ---------------------------------- |
| `--radius-sm`  | 0.375rem  | `rounded-[--radius-sm]`  | Small inputs, tags             |
| `--radius-md`  | 0.5rem    | `rounded-[--radius-md]`  | Default buttons, inputs        |
| `--radius-lg`  | 0.75rem   | `rounded-[--radius-lg]`  | Cards, modals                  |
| `--radius-xl`  | 1rem      | `rounded-[--radius-xl]`  | Large cards, sections          |
| `--radius-2xl` | 1.5rem    | `rounded-[--radius-2xl]` | Feature cards, image containers |
| `--radius-full`| 9999px    | `rounded-full`           | Pill buttons, badges, avatars  |

### Usage Guide

| Component            | Radius                    |
| -------------------- | ------------------------- |
| Pill buttons / CTAs  | `rounded-full`            |
| Badges / Tags        | `rounded-full`            |
| Standard cards       | `rounded-xl` or `rounded-2xl` |
| Input fields         | `rounded-[--radius-md]`   |
| Modals / Dialogs     | `rounded-[--radius-lg]`   |
| Avatars              | `rounded-full`            |
| Icon containers      | `rounded-full`            |

---

## 6. Shadow System

Use standard Tailwind shadows. The design favors subtle, soft shadows.

| Tailwind Class | Usage                                       |
| -------------- | ------------------------------------------- |
| `shadow-sm`    | Subtle card elevation, hover previews       |
| `shadow`       | Default card shadow                         |
| `shadow-md`    | Elevated cards, dropdowns                   |
| `shadow-lg`    | Modals, floating elements                   |
| `shadow-xl`    | Hero phone mockups, prominent elements      |
| `shadow-none`  | Flat elements (feature cards on colored bg) |

### Card Shadow Pattern

```vue
<!-- Standard card -->
<div class="rounded-2xl bg-card p-6 shadow-sm">
  <!-- content -->
</div>

<!-- Elevated card (on hover or prominent) -->
<div class="rounded-2xl bg-card p-6 shadow-sm hover:shadow-md transition-shadow">
  <!-- content -->
</div>
```

---

## 7. Component Patterns

### 7.1 Buttons

The design uses pill-shaped buttons (`rounded-full`) as the primary button
style. All buttons follow a consistent height and padding scheme.

#### Primary Button (Dark/Filled with Icon)

```vue
<template>
  <button
    class="inline-flex items-center gap-2 rounded-full bg-neutral-800 px-6 py-3 text-body-sm font-medium text-white transition-colors hover:bg-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
  >
    Get Started
    <Icon name="ph:arrow-right" class="size-4" />
  </button>
</template>
```

#### Primary Button (Purple/Brand)

```vue
<template>
  <button
    class="inline-flex items-center gap-2 rounded-full bg-primary-500 px-6 py-3 text-body-sm font-medium text-white transition-colors hover:bg-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
  >
    Book Appointment
    <Icon name="ph:arrow-right" class="size-4" />
  </button>
</template>
```

#### Secondary Button (Outlined)

```vue
<template>
  <button
    class="inline-flex items-center gap-2 rounded-full border border-neutral-300 bg-transparent px-6 py-3 text-body-sm font-medium text-text-primary transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
  >
    Learn More
  </button>
</template>
```

#### CTA Arrow Button (Circle)

```vue
<template>
  <button
    class="inline-flex size-12 items-center justify-center rounded-full bg-white text-neutral-800 shadow-md transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    aria-label="Get started"
  >
    <Icon name="ph:arrow-right" class="size-5" />
  </button>
</template>
```

#### Text Link Button

```vue
<template>
  <NuxtLink
    to="/features"
    class="inline-flex items-center gap-1 text-body-sm font-medium text-primary-500 transition-colors hover:text-primary-600"
  >
    Learn more
    <Icon name="ph:arrow-right" class="size-4" />
  </NuxtLink>
</template>
```

#### Button Size Reference

| Size   | Padding        | Text Size      | Icon Size  |
| ------ | -------------- | -------------- | ---------- |
| Small  | `px-4 py-2`   | `text-body-sm` | `size-3.5` |
| Default | `px-6 py-3`  | `text-body-sm` | `size-4`   |
| Large  | `px-8 py-4`   | `text-body`    | `size-5`   |

### 7.2 Badge / Pill

Used for status indicators, tags, and hero section labels.

```vue
<template>
  <span
    class="inline-flex items-center gap-1.5 rounded-full bg-primary-100 px-4 py-1.5 text-caption font-medium text-primary-700"
  >
    <span class="size-1.5 rounded-full bg-primary-500" />
    Care That Fits Your Schedule
  </span>
</template>
```

### 7.3 Navigation Bar

Fixed top navigation with logo, links, and CTA button.

```vue
<template>
  <header class="fixed inset-x-0 top-0 z-50 bg-white/80 backdrop-blur-md">
    <nav class="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
      <!-- Logo -->
      <NuxtLink to="/" class="flex items-center gap-2">
        <img src="/assets/logo.svg" alt="Curepath" class="h-8 w-auto" />
        <span class="text-h4 font-bold text-text-primary">Curepath</span>
      </NuxtLink>

      <!-- Desktop Nav Links -->
      <ul class="hidden items-center gap-8 md:flex">
        <li v-for="link in navLinks" :key="link.to">
          <NuxtLink
            :to="link.to"
            class="text-body-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
          >
            {{ link.label }}
          </NuxtLink>
        </li>
      </ul>

      <!-- CTA -->
      <div class="flex items-center gap-4">
        <NuxtLink
          to="/login"
          class="hidden text-body-sm font-medium text-text-secondary transition-colors hover:text-text-primary sm:block"
        >
          Sign In
        </NuxtLink>
        <NuxtLink
          to="/signup"
          class="inline-flex items-center gap-2 rounded-full bg-neutral-800 px-5 py-2.5 text-body-sm font-medium text-white transition-colors hover:bg-neutral-900"
        >
          Get Started
          <Icon name="ph:arrow-right" class="size-4" />
        </NuxtLink>
      </div>
    </nav>
  </header>
</template>

<script setup lang="ts">
const navLinks = [
  { label: 'Home', to: '/' },
  { label: 'Features', to: '/features' },
  { label: 'Pricing', to: '/pricing' },
  { label: 'Help', to: '/help' },
]
</script>
```

### 7.4 Hero Section

Full-width hero with badge, display heading, subtitle, and two action buttons.

```vue
<template>
  <section class="relative overflow-hidden bg-bg-primary px-4 pt-32 pb-20 sm:px-6 lg:px-8">
    <div class="mx-auto max-w-4xl text-center">
      <!-- Badge -->
      <span
        class="mb-6 inline-flex items-center gap-1.5 rounded-full bg-primary-100 px-4 py-1.5 text-caption font-medium text-primary-700"
      >
        <span class="size-1.5 rounded-full bg-primary-500" />
        Care That Fits Your Schedule
      </span>

      <!-- Heading -->
      <h1 class="text-display font-bold leading-display text-text-primary">
        Healthcare Made<br />
        Effortless. <span class="text-primary-500">Anytime</span>,
        Anywhere.
      </h1>

      <!-- Subtitle -->
      <p class="mx-auto mt-6 max-w-2xl text-body-lg leading-body text-text-secondary">
        Book appointments, chat with doctors, and manage your health records
        all from one place. Your wellness journey starts here.
      </p>

      <!-- Actions -->
      <div class="mt-10 flex flex-wrap items-center justify-center gap-4">
        <NuxtLink
          to="/signup"
          class="inline-flex items-center gap-2 rounded-full bg-neutral-800 px-8 py-4 text-body font-medium text-white transition-colors hover:bg-neutral-900"
        >
          Get Started
          <Icon name="ph:arrow-right" class="size-5" />
        </NuxtLink>
        <NuxtLink
          to="/features"
          class="inline-flex items-center gap-2 rounded-full border border-neutral-300 px-8 py-4 text-body font-medium text-text-primary transition-colors hover:bg-neutral-100"
        >
          Learn More
        </NuxtLink>
      </div>
    </div>
  </section>
</template>
```

### 7.5 Feature Card

Icon in a colored circle, heading, and description. Arranged in a 2x2 grid.

```vue
<template>
  <div class="rounded-2xl bg-white p-6 shadow-sm">
    <!-- Icon container -->
    <div
      class="mb-4 flex size-12 items-center justify-center rounded-full bg-primary-100"
    >
      <Icon name="ph:calendar-check" class="size-6 text-primary-500" />
    </div>

    <!-- Title -->
    <h3 class="text-h4 font-semibold text-text-primary">
      Easy Scheduling
    </h3>

    <!-- Description -->
    <p class="mt-2 text-body-sm leading-body text-text-secondary">
      Book appointments with your preferred doctors in just a few taps.
    </p>
  </div>
</template>
```

**Grid layout for feature cards:**

```vue
<template>
  <section class="py-[--spacing-section] px-4 sm:px-6 lg:px-8">
    <div class="mx-auto max-w-6xl">
      <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:gap-8">
        <FeatureCard
          v-for="feature in features"
          :key="feature.title"
          :icon="feature.icon"
          :title="feature.title"
          :description="feature.description"
        />
      </div>
    </div>
  </section>
</template>
```

### 7.6 CTA Section (Gradient Background)

Large purple gradient background with concentric circle decorations.

```vue
<template>
  <section class="relative overflow-hidden bg-primary-500 px-4 py-20 sm:px-6 lg:px-8">
    <!-- Concentric circles (decorative) -->
    <div class="absolute inset-0 flex items-center justify-center" aria-hidden="true">
      <div class="size-[600px] rounded-full border border-white/10" />
      <div class="absolute size-[450px] rounded-full border border-white/10" />
      <div class="absolute size-[300px] rounded-full border border-white/10" />
    </div>

    <!-- Content -->
    <div class="relative z-10 mx-auto max-w-2xl text-center">
      <h2 class="text-h1 font-bold leading-heading text-white">
        Ready to Take Control of Your Health?
      </h2>
      <p class="mx-auto mt-4 max-w-lg text-body-lg leading-body text-white/80">
        Join thousands of patients who trust Curepath for their healthcare needs.
      </p>
      <div class="mt-10 flex justify-center">
        <button
          class="inline-flex size-14 items-center justify-center rounded-full bg-white text-primary-600 shadow-lg transition-transform hover:scale-105"
          aria-label="Get started"
        >
          <Icon name="ph:arrow-right" class="size-6" />
        </button>
      </div>
    </div>
  </section>
</template>
```

### 7.7 Footer

Multi-column footer with logo, tagline, link groups, and copyright bar.

```vue
<template>
  <footer class="bg-bg-dark px-4 pt-16 pb-8 sm:px-6 lg:px-8">
    <div class="mx-auto max-w-6xl">
      <!-- Top section -->
      <div class="grid grid-cols-1 gap-12 md:grid-cols-4">
        <!-- Brand column -->
        <div class="md:col-span-1">
          <NuxtLink to="/" class="flex items-center gap-2">
            <img src="/assets/logo-white.svg" alt="Curepath" class="h-8 w-auto" />
            <span class="text-h4 font-bold text-white">Curepath</span>
          </NuxtLink>
          <p class="mt-4 text-body-sm leading-body text-neutral-400">
            Healthcare Made Effortless. Anytime, Anywhere.
          </p>
        </div>

        <!-- Link columns -->
        <div v-for="group in footerLinks" :key="group.title">
          <h4 class="text-body-sm font-semibold text-white">{{ group.title }}</h4>
          <ul class="mt-4 space-y-3">
            <li v-for="link in group.links" :key="link.label">
              <NuxtLink
                :to="link.to"
                class="text-body-sm text-neutral-400 transition-colors hover:text-white"
              >
                {{ link.label }}
              </NuxtLink>
            </li>
          </ul>
        </div>
      </div>

      <!-- Divider -->
      <hr class="my-10 border-neutral-700" />

      <!-- Bottom bar -->
      <div class="flex flex-col items-center justify-between gap-4 sm:flex-row">
        <p class="text-caption text-neutral-500">
          &copy; {{ new Date().getFullYear() }} Curepath. All rights reserved.
        </p>
        <div class="flex items-center gap-4">
          <NuxtLink to="/privacy" class="text-caption text-neutral-500 hover:text-white">
            Privacy Policy
          </NuxtLink>
          <NuxtLink to="/terms" class="text-caption text-neutral-500 hover:text-white">
            Terms of Service
          </NuxtLink>
        </div>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
const footerLinks = [
  {
    title: 'Useful Links',
    links: [
      { label: 'About Us', to: '/about' },
      { label: 'Features', to: '/features' },
      { label: 'Pricing', to: '/pricing' },
      { label: 'Blog', to: '/blog' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'Careers', to: '/careers' },
      { label: 'Press', to: '/press' },
      { label: 'Partners', to: '/partners' },
    ],
  },
  {
    title: 'Support',
    links: [
      { label: 'Help Center', to: '/help' },
      { label: 'Contact Us', to: '/contact' },
      { label: 'FAQ', to: '/faq' },
    ],
  },
]
</script>
```

### 7.8 Appointment Card

```vue
<template>
  <div class="rounded-2xl bg-white p-5 shadow-sm">
    <div class="flex items-start gap-4">
      <!-- Doctor Avatar -->
      <img
        :src="doctor.avatar"
        :alt="doctor.name"
        class="size-12 rounded-full object-cover"
      />

      <!-- Info -->
      <div class="flex-1">
        <h4 class="text-body font-semibold text-text-primary">{{ doctor.name }}</h4>
        <p class="text-body-sm text-text-muted">{{ doctor.specialty }}</p>

        <div class="mt-3 flex items-center gap-3">
          <span class="inline-flex items-center gap-1 text-caption text-text-muted">
            <Icon name="ph:calendar" class="size-3.5" />
            {{ appointment.date }}
          </span>
          <span class="inline-flex items-center gap-1 text-caption text-text-muted">
            <Icon name="ph:clock" class="size-3.5" />
            {{ appointment.time }}
          </span>
        </div>
      </div>

      <!-- Status badge -->
      <span
        class="rounded-full bg-success/10 px-3 py-1 text-caption font-medium text-success"
      >
        Confirmed
      </span>
    </div>
  </div>
</template>
```

### 7.9 Doctor Card

```vue
<template>
  <div class="rounded-2xl bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
    <div class="flex flex-col items-center text-center">
      <img
        :src="doctor.avatar"
        :alt="doctor.name"
        class="size-20 rounded-full object-cover"
      />
      <h3 class="mt-4 text-body font-semibold text-text-primary">{{ doctor.name }}</h3>
      <p class="text-body-sm text-text-muted">{{ doctor.specialty }}</p>

      <div class="mt-2 flex items-center gap-1">
        <Icon name="ph:star-fill" class="size-4 text-warning" />
        <span class="text-body-sm font-medium text-text-primary">{{ doctor.rating }}</span>
        <span class="text-caption text-text-muted">({{ doctor.reviewCount }})</span>
      </div>

      <button
        class="mt-4 w-full rounded-full bg-primary-500 px-4 py-2.5 text-body-sm font-medium text-white transition-colors hover:bg-primary-600"
      >
        Book Appointment
      </button>
    </div>
  </div>
</template>
```

### 7.10 Visit Type Card

```vue
<template>
  <button
    class="flex items-center gap-4 rounded-xl border border-neutral-200 bg-white p-4 text-left transition-all hover:border-primary-300 hover:shadow-sm"
    :class="{ 'border-primary-500 ring-2 ring-primary-200': selected }"
  >
    <div
      class="flex size-10 items-center justify-center rounded-full"
      :class="selected ? 'bg-primary-500 text-white' : 'bg-primary-100 text-primary-500'"
    >
      <Icon :name="icon" class="size-5" />
    </div>
    <div>
      <p class="text-body-sm font-semibold text-text-primary">{{ title }}</p>
      <p class="text-caption text-text-muted">{{ description }}</p>
    </div>
  </button>
</template>
```

### 7.11 Form Inputs

Use shadcn-vue form components where available. For custom inputs, follow
this pattern:

```vue
<template>
  <div class="space-y-1.5">
    <label :for="id" class="text-body-sm font-medium text-text-primary">
      {{ label }}
    </label>
    <input
      :id="id"
      :type="type"
      :placeholder="placeholder"
      class="w-full rounded-[--radius-md] border border-input bg-white px-4 py-3 text-body-sm text-text-primary placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-ring/20 transition-colors"
    />
    <p v-if="hint" class="text-caption text-text-muted">{{ hint }}</p>
  </div>
</template>
```

### 7.12 shadcn-vue Components

shadcn-vue components live in `app/components/ui/`. Add new components using
the CLI:

```bash
npx shadcn-vue@latest add <component-name>
```

Components are auto-imported by Nuxt. No prefix is configured, so use
component names directly (e.g., `<Button>`, `<Card>`, `<Dialog>`).

When customizing shadcn-vue components, apply design tokens via the `cn()`
utility:

```vue
<template>
  <Button :class="cn('rounded-full bg-primary-500 hover:bg-primary-600', $attrs.class)">
    <slot />
  </Button>
</template>
```

### 7.13 CTA Banner (Gradient Card)

A contained, asymmetric-radius banner with a purple gradient background,
left-aligned content, a white pill CTA button, and decorative concentric
circles positioned on the right. Used as an inline call-to-action within a
page — distinct from the full-bleed CTA section (7.6).

**Assets:**
- `/assets/cta-banner-circles.svg` — decorative concentric circles graphic
- Arrow icon uses `ph:arrow-right` from the Phosphor icon set

**Design Specs:**
| Property          | Value                                              |
| ----------------- | -------------------------------------------------- |
| Background        | Gradient from `primary-500` to `primary-300` (161°) |
| Border radius     | Asymmetric: TL 100px, TR 20px, BR 100px, BL 20px  |
| Padding           | `px-[70px] py-[100px]` (desktop)                   |
| Heading size      | 3.5rem (56px), `leading-display`, white             |
| Subtitle size     | `text-xl` (20px), `leading-body`, `neutral-200`    |
| Button            | White pill, dark text (`neutral-800`), arrow icon   |
| Circles position  | Absolute right, vertically centered, partially clipped |

```vue
<template>
  <section
    class="relative overflow-hidden rounded-tl-[100px] rounded-tr-[20px] rounded-br-[100px] rounded-bl-[20px] px-10 py-16 lg:px-[70px] lg:py-[100px]"
    style="background: linear-gradient(161deg, var(--color-primary-500) 0%, var(--color-primary-300) 100%)"
  >
    <!-- Content -->
    <div class="relative z-10 flex max-w-xl flex-col gap-8">
      <!-- Heading -->
      <div class="flex flex-col gap-4">
        <h2 class="text-h1 font-bold leading-display text-white lg:text-[3.5rem]">
          Let's Redefine Healthcare Together
        </h2>
        <p class="text-body-lg leading-body text-neutral-200 lg:text-xl">
          Partner with Curepath to make expert medical care faster, smarter,
          and truly accessible — anytime, anywhere.
        </p>
      </div>

      <!-- CTA Button -->
      <div>
        <NuxtLink
          to="/signup"
          class="inline-flex items-center gap-2.5 rounded-full bg-white px-5 py-2.5 text-body font-medium text-neutral-800 transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Get Started Now
          <Icon name="ph:arrow-right" class="size-5" aria-hidden="true" />
        </NuxtLink>
      </div>
    </div>

    <!-- Decorative circles -->
    <img
      src="/assets/cta-banner-circles.svg"
      alt=""
      aria-hidden="true"
      class="pointer-events-none absolute right-0 top-1/2 h-auto w-[500px] -translate-y-1/2 translate-x-1/4 lg:w-[900px]"
    />
  </section>
</template>
```

**Usage within a page:**

```vue
<template>
  <div class="mx-auto max-w-6xl px-4 py-[--spacing-section] sm:px-6 lg:px-8">
    <!-- Other content above... -->

    <!-- CTA Banner -->
    <CtaBanner />
  </div>
</template>
```

**Responsive behavior:**

| Breakpoint | Padding               | Heading Size      | Circles Width |
| ---------- | --------------------- | ----------------- | ------------- |
| Mobile     | `px-10 py-16`         | `text-h1` (3rem)  | 500px         |
| Desktop    | `px-[70px] py-[100px]`| 3.5rem (56px)     | 900px         |

---

## 8. Layout Patterns

### Max-Width Container

All page content uses a centered container with a maximum width.

```vue
<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
  <!-- content -->
</div>
```

| Container     | Class          | Width   | Usage                        |
| ------------- | -------------- | ------- | ---------------------------- |
| Wide          | `max-w-7xl`    | 1280px  | Page-level container         |
| Content       | `max-w-6xl`    | 1152px  | Grid sections, feature areas |
| Narrow        | `max-w-4xl`    | 896px   | Hero text, centered content  |
| Text          | `max-w-2xl`    | 672px   | Paragraphs, descriptions     |
| Form          | `max-w-md`     | 448px   | Login forms, narrow modals   |

### Section Spacing

Every page section follows a consistent vertical rhythm.

```vue
<section class="px-4 py-[--spacing-section] sm:px-6 lg:px-8">
  <div class="mx-auto max-w-6xl">
    <!-- Section header -->
    <div class="mb-12 text-center">
      <h2 class="text-h2 font-bold leading-heading text-text-primary">Section Title</h2>
      <p class="mx-auto mt-4 max-w-2xl text-body-lg text-text-secondary">
        Section description text goes here.
      </p>
    </div>

    <!-- Section content -->
    <div>
      <!-- ... -->
    </div>
  </div>
</section>
```

### Grid Patterns

```vue
<!-- 2-column feature grid -->
<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:gap-8">
  <!-- cards -->
</div>

<!-- 3-column card grid -->
<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
  <!-- cards -->
</div>

<!-- 4-column footer links -->
<div class="grid grid-cols-1 gap-12 md:grid-cols-4">
  <!-- columns -->
</div>

<!-- 2-column with image (content + mockup) -->
<div class="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
  <div>
    <!-- text content -->
  </div>
  <div>
    <!-- image / phone mockup -->
  </div>
</div>
```

### Full-Bleed Pattern

For sections that span the full viewport width (e.g., CTA, hero backgrounds):

```vue
<section class="relative overflow-hidden bg-primary-500">
  <div class="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
    <!-- content stays within container -->
  </div>
</section>
```

---

## 9. Icon Usage

Icons use `@nuxt/icon` with the **Phosphor** icon set. The `<Icon>` component
is globally available (auto-imported).

### Syntax

```vue
<!-- Default (regular weight) -->
<Icon name="ph:heart" class="size-5" />

<!-- Bold weight -->
<Icon name="ph:heart-bold" class="size-5" />

<!-- Fill variant -->
<Icon name="ph:heart-fill" class="size-5" />

<!-- Duotone variant -->
<Icon name="ph:heart-duotone" class="size-5" />
```

### Common Icons

| Purpose              | Icon Name                | Preview Context         |
| -------------------- | ------------------------ | ----------------------- |
| Arrow right          | `ph:arrow-right`         | Buttons, CTAs           |
| Arrow left           | `ph:arrow-left`          | Back navigation         |
| Calendar             | `ph:calendar`            | Appointments            |
| Calendar check       | `ph:calendar-check`      | Confirmed appointments  |
| Clock                | `ph:clock`               | Time / schedule         |
| Chat                 | `ph:chat-circle`         | Messaging               |
| Video camera         | `ph:video-camera`        | Video consultations     |
| Heart                | `ph:heart`               | Health / favorites      |
| Stethoscope          | `ph:stethoscope`         | Doctor / medical        |
| User                 | `ph:user`                | Profile                 |
| Star (filled)        | `ph:star-fill`           | Ratings                 |
| Check circle         | `ph:check-circle`        | Success states          |
| Warning              | `ph:warning`             | Alerts                  |
| X (close)            | `ph:x`                   | Close / dismiss         |
| List (hamburger)     | `ph:list`                | Mobile menu toggle      |
| Magnifying glass     | `ph:magnifying-glass`    | Search                  |
| File text            | `ph:file-text`           | Medical records         |
| Shield check         | `ph:shield-check`        | Security / privacy      |
| Phone                | `ph:phone`               | In-person call          |
| Map pin              | `ph:map-pin`             | Location                |
| Bell                 | `ph:bell`                | Notifications           |
| Gear                 | `ph:gear`                | Settings                |
| Sign out             | `ph:sign-out`            | Logout                  |
| Plus                 | `ph:plus`                | Add / create            |

### Sizing Convention

| Context                    | Class     | Pixel Size |
| -------------------------- | --------- | ---------- |
| Inline with small text     | `size-3.5`| 14px       |
| Inline with body text      | `size-4`  | 16px       |
| Button icon                | `size-4`  | 16px       |
| Standalone small           | `size-5`  | 20px       |
| Feature card icon          | `size-6`  | 24px       |
| Large decorative           | `size-8`  | 32px       |
| Hero / illustration        | `size-10` | 40px       |

### Rules

- Never install additional icon packages. All icons come from the Phosphor set
  via `@nuxt/icon`.
- Always add `aria-label` or `aria-hidden="true"` to icons. Decorative icons
  (next to visible text) get `aria-hidden="true"`. Standalone icons (icon-only
  buttons) require an `aria-label` on the parent button.
- Use the `class` attribute for sizing and color. Apply text color utilities
  directly on the `<Icon>` component.

---

## 10. Responsive Breakpoints

Tailwind CSS v4 default breakpoints are used.

| Breakpoint | Min Width | Tailwind Prefix | Typical Use                    |
| ---------- | --------- | --------------- | ------------------------------ |
| Default    | 0px       | (none)          | Mobile-first base styles       |
| `sm`       | 640px     | `sm:`           | Large phones, small tablets    |
| `md`       | 768px     | `md:`           | Tablets                        |
| `lg`       | 1024px    | `lg:`           | Small desktops, laptops        |
| `xl`       | 1280px    | `xl:`           | Standard desktops              |
| `2xl`      | 1536px    | `2xl:`          | Large desktops                 |

### Responsive Patterns

**Mobile-first approach** -- always write base styles for mobile, then
enhance for larger screens.

```vue
<!-- Navigation: hidden on mobile, flex on medium+ -->
<ul class="hidden md:flex items-center gap-8">
  <!-- nav links -->
</ul>

<!-- Grid: single column on mobile, 2 cols on sm, 3 on lg -->
<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
  <!-- items -->
</div>

<!-- Typography: scale down on mobile -->
<h1 class="text-h1 font-bold leading-heading lg:text-display lg:leading-display">
  Healthcare Made Effortless
</h1>

<!-- Padding: tighter on mobile -->
<section class="px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
  <!-- content -->
</section>
```

### Key Responsive Behaviors

| Component     | Mobile              | Tablet (`md`)       | Desktop (`lg`)       |
| ------------- | ------------------- | ------------------- | -------------------- |
| Nav links     | Hidden (hamburger)  | Visible (flex row)  | Visible (flex row)   |
| Hero heading  | `text-h1`           | `text-h1`           | `text-display`       |
| Feature grid  | 1 column            | 2 columns           | 2 columns            |
| Card grid     | 1 column            | 2 columns           | 3 columns            |
| Footer        | Stacked             | 2 columns           | 4 columns            |
| Section py    | `py-12`             | `py-16`             | `py-20`              |

---

## 11. Animation and Transitions

### Standard Transitions

Use Tailwind's `transition-*` utilities for interactive state changes.

```vue
<!-- Color transitions (buttons, links) -->
<button class="transition-colors hover:bg-primary-600">...</button>

<!-- Shadow transitions (cards on hover) -->
<div class="shadow-sm transition-shadow hover:shadow-md">...</div>

<!-- Transform transitions (scale on hover) -->
<button class="transition-transform hover:scale-105">...</button>

<!-- Combined transitions -->
<div class="transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
  ...
</div>
```

### Duration Guidelines

| Context                | Duration Class    | Milliseconds |
| ---------------------- | ----------------- | ------------ |
| Color / opacity change | `duration-150`    | 150ms        |
| Default transitions    | `duration-200`    | 200ms        |
| Layout / transform     | `duration-300`    | 300ms        |
| Page transitions       | `duration-300`    | 300ms        |
| Complex animations     | `duration-500`    | 500ms        |

### Nuxt Page Transitions

Use Nuxt's built-in `<NuxtPage>` transition support:

```vue
<!-- app.vue -->
<template>
  <div>
    <NuxtRouteAnnouncer />
    <NuxtPage
      :transition="{
        name: 'page',
        mode: 'out-in',
      }"
    />
  </div>
</template>

<style>
.page-enter-active,
.page-leave-active {
  transition: opacity 300ms ease, transform 300ms ease;
}
.page-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.page-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
```

### Scroll Animations

For scroll-triggered animations, use the `IntersectionObserver` pattern with
a composable. Avoid heavy animation libraries.

```ts
// composables/useScrollReveal.ts
export function useScrollReveal() {
  const isVisible = ref(false)
  const target = ref<HTMLElement | null>(null)

  onMounted(() => {
    if (!target.value) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          isVisible.value = true
          observer.disconnect()
        }
      },
      { threshold: 0.1 }
    )
    observer.observe(target.value)
  })

  return { target, isVisible }
}
```

### Motion Preferences

Always respect `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 12. Accessibility Requirements

### WCAG 2.1 AA Compliance (Minimum)

All pages and components must meet WCAG 2.1 Level AA.

### Color Contrast

- **Normal text** (under 18px or under 14px bold): minimum contrast ratio 4.5:1
- **Large text** (18px+ or 14px+ bold): minimum contrast ratio 3:1
- **UI components and graphical objects**: minimum contrast ratio 3:1

Pre-validated combinations:

| Foreground            | Background       | Ratio | Pass   |
| --------------------- | ---------------- | ----- | ------ |
| `text-primary` #262730 | `bg-primary` #FFFFFF | 14.5:1 | AA, AAA |
| `text-secondary` #4B5563 | `bg-primary` #FFFFFF | 7.4:1 | AA, AAA |
| `text-muted` #6B7280 | `bg-primary` #FFFFFF | 5.0:1 | AA     |
| `text-inverse` #FFFFFF | `bg-neutral-800` #1F2937 | 13.0:1 | AA, AAA |
| `text-inverse` #FFFFFF | `bg-primary-500` #8B5CF6 | 4.6:1 | AA     |

### Keyboard Navigation

- All interactive elements must be reachable via Tab key.
- Focus states must be visible: use `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`.
- Custom components must implement proper `role`, `tabindex`, and `aria-*` attributes.
- Modal dialogs must trap focus. Use shadcn-vue `<Dialog>` which handles this.

### Semantic HTML

- Use correct heading hierarchy (`h1` > `h2` > `h3`, etc.). One `h1` per page.
- Use `<nav>` for navigation, `<main>` for primary content, `<section>` with headings, `<footer>` for footer.
- Use `<button>` for actions and `<a>` / `<NuxtLink>` for navigation.
- Form inputs must have associated `<label>` elements.

### Images and Icons

- All meaningful images must have descriptive `alt` text.
- Decorative images use `alt=""` or `aria-hidden="true"`.
- Icon-only buttons require `aria-label`.

### ARIA Patterns

```vue
<!-- Icon button -->
<button aria-label="Close dialog" class="...">
  <Icon name="ph:x" class="size-5" aria-hidden="true" />
</button>

<!-- Status badge -->
<span role="status" class="...">
  Appointment Confirmed
</span>

<!-- Loading state -->
<div aria-live="polite" aria-busy="true">
  Loading appointments...
</div>

<!-- Navigation landmark -->
<nav aria-label="Main navigation">
  <!-- links -->
</nav>
```

### Form Accessibility

```vue
<div class="space-y-1.5">
  <label for="email" class="text-body-sm font-medium text-text-primary">
    Email Address
  </label>
  <input
    id="email"
    type="email"
    required
    aria-describedby="email-hint email-error"
    class="..."
  />
  <p id="email-hint" class="text-caption text-text-muted">
    We will never share your email.
  </p>
  <p v-if="error" id="email-error" role="alert" class="text-caption text-error">
    {{ error }}
  </p>
</div>
```

### NuxtRouteAnnouncer

The `<NuxtRouteAnnouncer />` component is included in `app.vue` and
automatically announces page changes to screen readers.

---

## 13. File Structure Conventions

```
eztech/
  app/
    assets/
      css/
        tailwind.css          # Tailwind v4 theme (design tokens)
    components/
      ui/                     # shadcn-vue primitives (auto-generated)
        Button.vue
        Card.vue
        Dialog.vue
        Input.vue
        ...
      landing/                # Landing page sections
        NavBar.vue
        HeroSection.vue
        FeaturesGrid.vue
        CTASection.vue
        FooterSection.vue
      app/                    # In-app components (dashboard, booking, etc.)
        AppointmentCard.vue
        DoctorCard.vue
        VisitTypeCard.vue
        ...
      shared/                 # Reusable across landing and app
        Badge.vue
        IconCircle.vue
        SectionHeader.vue
        ...
    composables/              # Vue composables (auto-imported)
      useScrollReveal.ts
      ...
    layouts/                  # Nuxt layouts
      default.vue             # Landing page layout (nav + footer)
      app.vue                 # Authenticated app layout (sidebar)
    lib/
      utils.ts                # cn() helper
    pages/                    # File-based routing
      index.vue               # Home / landing page
      features.vue
      pricing.vue
      login.vue
      signup.vue
      dashboard/
        index.vue
        appointments.vue
        messages.vue
        records.vue
        settings.vue
  public/
    assets/                   # Static assets (downloaded from Figma)
      images/
        hero-mockup.png
        ...
      icons/
        icon-name.svg
        ...
      logo.svg
      logo-white.svg
  nuxt.config.ts
  tailwind.css                # (symlink or Nuxt resolves via config)
  DESIGN_SYSTEM.md            # This file
```

### Naming Conventions

| Item              | Convention           | Example                   |
| ----------------- | -------------------- | ------------------------- |
| Vue components    | PascalCase           | `DoctorCard.vue`          |
| Composables       | camelCase, `use` prefix | `useScrollReveal.ts`   |
| Pages             | kebab-case           | `my-appointments.vue`     |
| CSS files         | kebab-case           | `tailwind.css`            |
| Asset files       | kebab-case           | `hero-mockup.png`         |
| Icon assets       | `icon-` prefix       | `icon-arrow-right.svg`    |
| TypeScript types  | PascalCase           | `Appointment`, `Doctor`   |

### Component Organization Rules

1. **shadcn-vue components** go in `app/components/ui/`. Never modify them
   directly; extend via wrapper components if customization is needed.
2. **Page-specific section components** go in a subdirectory matching their
   context (e.g., `landing/`, `app/`, `dashboard/`).
3. **Shared components** used across multiple contexts go in
   `app/components/shared/`.
4. Components are auto-imported by Nuxt. Use them directly in templates
   without explicit import statements.
5. Every new component should include TypeScript props with default values and
   JSDoc comments for non-obvious props.

### Adding New Components Checklist

- [ ] Check if a shadcn-vue primitive exists first (`npx shadcn-vue@latest add <name>`)
- [ ] Use design tokens from this document (never hardcode hex values)
- [ ] Ensure keyboard navigability and ARIA compliance
- [ ] Add focus-visible ring styles to all interactive elements
- [ ] Test at mobile, tablet, and desktop breakpoints
- [ ] Validate color contrast against the table in Section 12

---

## Quick Reference Card

### Most-Used Tailwind Classes

```
Text:       text-text-primary  text-text-secondary  text-text-muted  text-text-inverse
Bg:         bg-bg-primary  bg-bg-secondary  bg-bg-muted  bg-bg-dark
Brand:      bg-primary-500  text-primary-500  border-primary-500  ring-ring
Neutral:    bg-neutral-100  border-neutral-200  text-neutral-600
Type:       text-display  text-h1  text-h2  text-h3  text-h4  text-body  text-body-sm  text-caption
Leading:    leading-display  leading-heading  leading-body
Radius:     rounded-full  rounded-2xl  rounded-xl  rounded-[--radius-md]
Container:  mx-auto max-w-7xl px-4 sm:px-6 lg:px-8
Section:    py-[--spacing-section] or py-20
Focus:      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
Transition: transition-colors  transition-shadow  transition-transform  transition-all duration-200
```
