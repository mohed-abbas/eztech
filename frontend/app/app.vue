<template>
  <div>
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>

<script setup>
import * as Sentry from '@sentry/node'

Sentry.init({
  dsn: "https://65f35da24a7f484194ba95e404c41775@app.glitchtip.com/23595",
  autoSessionTracking: false, // GlitchTip does not support sessions
});

Sentry.captureMessage("Test message from Node.js");
</script>
