// Shared v-motion presets so every landing section fades in with the
// same rhythm. Centralising them means a single place to retune the
// whole page's motion if the timing ever feels off.

export function useMotionPresets() {
  const fadeUp = (delay = 0) => ({
    initial: { opacity: 0, y: 24 },
    visibleOnce: { opacity: 1, y: 0, transition: { duration: 600, delay, ease: 'easeOut' } },
  })

  const fadeScale = (delay = 0) => ({
    initial: { opacity: 0, scale: 0.96 },
    visibleOnce: { opacity: 1, scale: 1, transition: { duration: 700, delay, ease: 'easeOut' } },
  })

  const heroFadeUp = (delay: number) => ({
    initial: { opacity: 0, y: 20 },
    enter: { opacity: 1, y: 0, transition: { duration: 700, delay, ease: 'easeOut' } },
  })

  return { fadeUp, fadeScale, heroFadeUp }
}
