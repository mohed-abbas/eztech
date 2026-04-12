<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()
</script>

<template>
  <div
    data-slot="card"
    :class="
      cn(
        'bg-white text-card-foreground flex flex-col rounded-2xl border border-neutral-200 shadow-sm',
        props.class,
      )
    "
  >
    <slot />
  </div>
</template>
