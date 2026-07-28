<script setup lang="ts">
// Placeholder carte produit. Reprend a l'identique la structure de ProductCard.vue
// (memes classes de conteneur, memes tailles de police) pour que le remplacement
// squelette -> carte reelle ne provoque aucun saut de mise en page.
//
// Chaque ligne de texte est un conteneur `h-[1.4em]` a la meme taille de police que
// la ligne reelle : la hauteur du squelette est donc celle de la vraie carte au pixel
// pres — 317,19 px, mesure dans le navigateur. Le titre reserve deux lignes parce que
// les noms produits passent a la ligne : a 1280 px les 34 cartes du catalogue font
// toutes 317,19 px. Sur les grilles plus etroites certaines cartes tiennent en une
// ligne (291,99 px) ; le squelette est alors plus haut d'une ligne, jamais plus bas,
// donc le contenu remonte au lieu de pousser la page vers le bas.
//
// Le conteneur parent porte role="status" ; la carte elle-meme est aria-hidden.
</script>

<template>
  <div
    aria-hidden="true"
    class="flex animate-pulse flex-col rounded-xl border border-neutral-200 bg-neutral-50 p-4 shadow-[0_0_50px_0_rgba(0,0,0,0.1)]"
  >
    <!-- Titre (2 lignes) + type — ProductCard.vue:20-23 -->
    <div class="leading-[1.4]">
      <div class="flex h-[1.4em] items-center text-[18px]">
        <div class="h-3.5 w-4/5 rounded bg-neutral-100" />
      </div>
      <div class="flex h-[1.4em] items-center text-[18px]">
        <div class="h-3.5 w-1/2 rounded bg-neutral-100" />
      </div>
      <div class="flex h-[1.4em] items-center text-caption">
        <div class="h-2.5 w-1/3 rounded bg-neutral-100" />
      </div>
    </div>

    <!-- Visuel — ProductCard.vue:25-27 -->
    <div class="my-3 h-28 w-full rounded-md bg-neutral-100" />

    <!-- Caracteristiques — ProductCard.vue:29-42 -->
    <div class="mb-3 flex items-center justify-between">
      <div v-for="n in 3" :key="n" class="flex items-center gap-1">
        <div class="size-4.5 rounded-full bg-neutral-100" />
        <div class="h-2.5 w-10 rounded bg-neutral-100" />
      </div>
    </div>

    <hr class="border-neutral-200">

    <!-- Prix + CTA — ProductCard.vue:46-57 -->
    <div class="mt-3 flex items-center justify-between">
      <div class="flex items-end leading-[1.4]">
        <div class="flex h-[1.4em] items-center text-h3">
          <div class="h-5 w-24 rounded bg-neutral-100" />
        </div>
      </div>
      <div class="rounded-full bg-neutral-100 px-4 py-2 text-body-sm">
        <div class="h-[1.5em] w-14" />
      </div>
    </div>
  </div>
</template>
