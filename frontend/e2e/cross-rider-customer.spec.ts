import { test, expect, type Page, request as playwrightRequest, type APIRequestContext } from '@playwright/test'

// Test croise livreur ↔ client : le client, sur sa page de suivi, voit les mises a jour du livreur
// en TEMPS REEL (socket) sans jamais rafraichir la page.
// Le livreur agit via l'API (c'est ce qui declenche la diffusion socket cote backend).

const API = process.env.E2E_API_URL ?? 'http://localhost:3001'
const CUSTOMER_EMAIL = process.env.E2E_EMAIL ?? 'marie@example.com'
const CUSTOMER_PASSWORD = process.env.E2E_PASSWORD ?? 'password123'
// 2e livreur seede (approuve) : evite toute course avec rider.spec.ts qui utilise rider@eztech.fr
const RIDER_EMAIL = process.env.E2E_RIDER2_EMAIL ?? 'rider2@eztech.fr'
const RIDER_PASSWORD = process.env.E2E_RIDER_PASSWORD ?? 'riderpass123'

// laisse le temps au socket de propager l'evenement order-status
const LIVE = { timeout: 20_000 }

async function waitForHydration(page: Page) {
  await page.waitForFunction(() => {
    const el = document.getElementById('__nuxt') as (HTMLElement & { __vue_app__?: unknown }) | null
    return !!(el && el.__vue_app__)
  })
}

async function apiLogin(email: string, password: string) {
  const ctx = await playwrightRequest.newContext()
  const res = await ctx.post(`${API}/api/auth/login`, { data: { email, password } })
  expect(res.ok(), `login ${email} doit reussir`).toBeTruthy()
  const { token } = await res.json() as { token: string }
  return { ctx, headers: { Authorization: `Bearer ${token}` } }
}

async function riderAdvance(ctx: APIRequestContext, headers: Record<string, string>, orderId: string, status: string) {
  const res = await ctx.patch(`${API}/api/orders/${orderId}/status`, { headers, data: { status } })
  expect(res.ok(), `transition ${status} doit reussir`).toBeTruthy()
}

const FLOW = ['rider_assigned', 'at_warehouse', 'picked_up', 'in_transit', 'delivered']

// Idempotence : un run precedent interrompu peut laisser le livreur sur une livraison active
// (l'acceptation renverrait alors 409). On solde cette livraison avant de commencer.
async function clearActiveDelivery(ctx: APIRequestContext, headers: Record<string, string>) {
  const res = await ctx.get(`${API}/api/rider/orders/active`, { headers })
  if (!res.ok()) return
  const { order } = await res.json() as { order: { id: string, status: string } | null }
  if (!order) return
  for (const status of FLOW.slice(FLOW.indexOf(order.status) + 1)) {
    await ctx.patch(`${API}/api/orders/${order.id}/status`, { headers, data: { status } })
  }
}

test('croise livreur → client : le suivi se met a jour en temps reel, sans rafraichir', async ({ page }) => {
  // 1. le client passe une commande (API) — elle tombe dans le pool livreur
  const cust = await apiLogin(CUSTOMER_EMAIL, CUSTOMER_PASSWORD)
  const created = await cust.ctx.post(`${API}/api/orders`, {
    headers: cust.headers,
    data: { pickupAddress: 'Entrepot EzTech', dropoffAddress: '9 Rue du Temps Reel', riderFee: 7 },
  })
  expect(created.ok(), 'creation de commande doit reussir').toBeTruthy()
  const { order } = await created.json() as { order: { id: string } }
  await cust.ctx.dispose()

  // 2. le client ouvre sa page de suivi et y reste (aucun reload ensuite)
  await page.goto('/login')
  await waitForHydration(page)
  await page.getByLabel('E-mail').fill(CUSTOMER_EMAIL)
  await page.getByLabel('Mot de passe').fill(CUSTOMER_PASSWORD)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.waitForURL((u) => !u.pathname.endsWith('/login'))

  await page.goto(`/orders/${order.id}`)
  await waitForHydration(page)
  const badge = page.getByTestId('order-status-badge')
  await expect(badge).toContainText('En recherche de livreur')

  // 3. le livreur accepte → le client voit « Livreur assigné » sans rafraichir
  const rider = await apiLogin(RIDER_EMAIL, RIDER_PASSWORD)
  await rider.ctx.patch(`${API}/api/rider/status`, { headers: rider.headers, data: { online: true } })
  await clearActiveDelivery(rider.ctx, rider.headers)
  const accept = await rider.ctx.post(`${API}/api/rider/orders/${order.id}/accept`, { headers: rider.headers })
  expect(accept.ok(), 'acceptation doit reussir').toBeTruthy()
  await expect(badge).toContainText('Livreur assigné', LIVE)

  // 4. le livreur avance : le client suit chaque etape en direct
  await riderAdvance(rider.ctx, rider.headers, order.id, 'at_warehouse')
  await expect(badge).toContainText('En préparation', LIVE)

  await riderAdvance(rider.ctx, rider.headers, order.id, 'picked_up')
  await expect(badge).toContainText('Récupérée', LIVE)

  await riderAdvance(rider.ctx, rider.headers, order.id, 'in_transit')
  await expect(badge).toContainText('En route', LIVE)

  // 5. livraison → le client voit la confirmation finale
  await riderAdvance(rider.ctx, rider.headers, order.id, 'delivered')
  await expect(badge).toContainText('Livrée', LIVE)
  await rider.ctx.dispose()
})
