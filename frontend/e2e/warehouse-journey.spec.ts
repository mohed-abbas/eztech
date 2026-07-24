import { test, expect, type Page, request as playwrightRequest } from '@playwright/test'

// Parcours responsable d'entrepot : connexion → ajustement d'inventaire → inspection d'un retour.
// Determinisme : le retour a inspecter est cree de bout en bout via l'API (client planifie → livreur
// accepte et complete), puis suivi par sa reference dans l'UI.

const API = process.env.E2E_API_URL ?? 'http://localhost:3001'
const MANAGER_EMAIL = process.env.E2E_WAREHOUSE_EMAIL ?? 'warehouse@eztech.fr'
const MANAGER_PASSWORD = process.env.E2E_WAREHOUSE_PASSWORD ?? 'warehousepass123'
const CUSTOMER_EMAIL = process.env.E2E_EMAIL ?? 'marie@example.com'
const CUSTOMER_PASSWORD = process.env.E2E_PASSWORD ?? 'password123'
const RIDER_EMAIL = process.env.E2E_RIDER_EMAIL ?? 'rider@eztech.fr'
const RIDER_PASSWORD = process.env.E2E_RIDER_PASSWORD ?? 'riderpass123'

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
  return { ctx, token }
}

// cree un retour collecte (completed) via l'API et renvoie sa reference
async function createCollectedReturn(): Promise<string> {
  const cust = await apiLogin(CUSTOMER_EMAIL, CUSTOMER_PASSWORD)
  const created = await cust.ctx.post(`${API}/api/returns`, {
    headers: { Authorization: `Bearer ${cust.token}` },
    data: { pickupAddress: '10 Rue du Test E2E' },
  })
  expect(created.ok(), 'creation du retour doit reussir').toBeTruthy()
  const body = await created.json() as { return: { id: string, reference: string } }
  await cust.ctx.dispose()

  const rider = await apiLogin(RIDER_EMAIL, RIDER_PASSWORD)
  const rh = { Authorization: `Bearer ${rider.token}` }
  await rider.ctx.patch(`${API}/api/rider/status`, { headers: rh, data: { online: true } })
  const accept = await rider.ctx.post(`${API}/api/rider/returns/${body.return.id}/accept`, { headers: rh })
  expect(accept.ok(), 'acceptation du retour doit reussir').toBeTruthy()
  const complete = await rider.ctx.patch(`${API}/api/rider/returns/${body.return.id}/complete`, { headers: rh })
  expect(complete.ok(), 'completion du retour doit reussir').toBeTruthy()
  await rider.ctx.dispose()

  return body.return.reference
}

async function loginManagerUI(page: Page) {
  await page.goto('/login')
  await waitForHydration(page)
  await page.getByLabel('E-mail').fill(MANAGER_EMAIL)
  await page.getByLabel('Mot de passe').fill(MANAGER_PASSWORD)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.waitForURL((u) => !u.pathname.endsWith('/login'))
}

test('parcours entrepot : ajuster l\'inventaire', async ({ page }) => {
  await loginManagerUI(page)

  await page.goto('/warehouse/inventory')
  await waitForHydration(page)
  await expect(page.getByRole('heading', { name: 'Inventaire' })).toBeVisible()

  // premiere ligne de stock : incrementer la quantite (valeur toujours differente => idempotent)
  const firstRow = page.locator('tbody tr').first()
  await expect(firstRow).toBeVisible()
  const input = firstRow.locator('input[type="number"]')
  const next = String(Number(await input.inputValue()) + 1)
  await input.fill(next)
  await firstRow.getByRole('button', { name: 'Enregistrer' }).click()

  // la valeur persiste apres rechargement
  await page.reload()
  await waitForHydration(page)
  await expect(page.locator('tbody tr').first().locator('input[type="number"]')).toHaveValue(next)
})

test('parcours entrepot : inspecter un retour collecte', async ({ page }) => {
  const reference = await createCollectedReturn()

  await loginManagerUI(page)
  await page.goto('/warehouse/returns')
  await waitForHydration(page)
  await expect(page.getByRole('heading', { name: 'Retours a inspecter' })).toBeVisible()

  // le retour apparait dans la file a inspecter
  const card = page.getByTestId('return-card').filter({ hasText: reference })
  await expect(card).toBeVisible()
  await card.getByRole('button', { name: 'Disponible' }).click()

  // il disparait de la file et apparait dans les traites recents
  await expect(page.getByTestId('return-card').filter({ hasText: reference })).toHaveCount(0)
  await expect(page.getByText('Traites recemment')).toBeVisible()
  await expect(page.getByText(reference)).toBeVisible()
})
