import { test, expect } from '@playwright/test'
import { mockGraph } from './_helpers/graph-mock.js'

// La vista "Por apoyo" lista siempre a los 3 apoyos SGSI.
test('por apoyo lista a Carmen, Ezequiel y Chema', async ({ page }) => {
  await mockGraph(page)
  await page.goto('/personas?e2e=1')
  await page.getByTestId('tab-apoyo').click()

  for (const nombre of ['Carmen', 'Ezequiel', 'Chema']) {
    await expect(page.locator('.usuario', { hasText: nombre }).first()).toBeVisible()
  }
})

// Asignar Apoyo SGSI en la cabecera del sitio persiste migracion_por_sitio.apoyo.
test('asignar apoyo SGSI en el sitio persiste el campo apoyo', async ({ page }) => {
  const graph = await mockGraph(page)
  await page.goto('/sitio/SGSI-CyberSec?e2e=1')

  const sel = page.locator('.cabecera-sitio select').first()
  await expect(sel).toBeVisible()
  await sel.selectOption('Carmen')

  await expect.poll(() => graph.puts.length).toBeGreaterThan(0)
  const last = graph.puts[graph.puts.length - 1]
  expect(last.migracion_por_sitio['SGSI-CyberSec'].apoyo).toBe('Carmen')
})
