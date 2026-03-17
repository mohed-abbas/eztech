# EzTech Design System 2.0

Design system reference for the EzTech delivery and tech rental platform.
UI patterns adapted from the TroxRide design language; color scheme and tokens
from the original EzTech brand identity.

All token names and class utilities map directly to the Tailwind CSS v4 theme
defined in `app/assets/css/tailwind.css`.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Color Palette](#2-color-palette)
3. [Typography](#3-typography)
4. [Spacing System](#4-spacing-system)
5. [Border Radius](#5-border-radius)
6. [Shadow System](#6-shadow-system)
7. [Button Patterns](#7-button-patterns)
8. [Card Patterns](#8-card-patterns)
9. [Section Patterns](#9-section-patterns)
10. [Navigation](#10-navigation)
11. [Footer](#11-footer)
12. [Form Elements](#12-form-elements)
13. [Icon Usage](#13-icon-usage)
14. [Responsive Breakpoints](#14-responsive-breakpoints)
15. [Animation and Transitions](#15-animation-and-transitions)
16. [Accessibility Requirements](#16-accessibility-requirements)
17. [File Structure Conventions](#17-file-structure-conventions)

---

## 1. Project Overview

**Product:** EzTech -- a delivery service platform for renting and delivering
tech equipment, gadgets, and accessories.

### Tech Stack

| Layer             | Technology                          |
| ----------------- | ----------------------------------- |
| Framework         | Nuxt.js 4 (Vue 3, Composition API) |
| Styling           | Tailwind CSS v4                     |
| Component Library | shadcn-vue (via `shadcn-nuxt`)      |
| Primitives        | Reka UI (headless components)       |
| Class Utilities   | `clsx` + `tailwind-merge` via `cn()` |
| Icons             | `@nuxt/icon` (Phosphor icon set)    |
| Fonts             | `@nuxt/fonts` (Inter, JetBrains Mono) |

### Design Principles (v2.0)

- **Bold & clean**: Large display headings with generous whitespace
- **Pill-shaped interactions**: Buttons, inputs, and badges use full-radius pill shapes
- **Subtle elevation**: Soft shadows and inner-glow gradients instead of hard borders
- **Asymmetric accents**: Feature cards use one oversized rounded corner for visual interest
- **Tinted surfaces**: Stat and feature cards use light tinted backgrounds instead of plain white
- **Rounded sections**: CTA banners and footer use large border-radius (32px)

---

## 2. Color Palette

### Primary -- Purple

The main brand color used for primary CTAs, links, focus rings, and key accents.

| Token          | Value     | Tailwind Class    | Usage                           |
| -------------- | --------- | ----------------- | ------------------------------- |
| `primary-50`   | `#F5F3FF` | `bg-primary-50`   | Light tinted backgrounds        |
| `primary-100`  | `#EDE9FE` | `bg-primary-100`  | Badge backgrounds, hover states |
| `primary-200`  | `#DDD6FE` | `bg-primary-200`  | Subtle borders, focus rings     |
| `primary-300`  | `#C4B5FD` | `text-primary-300` | Decorative accents             |
| `primary-400`  | `#A78BFA` | `text-primary-400` | Hover states on primary        |
| `primary-500`  | `#8B5CF6` | `bg-primary-500`  | **Main brand** (buttons, links) |
| `primary-600`  | `#7C3AED` | `bg-primary-600`  | Active/pressed states           |
| `primary-700`  | `#6D28D9` | `bg-primary-700`  | Dark hover/emphasis             |
| `primary-800`  | `#5B21B6` | `bg-primary-800`  | Dark backgrounds                |
| `primary-900`  | `#4C1D95` | `bg-primary-900`  | Deepest brand surface           |

### Accent -- Indigo

Secondary brand for decorative elements and complementary CTAs.

| Token         | Value     | Tailwind Class   | Usage                    |
| ------------- | --------- | ---------------- | ------------------------ |
| `accent-100`  | `#E4E4FF` | `bg-accent-100`  | Light accent backgrounds |
| `accent-200`  | `#C6C6FF` | `bg-accent-200`  | Accent borders           |
| `accent-300`  | `#A8A8FF` | `text-accent-300` | Decorative elements     |
| `accent-400`  | `#7272FF` | `text-accent-400` | Secondary interactive   |
| `accent-500`  | `#6366F1` | `bg-accent-500`  | **Main accent** (indigo) |
| `accent-600`  | `#4F46E5` | `bg-accent-600`  | Accent hover states      |
| `accent-700`  | `#4338CA` | `bg-accent-700`  | Accent active states     |
| `accent-800`  | `#3730A3` | `bg-accent-800`  | Deep accent surfaces     |
| `accent-900`  | `#312E81` | `bg-accent-900`  | Darkest accent           |

### Neutral -- Gray

Used for text, borders, backgrounds, and UI chrome.

| Token          | Value     | Tailwind Class     | Usage                  |
| -------------- | --------- | ------------------ | ---------------------- |
| `neutral-50`   | `#F9FAFB` | `bg-neutral-50`    | Elevated backgrounds   |
| `neutral-100`  | `#F3F4F6` | `bg-neutral-100`   | Card / section bg      |
| `neutral-200`  | `#E5E7EB` | `border-neutral-200` | Borders, dividers    |
| `neutral-300`  | `#D1D5DB` | `border-neutral-300` | Disabled borders     |
| `neutral-400`  | `#9CA3AF` | `text-neutral-400` | Placeholder text, muted logos |
| `neutral-500`  | `#6B7280` | `text-neutral-500` | Muted text, captions   |
| `neutral-600`  | `#4B5563` | `text-neutral-600` | Secondary text         |
| `neutral-700`  | `#374151` | `text-neutral-700` | Dark text emphasis     |
| `neutral-800`  | `#1F2937` | `bg-neutral-800`   | Dark action buttons, bg |
| `neutral-900`  | `#111827` | `text-neutral-900` | Headings, near-black   |

### Semantic Colors

| Token     | Value     | Tailwind Class | Usage                     |
| --------- | --------- | -------------- | ------------------------- |
| `success` | `#10B981` | `text-success` | Confirmed, available      |
| `warning` | `#F59E0B` | `text-warning` | Alerts, caution           |
| `error`   | `#EF4444` | `text-error`   | Errors, destructive       |
| `info`    | `#3B82F6` | `text-info`    | Informational             |

### Surface Tints (v2.0)

Subtle tinted backgrounds for stat cards and feature sections.

| Token            | Value     | Tailwind Class        | Usage                    |
| ---------------- | --------- | --------------------- | ------------------------ |
| `surface-purple` | `#F5F3FF` | `bg-surface-purple`   | Primary-tinted cards     |
| `surface-indigo` | `#EEEEFF` | `bg-surface-indigo`   | Accent-tinted cards      |
| `surface-warm`   | `#FFFBF0` | `bg-surface-warm`     | Warm stat/feature cards  |
| `surface-cool`   | `#F0F9FF` | `bg-surface-cool`     | Cool stat/feature cards  |

### Text Colors

| Token            | Value                     | Tailwind Class       | Usage                    |
| ---------------- | ------------------------- | -------------------- | ------------------------ |
| `text-primary`   | `#262730`                 | `text-text-primary`  | Headings, body text      |
| `text-secondary` | `#4B5563`                 | `text-text-secondary` | Secondary body text     |
| `text-muted`     | `#6B7280`                 | `text-text-muted`    | Captions, helper text    |
| `text-subtle`    | `rgba(68, 69, 78, 0.7)`  | `text-text-subtle`   | Section descriptions     |
| `text-inverse`   | `#FFFFFF`                 | `text-text-inverse`  | Text on dark backgrounds |

### Background Colors

| Token          | Value     | Tailwind Class     | Usage                       |
| -------------- | --------- | ------------------ | --------------------------- |
| `bg-primary`   | `#FFFFFF` | `bg-bg-primary`    | Main page background        |
| `bg-secondary` | `#F5F3FF` | `bg-bg-secondary`  | Purple-tinted sections      |
| `bg-muted`     | `#F3F4F6` | `bg-bg-muted`      | Muted section backgrounds   |
| `bg-elevated`  | `#F9FAFB` | `bg-bg-elevated`   | Elevated sections (like app showcase) |
| `bg-dark`      | `#1F2937` | `bg-bg-dark`       | Dark sections               |
| `bg-darker`    | `#111827` | `bg-bg-darker`     | Darker sections             |
| `bg-darkest`   | `#0E0E0E` | `bg-bg-darkest`    | CTA banner gradient start   |

---

## 3. Typography

### Font Families

| Token           | Stack                                    | Tailwind Class  |
| --------------- | ---------------------------------------- | --------------- |
| `--font-sans`   | Inter, ui-sans-serif, system-ui, sans-serif | `font-sans`  |
| `--font-heading` | Inter, ui-sans-serif, system-ui, sans-serif | `font-heading` |
| `--font-mono`   | JetBrains Mono, ui-monospace, monospace  | `font-mono`     |

Fonts are auto-loaded via `@nuxt/fonts`.

### Type Scale

| Name        | Size   | px   | Tailwind Class   | Weight   | Line Height | Usage                        |
| ----------- | ------ | ---- | ---------------- | -------- | ----------- | ---------------------------- |
| Display     | 4.75rem | 76px | `text-display`   | semibold | 1.2         | Hero headlines               |
| Display SM  | 3.5rem | 56px | `text-display-sm` | medium  | 1.2         | CTA banner headlines         |
| H1          | 3rem   | 48px | `text-h1`        | medium   | 1.2         | Section headings             |
| H2          | 2.25rem | 36px | `text-h2`       | medium   | 1.2         | Stat numbers, sub-headings   |
| H3          | 1.5rem | 24px | `text-h3`        | semibold | 1.2         | Card titles, nav logo text   |
| H4          | 1.25rem | 20px | `text-h4`       | medium   | 1.2         | Card headings, footer titles |
| Body LG     | 1.25rem | 20px | `text-body-lg`  | normal   | 1.5         | Section descriptions         |
| Body        | 1rem   | 16px | `text-body`      | normal   | 1.5         | Body text, footer links      |
| Body SM     | 0.875rem | 14px | `text-body-sm`  | medium   | 1.5         | Button labels, small text    |
| Caption     | 0.75rem | 12px | `text-caption`  | normal   | 1.5         | Meta text, badges, specs     |

### Heading Styles (v2.0)

```vue
<!-- Hero headline -->
<h1 class="text-display font-semibold leading-display capitalize text-neutral-800">
  Rent Premium. Deliver Smart.
</h1>

<!-- Section heading -->
<h2 class="text-h1 font-medium leading-heading capitalize text-text-primary">
  Browse Smarter, Rent Faster
</h2>

<!-- CTA banner heading -->
<h2 class="text-display-sm font-medium leading-heading text-white text-center">
  Let's get your tech — delivered in style.
</h2>

<!-- Stat number -->
<p class="text-h2 font-medium leading-heading text-neutral-800">250+</p>

<!-- Section description (subtle opacity) -->
<p class="text-body-lg leading-body text-text-subtle">
  Premium tech equipment delivered to your door.
</p>
```

---

## 4. Spacing System

### CSS Variables

| Token                | Value      | px   | Usage                               |
| -------------------- | ---------- | ---- | ----------------------------------- |
| `--ds-space-xs`      | 0.25rem    | 4px  | Tight inner padding, icon gaps      |
| `--ds-space-sm`      | 0.5rem     | 8px  | Small gaps, icon spacing            |
| `--ds-space-md`      | 1rem       | 16px | Default component padding           |
| `--ds-space-lg`      | 1.5rem     | 24px | Card padding, column gaps           |
| `--ds-space-xl`      | 2rem       | 32px | Section inner padding               |
| `--ds-space-2xl`     | 2.5rem     | 40px | Gap between heading and content     |
| `--ds-space-3xl`     | 4rem       | 64px | Large section gaps                  |
| `--ds-space-4xl`     | 6rem       | 96px | Container horizontal padding        |
| `--ds-space-section-x` | 6.25rem | 100px | Horizontal section padding         |
| `--ds-space-section-y` | 10rem   | 160px | Vertical section padding (large)   |
| `--ds-space-section-y-sm` | 5rem | 80px | Vertical section padding (small)   |

### Practical Spacing Guide (v2.0)

| Context                     | Tailwind Classes         |
| --------------------------- | ------------------------ |
| Icon + label                | `gap-2` (8px)            |
| Button padding              | `px-6 py-3`             |
| Card inner padding          | `p-5` (20px)            |
| Form field spacing          | `space-y-4` (16px)      |
| Heading to content          | `gap-10` (40px)          |
| Section vertical padding    | `py-40` (160px) or `pt-40 pb-20` |
| Section horizontal padding  | `px-[100px]`             |
| Grid gaps                   | `gap-6` or `gap-8`      |
| Container max-width         | `max-w-[1240px] mx-auto` |
| Between sections            | `gap-0` (sections handle own padding) |

---

## 5. Border Radius

### Tokens

| Token             | Value      | Tailwind Class      | Usage                          |
| ----------------- | ---------- | ------------------- | ------------------------------ |
| `radius-sm`       | 0.375rem   | `rounded-[--radius-sm]`  | Tags, small badges        |
| `radius-md`       | 0.5rem     | `rounded-[--radius-md]`  | Product cards, inputs     |
| `radius-lg`       | 0.75rem    | `rounded-[--radius-lg]`  | Cards, modals             |
| `radius-xl`       | 1rem       | `rounded-[--radius-xl]`  | Large cards               |
| `radius-2xl`      | 1.5rem     | `rounded-[--radius-2xl]` | Image containers          |
| `radius-3xl`      | 2rem       | `rounded-3xl`            | **CTA banners, footer** (v2.0) |
| `radius-feature`  | 2.9375rem  | `rounded-tl-feature` etc. | **Asymmetric card corners** (v2.0) |
| `radius-full`     | 9999px     | `rounded-full`           | Pill buttons, avatars, badges |

### Asymmetric Radius Pattern (v2.0)

Feature and stat cards use one oversized corner for visual interest:

```vue
<!-- Top-left feature corner -->
<div class="rounded-tl-feature rounded-tr-[--radius-md] rounded-br-[--radius-md] rounded-bl-[--radius-md]">

<!-- Bottom-right feature corner -->
<div class="rounded-br-feature rounded-tl-[--radius-md] rounded-tr-[--radius-md] rounded-bl-[--radius-md]">

<!-- Using utility classes -->
<div class="rounded-tl-feature bg-surface-cool p-5">...</div>
<div class="rounded-br-feature bg-surface-warm p-5">...</div>
<div class="rounded-tr-feature bg-surface-purple p-5">...</div>
```

### Component Radius Guide

| Component            | Radius               |
| -------------------- | -------------------- |
| Pill buttons / CTAs  | `rounded-full`       |
| Badges / Tags        | `rounded-full`       |
| Product cards        | `rounded-[--radius-md]` |
| Feature/stat cards   | Asymmetric (`rounded-*-feature`) |
| CTA banner           | `rounded-3xl`        |
| Footer               | `rounded-3xl`        |
| Input fields         | `rounded-full` (pill) |
| Newsletter input     | `rounded-full`       |
| Modals / Dialogs     | `rounded-[--radius-lg]` |
| Avatars              | `rounded-full`       |

---

## 6. Shadow System

| Tailwind Class | Usage                                |
| -------------- | ------------------------------------ |
| `shadow-sm`    | Product cards, subtle elevation      |
| `shadow`       | Default card shadow                  |
| `shadow-md`    | Elevated cards, dropdowns            |
| `shadow-lg`    | Modals, floating elements            |
| `shadow-xl`    | Hero mockups, prominent elements     |
| `shadow-none`  | Flat elements on colored backgrounds |

### Product Card Shadow

```vue
<!-- Standard product card -->
<div class="rounded-[--radius-md] bg-neutral-50 border border-neutral-200 p-4 shadow-[0_0_50px_0_rgba(0,0,0,0.1)]">

<!-- Hover elevation -->
<div class="... shadow-sm hover:shadow-md transition-shadow duration-200">
```

---

## 7. Button Patterns

### Primary CTA -- Gradient Pill (v2.0)

The main call-to-action button. Uses a purple gradient with an inner-glow highlight.

```vue
<button class="btn-gradient-primary rounded-full px-6 py-3 text-body-sm font-medium text-white capitalize border border-white/10 relative overflow-hidden">
  Get Started
</button>
```

CSS (defined in `tailwind.css`):
```css
.btn-gradient-primary {
  background-image: linear-gradient(110deg, rgba(139, 92, 246, 0.85) 0%, #7C3AED 40%);
  box-shadow: inset 0 3px 0 0 rgba(255, 255, 255, 0.25);
}
```

### Dark CTA -- For Dark Sections

Used when the button sits on a light background and you want a dark, authoritative look.

```vue
<button class="btn-gradient-dark rounded-full px-6 py-3 text-body-sm font-medium text-white capitalize border border-white/10 relative overflow-hidden">
  Browse Equipment
</button>
```

### Secondary CTA -- Glass Pill

White background with a subtle multi-shadow for depth.

```vue
<button class="btn-glass bg-white rounded-full px-6 py-2.5 text-body-sm font-medium text-text-primary capitalize">
  Explore Demo
</button>
```

### Action Button -- Solid Pill (In-Card)

Used inside product cards for "Rent Now", "Add to Cart" etc.

```vue
<button class="bg-primary-500 hover:bg-primary-600 rounded-full px-4 py-2 text-body-sm font-medium text-white transition-colors">
  Rent Now
</button>
```

Neutral variant (dark):
```vue
<button class="bg-neutral-800 hover:bg-neutral-900 rounded-full px-4 py-2 text-body-sm font-medium text-white transition-colors">
  Rent Now
</button>
```

### CTA With Icon -- White Pill + Arrow

Used in CTA banners on dark backgrounds.

```vue
<button class="bg-white rounded-full px-5 py-2.5 flex items-center gap-2.5 text-body font-medium text-neutral-800">
  Book Your Ride Now
  <Icon name="ph:arrow-right" class="size-5" />
</button>
```

### Button Size Reference

| Size    | Padding       | Text Size      | Usage             |
| ------- | ------------- | -------------- | ----------------- |
| Default | `px-6 py-3`   | `text-body-sm`  | Primary CTAs     |
| Small   | `px-4 py-2`   | `text-body-sm`  | Card actions     |
| Large   | `px-8 py-4`   | `text-body`     | Hero CTAs        |
| Icon    | `p-3`         | --              | Send/action btn  |

---

## 8. Card Patterns

### Product Card

The main listing card for equipment/items.

```vue
<div class="bg-neutral-50 border border-neutral-200 rounded-[--radius-md] p-4 shadow-[0_0_50px_0_rgba(0,0,0,0.1)]">
  <!-- Title + subtitle -->
  <div class="leading-[1.4]">
    <p class="text-[18px] font-semibold text-neutral-800">MacBook Pro M3</p>
    <p class="text-caption font-medium text-neutral-500">Laptop</p>
  </div>

  <!-- Product image -->
  <div class="h-28 w-full my-2">
    <img src="..." alt="..." class="object-contain size-full" />
  </div>

  <!-- Specs row -->
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-1">
      <Icon name="ph:cpu" class="size-[18px] text-neutral-500" />
      <span class="text-caption font-medium text-neutral-500">M3 Pro</span>
    </div>
    <div class="flex items-center gap-1">
      <Icon name="ph:memory" class="size-[18px] text-neutral-500" />
      <span class="text-caption font-medium text-neutral-500">18GB</span>
    </div>
    <div class="flex items-center gap-1">
      <Icon name="ph:hard-drive" class="size-[18px] text-neutral-500" />
      <span class="text-caption font-medium text-neutral-500">512GB</span>
    </div>
  </div>

  <!-- Divider -->
  <hr class="my-3 border-neutral-200" />

  <!-- Price + CTA -->
  <div class="flex items-center justify-between">
    <div class="flex items-end leading-[1.4]">
      <span class="text-[24px] font-semibold text-neutral-800">$25.00/</span>
      <span class="text-caption font-medium text-neutral-500">Day</span>
    </div>
    <button class="bg-neutral-800 hover:bg-primary-500 rounded-full px-4 py-2 text-body-sm font-medium text-white transition-colors">
      Rent Now
    </button>
  </div>
</div>
```

### Stat Card (v2.0)

Used in feature sections to highlight key numbers. Uses asymmetric radius and tinted backgrounds.

```vue
<!-- Top-right rounded stat card -->
<div class="rounded-tr-feature bg-surface-cool p-5">
  <p class="text-h2 font-medium leading-heading text-neutral-800">250+</p>
  <div class="mt-3 flex flex-col gap-2">
    <p class="text-h4 font-medium text-neutral-800">Products Available</p>
    <p class="text-body text-neutral-500 leading-body">
      Laptops, cameras, drones, and more -- ready to rent instantly.
    </p>
  </div>
</div>

<!-- Bottom-right rounded stat card -->
<div class="rounded-br-feature bg-surface-warm p-5">
  <p class="text-h2 font-medium leading-heading text-neutral-800">40+</p>
  <div class="mt-3 flex flex-col gap-2">
    <p class="text-h4 font-medium text-neutral-800">Cities Covered</p>
    <p class="text-body text-neutral-500 leading-body">
      Same-day delivery across major cities.
    </p>
  </div>
</div>
```

### Feature Info Card

Used below or alongside stat cards for descriptive content.

```vue
<div class="rounded-br-feature bg-neutral-100 p-5">
  <div class="bg-neutral-100 rounded-full p-2 w-fit">
    <Icon name="ph:users" class="size-6 text-neutral-800" />
  </div>
  <div class="mt-3 flex flex-col gap-2">
    <p class="text-h4 font-medium text-neutral-800">Active Renters</p>
    <p class="text-body text-neutral-500 leading-body">
      Join thousands of users enjoying EzTech daily.
    </p>
  </div>
</div>
```

### Testimonial Card

```vue
<div class="text-center max-w-[600px] mx-auto">
  <!-- Large avatar -->
  <img src="..." alt="..." class="size-[120px] rounded-full mx-auto object-cover" />

  <!-- Quote -->
  <blockquote class="mt-8 text-body-lg leading-body text-neutral-700 italic">
    "Finding premium tech gear used to be a headache.
    Now with EzTech, I can rent exactly what I need -- in minutes."
  </blockquote>

  <!-- Attribution -->
  <p class="mt-4 text-body font-semibold text-neutral-800">Cameron Williamson</p>
  <p class="text-body-sm text-neutral-500">Business Professional, UAE</p>

  <!-- Navigation arrows -->
  <div class="mt-6 flex items-center justify-center gap-2">
    <button class="size-10 rounded-full border border-neutral-200 flex items-center justify-center">
      <Icon name="ph:arrow-left" class="size-5 text-neutral-600" />
    </button>
    <button class="size-10 rounded-full border border-neutral-200 flex items-center justify-center">
      <Icon name="ph:arrow-right" class="size-5 text-neutral-600" />
    </button>
  </div>
</div>
```

---

## 9. Section Patterns

### Hero Section

Centered layout with display heading, subtitle, dual CTAs, and product showcase.

```vue
<section class="pt-40 pb-20 px-[100px] text-center relative">
  <!-- Heading -->
  <h1 class="text-display font-semibold leading-display capitalize text-neutral-800 max-w-[605px] mx-auto">
    Rent Premium. Deliver Smart.
  </h1>

  <!-- Subtitle -->
  <p class="mt-6 text-body-lg text-text-subtle max-w-[749px] mx-auto leading-body">
    Experience tech at your fingertips. Browse, rent, and receive -- all from
    your phone with EzTech's intelligent rental platform.
  </p>

  <!-- Dual CTAs -->
  <div class="mt-7 flex items-center justify-center gap-2.5">
    <button class="btn-gradient-primary rounded-full px-6 py-3 text-body-sm font-medium text-white capitalize">
      Get Started
    </button>
    <button class="btn-glass bg-white rounded-full px-6 py-2.5 text-body-sm font-medium text-text-primary capitalize">
      Explore Demo
    </button>
  </div>

  <!-- Product showcase (cards / mockup) below -->
  <div class="mt-16 relative">
    <!-- Product cards float around a central app mockup -->
  </div>
</section>
```

### Feature Section (Two-Column)

Left: heading + description + CTA. Right: stat cards + visuals.

```vue
<section class="pt-40 pb-20 px-[100px] flex gap-[91px] items-start">
  <!-- Left column -->
  <div class="w-[518px] flex flex-col gap-10">
    <h2 class="text-h1 font-medium leading-heading capitalize text-text-primary max-w-[361px]">
      Browse Smarter, Rent Faster
    </h2>
    <p class="text-body-lg text-text-subtle leading-body">
      From weekend projects to business needs, EzTech helps you rent
      premium equipment instantly.
    </p>
    <button class="btn-gradient-primary rounded-full px-6 py-3 text-body-sm font-medium text-white capitalize w-fit">
      Get Started Now
    </button>
  </div>

  <!-- Right column: stat cards -->
  <div class="flex gap-8 items-center">
    <div class="w-[324px] flex flex-col gap-6">
      <!-- Phone mockup / image area with rounded-tl-feature -->
      <div class="rounded-tl-feature bg-neutral-50 h-[292px] relative overflow-hidden">
        <!-- App screenshot -->
      </div>
      <!-- Info card -->
      <div class="rounded-br-feature bg-neutral-100 p-5">...</div>
    </div>
    <div class="w-[276px] flex flex-col gap-4">
      <div class="rounded-tr-feature bg-surface-cool p-5"><!-- 250+ stat --></div>
      <div class="rounded-br-feature bg-surface-warm p-5"><!-- 40+ stat --></div>
    </div>
  </div>
</section>
```

### App Showcase Section (Two-Column, Reversed)

Left: visual / phone mockup. Right: heading + description + CTA.
Background: `bg-neutral-50`.

```vue
<section class="bg-bg-elevated flex items-center justify-between pt-[150px] pb-20 px-[120px]">
  <!-- Left: phone mockup -->
  <div class="w-[515px] relative">
    <!-- Phone frame with app UI -->
  </div>

  <!-- Right: content -->
  <div class="w-[568px] flex flex-col gap-10">
    <h2 class="text-h1 font-medium leading-heading capitalize text-text-primary max-w-[421px]">
      Instant Rentals, Zero Hassle.
    </h2>
    <p class="text-body-lg text-text-subtle leading-body">
      Reserve your dream tech in seconds. With live availability,
      smart filters, and seamless checkout.
    </p>
    <button class="btn-gradient-primary rounded-full px-6 py-3 text-body-sm font-medium text-white capitalize w-fit">
      Download EzTech App
    </button>
  </div>
</section>
```

### Testimonial Section

Centered, with floating avatar bubbles and quote carousel.

```vue
<section class="py-[--ds-space-section-y] px-[100px] text-center relative overflow-hidden">
  <!-- Section heading -->
  <h2 class="text-h1 font-medium leading-heading capitalize text-text-primary max-w-[500px] mx-auto">
    Trusted By Thousands Of Users Worldwide
  </h2>

  <!-- Floating avatars (decorative, absolute positioned) -->
  <div class="relative mt-16">
    <!-- Small avatar bubbles scattered around -->
    <img src="..." class="absolute top-0 left-[15%] size-12 rounded-full" />
    <img src="..." class="absolute top-4 right-[12%] size-10 rounded-full" />
    <!-- ... more floating avatars ... -->

    <!-- Central testimonial -->
    <div class="max-w-[600px] mx-auto">
      <!-- Large avatar, quote, name, nav arrows -->
    </div>
  </div>
</section>
```

### CTA Banner Section (v2.0)

Dark gradient rounded section with centered content.

```vue
<section class="mx-[100px]">
  <div class="bg-section-dark rounded-3xl py-[60px] flex flex-col items-center gap-8 text-center">
    <!-- Heading -->
    <div class="flex flex-col gap-4 items-center">
      <h2 class="text-display-sm font-medium leading-heading text-white max-w-[546px]">
        Let's get your tech -- delivered in style.
      </h2>
      <p class="text-body-lg font-light text-neutral-200 leading-body">
        Join thousands of users who trust EzTech for premium, hassle-free rentals.
      </p>
    </div>

    <!-- CTA button -->
    <button class="bg-white rounded-full px-5 py-2.5 flex items-center gap-2.5 text-body font-medium text-neutral-800">
      Book Your Ride Now
      <Icon name="ph:arrow-right" class="size-5" />
    </button>
  </div>
</section>
```

### Brand Logos Strip

Horizontal row of partner logos, muted gray.

```vue
<section class="px-[100px] py-4">
  <div class="flex items-center justify-between">
    <div v-for="brand in brands" :key="brand.name" class="flex items-center gap-3">
      <img :src="brand.icon" :alt="brand.name" class="h-5 opacity-50" />
      <span class="text-[28px] font-semibold text-neutral-400 leading-body">
        {{ brand.name }}
      </span>
    </div>
  </div>
</section>
```

---

## 10. Navigation

### Navbar

Minimal header: logo left, CTA right. Fixed at top.

```vue
<header class="fixed top-0 inset-x-0 z-50 px-[100px] py-[49px]">
  <nav class="flex items-center justify-between">
    <!-- Logo -->
    <NuxtLink to="/" class="flex items-center gap-2">
      <img src="/assets/logo.svg" alt="EzTech" class="size-[34px]" />
      <span class="text-h3 font-semibold text-neutral-900">EzTech</span>
    </NuxtLink>

    <!-- CTA -->
    <button class="btn-gradient-primary rounded-full px-6 py-3 text-body-sm font-medium text-white capitalize">
      Get Started
    </button>
  </nav>
</header>
```

**Notes:**
- Logo uses a serif-inspired font weight (semibold, 24px)
- No visible nav links in the compact version -- can expand with center links for inner pages
- CTA uses the gradient pill button

---

## 11. Footer

Rounded card-style footer with brand info, links, and newsletter.

```vue
<footer class="mx-[100px] mb-8">
  <div class="bg-white border border-neutral-200 rounded-3xl p-8 flex items-start justify-between">
    <!-- Left: brand -->
    <div class="w-[536px] flex flex-col gap-6">
      <!-- Logo -->
      <NuxtLink to="/" class="flex items-center gap-2">
        <img src="/assets/logo.svg" alt="EzTech" class="size-[34px]" />
        <span class="text-h3 font-semibold text-neutral-900">EzTech</span>
      </NuxtLink>

      <!-- Description -->
      <p class="text-body text-neutral-600 leading-body capitalize">
        EzTech is a premium tech rental platform, making laptops, cameras,
        and equipment accessible with just a few taps.
      </p>

      <!-- Social icons -->
      <div class="flex items-center gap-3">
        <a href="#" class="size-10 rounded-full border border-neutral-900/25 flex items-center justify-center">
          <Icon name="ph:facebook-logo" class="size-5 text-neutral-800" />
        </a>
        <a href="#" class="size-10 rounded-full border border-neutral-900/25 flex items-center justify-center">
          <Icon name="ph:linkedin-logo" class="size-5 text-neutral-800" />
        </a>
        <a href="#" class="size-10 rounded-full border border-neutral-900/25 flex items-center justify-center">
          <Icon name="ph:x-logo" class="size-5 text-neutral-800" />
        </a>
      </div>
    </div>

    <!-- Right: links + newsletter -->
    <div class="w-[593px] flex items-start justify-between">
      <!-- Company links -->
      <div class="flex flex-col gap-6">
        <p class="text-h4 font-medium text-neutral-800">Company</p>
        <nav class="flex flex-col gap-5 text-body text-neutral-500 leading-body">
          <NuxtLink to="/about">About Us</NuxtLink>
          <NuxtLink to="/careers">Careers</NuxtLink>
          <NuxtLink to="/terms">Terms of Service</NuxtLink>
          <NuxtLink to="/privacy">Privacy Policy</NuxtLink>
          <NuxtLink to="/contact">Contact Us</NuxtLink>
        </nav>
      </div>

      <!-- Newsletter -->
      <div class="w-[375px] flex flex-col gap-6">
        <p class="text-h4 font-medium text-neutral-800">Newsletter</p>
        <div class="bg-neutral-50 rounded-full flex items-center justify-between pl-4 pr-1.5 py-1.5">
          <input
            type="email"
            placeholder="Enter Your Email"
            class="bg-transparent text-body-sm text-neutral-500 outline-none flex-1"
          />
          <button class="bg-neutral-800 hover:bg-primary-500 rounded-full p-3 transition-colors">
            <Icon name="ph:arrow-right" class="size-5 text-white" />
          </button>
        </div>
      </div>
    </div>
  </div>
</footer>
```

---

## 12. Form Elements

### Pill Input (v2.0)

Inputs use pill (full-radius) shapes, matching the button style.

```vue
<!-- Search input -->
<div class="bg-neutral-50 rounded-full p-3 flex items-center gap-2 w-full">
  <Icon name="ph:magnifying-glass" class="size-4 text-neutral-500" />
  <input
    type="text"
    placeholder="Search Here"
    class="bg-transparent text-caption text-neutral-500 outline-none flex-1"
  />
</div>

<!-- Newsletter email input with embedded button -->
<div class="bg-neutral-50 rounded-full flex items-center pl-4 pr-1.5 py-1.5">
  <input
    type="email"
    placeholder="Enter Your Email"
    class="bg-transparent text-body-sm text-neutral-500 outline-none flex-1"
  />
  <button class="bg-neutral-800 rounded-full p-3">
    <Icon name="ph:arrow-right" class="size-5 text-white" />
  </button>
</div>
```

### Standard Form Input

For checkout/auth forms where pill shape isn't appropriate.

```vue
<div class="flex flex-col gap-1.5">
  <label class="text-body-sm font-medium text-neutral-800">Email</label>
  <input
    type="email"
    placeholder="you@example.com"
    class="bg-white border border-neutral-200 rounded-[--radius-md] px-4 py-3 text-body text-text-primary outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition"
  />
  <p class="text-caption text-neutral-500">We'll never share your email.</p>
</div>
```

---

## 13. Icon Usage

Use Phosphor icons via `@nuxt/icon`. They are auto-imported.

```vue
<Icon name="ph:arrow-right" class="size-5" />
<Icon name="ph:magnifying-glass" class="size-4" />
<Icon name="ph:cpu" class="size-[18px]" />
<Icon name="ph:users" class="size-6" />
```

### Common Icon Sizes

| Context         | Size Class     |
| --------------- | -------------- |
| Button icon     | `size-5` (20px) |
| Spec row icon   | `size-[18px]`  |
| Search icon     | `size-4` (16px) |
| Feature icon    | `size-6` (24px) |
| Social icon     | `size-5` (20px) |
| Navigation      | `size-5` (20px) |

---

## 14. Responsive Breakpoints

Standard Tailwind breakpoints:

| Breakpoint | Width    | Usage                       |
| ---------- | -------- | --------------------------- |
| `sm`       | 640px    | Mobile landscape            |
| `md`       | 768px    | Tablet                      |
| `lg`       | 1024px   | Small desktop               |
| `xl`       | 1280px   | Standard desktop            |
| `2xl`      | 1536px   | Large desktop               |

### Responsive Patterns

- Hero: full-width on mobile, constrained `max-w-[605px]` heading on desktop
- Two-column sections: stack vertically on `< lg`, side-by-side on `lg+`
- Product cards: 1 col mobile, 2 col `sm`, 3-4 col `lg+`
- Section padding: `px-4 sm:px-6 lg:px-[100px]`
- Footer: stacks to single column on `< md`

---

## 15. Animation and Transitions

### Standard Transitions

```vue
<!-- Color transition -->
<button class="... transition-colors duration-200">

<!-- Shadow transition (hover elevation) -->
<div class="... shadow-sm hover:shadow-md transition-shadow duration-200">

<!-- Transform + opacity (for reveals) -->
<div class="... transition-all duration-300 ease-out">
```

### Recommended Durations

| Speed  | Duration | Usage                     |
| ------ | -------- | ------------------------- |
| Fast   | 150ms    | Button state changes      |
| Normal | 200ms    | Shadows, color changes    |
| Slow   | 300ms    | Layout shifts, reveals    |

---

## 16. Accessibility Requirements

- **Focus rings**: All interactive elements show `ring-2 ring-primary-500/20` on focus
- **Color contrast**: Text meets WCAG AA (4.5:1 for body, 3:1 for large text)
- **Semantic HTML**: Use `<nav>`, `<main>`, `<section>`, `<article>`, `<footer>`, `<header>`
- **Alt text**: All images must have descriptive `alt` attributes
- **Keyboard nav**: All interactive elements reachable via Tab
- **ARIA labels**: Buttons with only icons need `aria-label`

---

## 17. File Structure Conventions

```
app/
  assets/
    css/
      tailwind.css          # All design tokens
  components/
    ui/                     # shadcn-vue components (auto-imported)
    ...                     # Custom components
  composables/              # Vue composables
  data/
    mock/                   # Mock data
  layouts/                  # Nuxt layouts
  lib/
    utils.ts                # cn() class merge helper
  pages/                    # File-based routing
  public/
    assets/                 # Static assets (images, SVGs)
```

### Component Naming

- shadcn-vue: PascalCase, no prefix (e.g., `<Button>`, `<Card>`)
- Custom: PascalCase, descriptive (e.g., `<ProductCard>`, `<HeroSection>`)
- Use `cn()` helper for dynamic class merging

```vue
<template>
  <div :class="cn('rounded-3xl bg-card p-8', $attrs.class)">
    <slot />
  </div>
</template>
```
