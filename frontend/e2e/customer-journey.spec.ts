import { test, expect, type Page, request as playwrightRequest } from '@playwright/test'

// Parcours client : inscription → catalogue → panier → checkout, puis suivi de commande.
//
// Non couvert ici : le paiement Stripe reel (Elements en iframe, hors perimetre e2e) et
// « planifier un retour » — l'UI cote client n'existe pas encore (seul POST /api/returns existe).

const API = process.env.E2E_API_URL ?? 'http://localhost:3001'
const CUSTOMER_EMAIL = process.env.E2E_EMAIL ?? 'marie@example.com'
const CUSTOMER_PASSWORD = process.env.E2E_PASSWORD ?? 'password123'

async function waitForHydration(page: Page) {
  await page.waitForFunction(() => {
    const el = document.getElementById('__nuxt') as (HTMLElement & { __vue_app__?: unknown }) | null
    return !!(el && el.__vue_app__)
  })
}

test('parcours client : inscription → catalogue → panier → checkout', async ({ page }) => {
  const email = `cust-e2e-${Date.now()}@example.com`

  // 1. Inscription (onglet client par defaut)
  await page.goto('/register')
  await waitForHydration(page)
  await page.getByLabel('Nom complet').fill('Client E2E')
  await page.getByLabel('Adresse e-mail').fill(email)
  await page.getByLabel('Mot de passe', { exact: true }).fill('password123')
  await page.getByLabel('Confirmer le mot de passe').fill('password123')
  await page.getByLabel('Numéro de téléphone').fill('+33 6 11 22 33 44')
  await page.getByLabel('Libellé').fill('Domicile')
  await page.getByLabel('Rue').fill('12 Rue de Rivoli')
  await page.getByLabel('Ville').fill('Paris')
  await page.getByLabel('Code postal').fill('75004')
  await page.getByRole('button', { name: 'Créer un compte' }).click()
  await page.waitForURL((u) => !u.pathname.startsWith('/register'))

  // 2. Catalogue → fiche produit → panier
  await page.goto('/products')
  await waitForHydration(page)
  await expect(page.getByRole('heading', { name: 'Catalogue', level: 1 })).toBeVisible()
  await page.getByRole('link', { name: 'Louer' }).first().click()
  await page.getByRole('button', { name: 'Ajouter au panier' }).click()
  await page.getByRole('link', { name: 'Voir le panier' }).click()

  // 3. Panier
  await page.waitForURL('**/cart')
  await expect(page.getByRole('heading', { name: 'Mon panier', level: 1 })).toBeVisible()
  await expect(page.getByText('1 article dans votre panier')).toBeVisible()

  // 4. Checkout (le paiement Stripe lui-meme n'est pas joue)
  await page.getByRole('button', { name: 'Passer au paiement' }).click()
  await page.waitForURL('**/checkout')
  await expect(page.getByRole('heading', { name: 'Paiement sécurisé', level: 1 })).toBeVisible()
})

test('parcours client : suivi d\'une commande', async ({ page }) => {
  // commande creee via l'API pour rendre le suivi deterministe
  const ctx = await playwrightRequest.newContext()
  const login = await ctx.post(`${API}/api/auth/login`, { data: { email: CUSTOMER_EMAIL, password: CUSTOMER_PASSWORD } })
  expect(login.ok(), 'login client (API) doit reussir').toBeTruthy()
  const { token } = await login.json() as { token: string }
  const created = await ctx.post(`${API}/api/orders`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { pickupAddress: 'Entrepot EzTech', dropoffAddress: '8 Rue du Suivi', riderFee: 6 },
  })
  expect(created.ok(), 'creation de commande doit reussir').toBeTruthy()
  const { order } = await created.json() as { order: { id: string, reference: string } }
  await ctx.dispose()

  // connexion client puis suivi
  await page.goto('/login')
  await waitForHydration(page)
  await page.getByLabel('E-mail').fill(CUSTOMER_EMAIL)
  await page.getByLabel('Mot de passe').fill(CUSTOMER_PASSWORD)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.waitForURL((u) => !u.pathname.endsWith('/login'))

  // la commande apparait dans « Mes commandes »
  await page.goto('/orders')
  await waitForHydration(page)
  await expect(page.getByRole('heading', { name: 'Mes commandes', level: 1 })).toBeVisible()

  // page de suivi : timeline de statut
  await page.goto(`/orders/${order.id}`)
  await waitForHydration(page)
  await expect(page.getByRole('heading', { name: 'Suivi de commande', level: 1 })).toBeVisible()
  await expect(page.getByText('Statut de la livraison')).toBeVisible()
})
