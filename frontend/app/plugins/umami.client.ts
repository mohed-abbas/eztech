// Umami — analytique web sans cookies, auto-hébergée. Le script est injecté côté navigateur depuis
// la runtime config, donc désactivable par environnement. Inerte tant qu'aucun website id n'est
// configuré : un dev ou une CI ne charge alors aucun script d'analytique.
export default defineNuxtPlugin(() => {
  const { umamiHost, umamiWebsiteId } = useRuntimeConfig().public

  useTracking().captureTrafficSource()

  if (!umamiWebsiteId) return

  useHead({
    script: [
      {
        src: `${umamiHost || 'http://localhost:3002'}/script.js`,
        defer: true,
        'data-website-id': umamiWebsiteId as string,
      },
    ],
  })
})
