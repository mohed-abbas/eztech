// Locks body scroll while a fullscreen overlay is open (the landing menu).
// Ties directly to a boolean ref so components don't have to juggle DOM
// attributes themselves.

export function useBodyScrollLock(active: Ref<boolean>) {
  watch(active, (isOpen) => {
    if (import.meta.client) {
      document.body.style.overflow = isOpen ? 'hidden' : ''
    }
  })

  onUnmounted(() => {
    if (import.meta.client) document.body.style.overflow = ''
  })
}
