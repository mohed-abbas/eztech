import * as Sentry from '@sentry/nuxt'

Sentry.init({
  dsn: 'http://7b6f3f153c3743e8a06d235ab69c7563@localhost:3006/1',
  tracesSampleRate: 1.0,
})