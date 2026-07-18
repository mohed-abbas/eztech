import { test, expect } from '@playwright/test'

// DEPLOY-10 committed E2E smoke gate: login -> catalogue -> cart -> checkout, with one
// authenticated assertion at the end. Credentials default to the seeded demo customer
// (backend/prisma/seed-demo.ts CUSTOMERS[0] / CUSTOMER_PASSWORD = marie@example.com /
// password123, auto-seeded when SEED_DEMO=true). Keep these two in sync with the CI
// e2e-smoke job (plan 08-08) if the seed data ever changes.
const EMAIL = process.env.E2E_EMAIL ?? 'marie@example.com'
const PASSWORD = process.env.E2E_PASSWORD ?? 'password123'

test('login, browse catalogue, add to cart, reach checkout', async ({ page }) => {
  // Login
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(EMAIL)
  await page.getByLabel('Mot de passe').fill(PASSWORD)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.waitForURL('**/products')

  // Catalogue renders real products fetched from the backend
  await expect(page.getByRole('heading', { name: 'Catalogue', level: 1 })).toBeVisible()
  const firstProductLink = page.getByRole('link', { name: 'Louer' }).first()
  await expect(firstProductLink).toBeVisible()
  await firstProductLink.click()

  // Product detail -> add to cart
  await page.getByRole('button', { name: 'Ajouter au panier' }).click()
  await expect(page.getByRole('button', { name: 'Ajouté au panier !' })).toBeVisible()
  await page.getByRole('link', { name: 'Voir le panier' }).click()

  // Cart reflects the added item
  await page.waitForURL('**/cart')
  await expect(page.getByRole('heading', { name: 'Mon panier', level: 1 })).toBeVisible()
  await expect(page.getByText('1 article dans votre panier')).toBeVisible()

  // Proceed to checkout
  await page.getByRole('button', { name: 'Passer au paiement' }).click()
  await page.waitForURL('**/checkout')
  await expect(page.getByRole('heading', { name: 'Paiement sécurisé', level: 1 })).toBeVisible()

  // Authenticated assertion: the profile page resolves the logged-in seeded customer via the
  // httpOnly session cookie (SSR-visible, Phase 7 cookie auth).
  await page.goto('/profile')
  await expect(page.getByRole('heading', { name: 'Marie Dubois' })).toBeVisible()
})
