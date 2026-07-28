import type { Page } from '@playwright/test'

// The stack under test serves the Nuxt DEV server (SSR + client hydration). Playwright's auto-wait
// only checks an element is visible/enabled — NOT that Vue has finished hydrating and wired up its
// listeners. Clicking "Se connecter" before hydration completes runs a NATIVE form submit (full-page
// GET to /login) instead of the @submit.prevent handler: the /auth/login request never fires and the
// test hangs on waitForURL('**/products'). Wait for the Vue app to be mounted on #__nuxt (Vue sets
// __vue_app__ on the mount root once hydration runs) before the first interaction.

// En mode dev, chaque route est compilee a sa premiere requete. L'hydratation d'une route froide
// = compilation + transfert + montage de l'app Vue, ce qui depasse regulierement les 15 s de
// `actionTimeout` (le defaut applique a waitForFunction). On s'aligne sur `navigationTimeout`
// (30 s, cf. playwright.config.ts) : l'hydratation releve du cout de navigation, pas d'une action.
//
// Sans ce timeout explicite, le premier fichier de la suite — cross-rider-customer.spec.ts, en
// tete par ordre alphabetique — encaissait seul le demarrage a froid et echouait par
// intermittence, alors que les specs suivantes profitaient d'un serveur deja chaud.
const HYDRATION_TIMEOUT = 30_000

export async function waitForHydration(page: Page) {
  await page.waitForFunction(() => {
    const el = document.getElementById('__nuxt') as (HTMLElement & { __vue_app__?: unknown }) | null
    return !!(el && el.__vue_app__)
  }, undefined, { timeout: HYDRATION_TIMEOUT })
}
