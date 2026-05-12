<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { useVModel } from "@vueuse/core"
import { cn } from "@/lib/utils"

const props = defineProps<{
  defaultValue?: string | number
  modelValue?: string | number
  class?: HTMLAttributes["class"]
}>()

const emits = defineEmits<{
  (e: "update:modelValue", payload: string | number): void
}>()

const modelValue = useVModel(props, "modelValue", emits, {
  passive: true,
  defaultValue: props.defaultValue,
})
</script>

<template>
  <input
    v-model="modelValue"
    data-slot="input"
    :class="cn(
      'w-full bg-white border border-neutral-200 rounded-[--radius-md] px-4 py-3 text-body text-text-primary placeholder:text-text-muted outline-none focus:ring-2 focus:ring-primary-400/30 focus:border-primary-500 transition disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
      'aria-invalid:border-error aria-invalid:focus:border-error aria-invalid:focus:ring-error/20',
      props.class,
    )"
  >
</template>
