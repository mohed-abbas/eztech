// Tracks whether the user has scrolled past a threshold. We use it on the
// landing navbar to swap from transparent to the frosted-glass style.

export function useScrollState(threshold = 20) {
  const scrolled = ref(false)

  const onScroll = () => {
    scrolled.value = window.scrollY > threshold
  }

  onMounted(() => {
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
  })

  onUnmounted(() => {
    window.removeEventListener('scroll', onScroll)
  })

  return { scrolled }
}
