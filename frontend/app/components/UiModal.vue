<script setup lang="ts">
interface ModalProps {
  open: boolean
  title?: string
  /** Tailwind max-w class applied to the dialog panel */
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
}

withDefaults(defineProps<ModalProps>(), { size: 'lg' })

const emit = defineEmits<{ close: [] }>()

const sizeClass: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
}

// Close on Escape
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
        @click.self="emit('close')"
      >
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="emit('close')" />

        <!-- Panel -->
        <div
          class="relative flex w-full flex-col rounded-2xl bg-white shadow-2xl ring-1 ring-black/5"
          :class="sizeClass[size ?? 'lg']"
          style="max-height: min(90vh, 800px)"
        >
          <!-- Header -->
          <div class="flex shrink-0 items-center justify-between border-b border-neutral-100 px-6 py-5">
            <h2 v-if="title" class="text-h4 font-semibold text-text-primary">
              {{ title }}
            </h2>
            <slot v-else name="header" />
            <button
              class="ml-auto flex size-9 shrink-0 items-center justify-center rounded-xl text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-600"
              aria-label="Fermer"
              @click="emit('close')"
            >
              <Icon name="ph:x" class="size-5" />
            </button>
          </div>

          <!-- Scrollable body -->
          <div class="min-h-0 flex-1 overflow-y-auto px-6 py-6">
            <slot />
          </div>

          <!-- Footer (optional) -->
          <div
            v-if="$slots.footer"
            class="shrink-0 border-t border-neutral-100 px-6 py-5"
          >
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
/* Panel pops in with a slight scale */
.modal-enter-active .relative,
.modal-leave-active .relative {
  transition: transform 0.2s ease, opacity 0.2s ease;
}
.modal-enter-from .relative,
.modal-leave-to .relative {
  opacity: 0;
  transform: scale(0.95) translateY(8px);
}
</style>
