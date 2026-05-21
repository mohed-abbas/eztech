<template>
  <div>
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>

<script setup>
import * as Sentry from "@sentry/browser";


Sentry.init({
  dsn: "http://7a726c0fc41d4fb693d993951919e300@localhost:8000/1",
  tracesSampleRate: 0.01, // 1% of transactions — adjust to your needs
  autoSessionTracking: false, // GlitchTip does not support sessions
});

Sentry.captureMessage("Test message from Nuxt,js App.vue");
</script>
