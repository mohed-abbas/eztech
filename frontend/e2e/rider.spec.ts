import { test, expect, type Page, request as playwrightRequest } from '@playwright/test'

// Parcours livreur de bout en bout : inscription (via seed) → passage en ligne → acceptation
// d'une commande → mises à jour de statut jusqu'à livrée → gains crédités.
//
// Determinisme : le test crée SA propre commande via l'API (référence unique) puis la piste par
// cette référence dans l'UI — insensible aux autres commandes du pool. S'exécute contre une stack
// fraîchement seedée (comme le smoke client) : le livreur approuvé n'a pas de livraison active.

const API = process.env.E2E_API_URL ?? 'http://localhost:3001'
const RIDER_EMAIL = process.env.E2E_RIDER_EMAIL ?? 'rider@eztech.fr'
const RIDER_PASSWORD = process.env.E2E_RIDER_PASSWORD ?? 'riderpass123'
const CUSTOMER_EMAIL = process.env.E2E_EMAIL ?? 'marie@example.com'
const CUSTOMER_PASSWORD = process.env.E2E_PASSWORD ?? 'password123'

// Les 4 transitions successives déclenchées par le livreur (libellés = NEXT_STATUS, stores/rider.ts).
const ADVANCE_LABELS = ["Arrivé à l'entrepôt", 'Colis récupéré', 'En route vers le client', 'Livraison effectuée']

// Attendre que Vue ait fini l'hydratation avant la première interaction (cf. smoke.spec.ts).
async function waitForHydration(page: Page) {
  await page.waitForFunction(() => {
    const el = document.getElementById('__nuxt') as (HTMLElement & { __vue_app__?: unknown }) | null
    return !!(el && el.__vue_app__)
  })
}

// Crée une commande pending_assignment directement dans le pool via l'API et renvoie sa référence
// unique. Auth par bearer token (les mutations en cookie exigent un jeton CSRF ; le bearer non).
async function createPendingOrder(): Promise<string> {
  const ctx = await playwrightRequest.newContext()
  const login = await ctx.post(`${API}/api/auth/login`, {
    data: { email: CUSTOMER_EMAIL, password: CUSTOMER_PASSWORD },
  })
  expect(login.ok(), 'login client (API) doit réussir').toBeTruthy()
  const { token } = await login.json() as { token: string }

  const res = await ctx.post(`${API}/api/orders`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { pickupAddress: 'Entrepôt EzTech', dropoffAddress: '10 Rue du Test E2E', riderFee: 8.5 },
  })
  expect(res.ok(), 'création de commande (API) doit réussir').toBeTruthy()
  const body = await res.json() as { order: { reference: string } }
  await ctx.dispose()
  return body.order.reference
}

test('parcours livreur : connexion → en ligne → acceptation → livraison → gains', async ({ page }) => {
  const reference = await createPendingOrder()

  // 1. Connexion livreur (compte approuvé seedé)
  await page.goto('/login')
  await waitForHydration(page)
  await page.getByLabel('E-mail').fill(RIDER_EMAIL)
  await page.getByLabel('Mot de passe').fill(RIDER_PASSWORD)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.waitForURL((u) => !u.pathname.endsWith('/login'))

  // 2. Dashboard livreur
  await page.goto('/rider/dashboard')
  await waitForHydration(page)
  await expect(page.getByRole('heading', { name: 'Tableau de bord livreur' })).toBeVisible()

  // 3. Passage en ligne (idempotent). On attend que le bouton soit ACTIVÉ (profil chargé + livreur
  // approuvé) avant de lire son état — sinon on lit « Hors ligne » (état par défaut avant hydratation)
  // et on risque de re-basculer hors ligne un livreur déjà en ligne (course).
  const onlineToggle = page.getByRole('button', { name: /Hors ligne|En ligne/ })
  await expect(onlineToggle).toBeEnabled()
  if (((await onlineToggle.textContent()) ?? '').includes('Hors ligne')) {
    await onlineToggle.click()
  }
  await expect(page.getByRole('button', { name: 'En ligne' })).toBeVisible()

  // Recharger pour garantir le fetch de la liste des commandes disponibles (onMounted si en ligne)
  await page.reload()
  await waitForHydration(page)

  // 4. Acceptation de NOTRE commande (ciblée par sa référence)
  const orderCard = page.getByTestId('available-order').filter({ hasText: reference })
  await expect(orderCard).toBeVisible()
  await orderCard.getByRole('button', { name: 'Accepter' }).click()

  // La livraison devient active
  await expect(page.getByText('Livraison en cours', { exact: false })).toBeVisible()
  await expect(page.getByText(reference)).toBeVisible()

  // 5. Avancer le statut jusqu'à « livrée »
  for (const label of ADVANCE_LABELS) {
    const btn = page.getByRole('button', { name: label })
    await expect(btn).toBeVisible()
    await btn.click()
  }

  // Une fois livrée, la carte « Livraison en cours » disparaît
  await expect(page.getByText('Livraison en cours', { exact: false })).toBeHidden()

  // 6. Gains crédités : la course apparaît dans l'historique
  await page.goto('/rider/earnings')
  await waitForHydration(page)
  await expect(page.getByRole('heading', { name: 'Mes gains' })).toBeVisible()
  await expect(page.getByText(reference)).toBeVisible()
})
