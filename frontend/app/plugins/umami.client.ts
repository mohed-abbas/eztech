// Umami web analytics — injected client-side from runtime config so it's switchable per
// environment (the demo wires it via docker-compose.observability.yml). Inert unless a website
// id is configured, so normal dev/CI loads no analytics script.
export default defineNuxtPlugin(() => {
  const { umamiHost, umamiWebsiteId } = useRuntimeConfig().public

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
