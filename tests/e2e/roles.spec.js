import { test, expect } from '@playwright/test'
import { mockGraph } from './_helpers/graph-mock.js'

// Admin (Franco) ve las 5 entradas de la barra lateral.
test('admin ve la navegacion completa (5 entradas)', async ({ page }) => {
  await mockGraph(page)
  await page.goto('/?e2e=1')
  for (const txt of ['Mi trabajo', 'Resumen', 'Personas', 'Sitios', 'Evidencia']) {
    await expect(page.locator('.side-nav a', { hasText: txt }).first()).toBeVisible()
  }
})

// Usuario no-admin solo ve "Mi trabajo".
test('usuario no-admin solo ve Mi trabajo', async ({ page }) => {
  await mockGraph(page)
  await page.goto('/?e2e=1&as=daniela@jmacybersec.com')
  await expect(page.locator('.side-nav a', { hasText: 'Mi trabajo' })).toBeVisible()
  await expect(page.locator('.side-nav a', { hasText: 'Personas' })).toHaveCount(0)
  await expect(page.locator('.side-nav a', { hasText: 'Sitios' })).toHaveCount(0)
  await expect(page.locator('.side-nav a', { hasText: 'Evidencia' })).toHaveCount(0)
})

// Observador (consultoria ISO externa): ve las vistas globales en solo lectura,
// sin "Mi trabajo" ni "Aprobaciones".
test('observador ve las vistas globales pero no Mi trabajo ni Aprobaciones', async ({ page }) => {
  await mockGraph(page)
  await page.goto('/?e2e=1&as=socorro.rojas@hotmail.com')
  for (const txt of ['Resumen', 'Personas', 'Sitios', 'Evidencia']) {
    await expect(page.locator('.side-nav a', { hasText: txt }).first()).toBeVisible()
  }
  await expect(page.locator('.side-nav a', { hasText: 'Mi trabajo' })).toHaveCount(0)
  await expect(page.locator('.side-nav a', { hasText: 'Aprobaciones' })).toHaveCount(0)
  // Badge de solo lectura visible en la cuenta.
  await expect(page.locator('.rol-badge', { hasText: 'solo lectura' })).toBeVisible()
})

// El UPN de invitado B2B que emite Entra (#EXT#) tambien resuelve a observador,
// no a usuario. El '#' va codificado (%23) para no truncar el query.
test('observador: el UPN de invitado #EXT# resuelve a observador', async ({ page }) => {
  await mockGraph(page)
  await page.goto('/?e2e=1&as=socorro.rojas_hotmail.com%23EXT%23@jmaseguridad.onmicrosoft.com')
  await expect(page.locator('.side-nav a', { hasText: 'Resumen' }).first()).toBeVisible()
  await expect(page.locator('.side-nav a', { hasText: 'Mi trabajo' })).toHaveCount(0)
  await expect(page.locator('.rol-badge', { hasText: 'solo lectura' })).toBeVisible()
})
