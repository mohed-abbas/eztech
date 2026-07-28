<script setup lang="ts">
// Placeholder ligne de commande. Reprend la structure de la carte reelle
// (orders/index.vue) pour que le remplacement squelette -> carte ne decale rien.
// Le conteneur parent porte role="status" : la carte elle-meme est aria-hidden.
</script>

<template>
  <div
    aria-hidden="true"
    class="animate-pulse rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6"
  >
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <!-- Gauche : pastille de statut + reference / date / articles -->
      <div class="flex items-start gap-4">
        <div class="size-12 shrink-0 rounded-xl bg-neutral-100" />
        <div>
          <div class="flex flex-wrap items-center gap-2">
            <div class="h-[1.5em] w-28 rounded bg-neutral-100 text-body" />
            <div class="h-6 w-24 rounded-full bg-neutral-100" />
          </div>
          <div class="mt-1 h-[1.5em] w-32 rounded bg-neutral-100 text-body-sm" />
          <div class="mt-1 h-[1.5em] w-48 max-w-full rounded bg-neutral-100 text-body-sm" />
        </div>
      </div>

      <!-- Droite : total + nombre d'articles + fleche -->
      <div class="flex items-center gap-4">
        <div class="sm:ml-auto">
          <div class="h-[1.5em] w-20 rounded bg-neutral-100 text-h4 sm:ml-auto" />
          <div class="h-[1.5em] w-16 rounded bg-neutral-100 text-caption sm:ml-auto" />
        </div>
        <div class="size-5 shrink-0 rounded bg-neutral-100" />
      </div>
    </div>
  </div>
</template>
