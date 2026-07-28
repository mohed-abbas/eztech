<script setup lang="ts">
// Product photo with a graceful degradation to the category icon.
//
// Product.imageUrl points into /assets/products/, which is not currently populated, so every
// product photo 404s. A bare <img> renders the browser's broken-image glyph; this renders the
// same neutral icon placeholder the rest of the catalogue uses instead. It also means the
// catalogue starts showing real photos the moment the asset files land, with no further change.
import type { HTMLAttributes } from 'vue'

const props = withDefaults(
  defineProps<{
    src?: string | null
    alt?: string
    /** Icon shown when there is no src, or when the src fails to load. */
    fallbackIcon?: string
    imgClass?: HTMLAttributes['class']
    iconClass?: HTMLAttributes['class']
  }>(),
  { src: null, fallbackIcon: 'ph:image', alt: '', imgClass: '', iconClass: '' },
)

const failed = ref(false)
const imgRef = ref<HTMLImageElement | null>(null)

// a new src deserves a fresh attempt (list re-renders, admin form preview, …)
watch(() => props.src, () => { failed.value = false })

const showImage = computed(() => !!props.src && !failed.value)

// An SSR-rendered <img> starts fetching before Vue hydrates, so a 404 can fire its error event
// while no listener is attached yet and @error never runs — that is why the server-rendered
// catalogue kept showing broken-image glyphs while the client-rendered admin grid fell back
// correctly. Re-check the decoded size once mounted and catch the ones we missed.
function syncFromDom() {
  const el = imgRef.value
  if (el?.complete && el.naturalWidth === 0) failed.value = true
}
onMounted(syncFromDom)
watch(imgRef, syncFromDom)
</script>

<template>
  <img
    v-if="showImage"
    ref="imgRef"
    :src="src!"
    :alt="alt"
    :class="imgClass"
    loading="lazy"
    @error="failed = true"
    @load="syncFromDom"
  >
  <div v-else class="flex size-full items-center justify-center" aria-hidden="true">
    <Icon :name="fallbackIcon" :class="iconClass" />
  </div>
</template>
