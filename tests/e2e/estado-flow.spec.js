import { test, expect } from '@playwright/test'
import { mockGraph } from './_helpers/graph-mock.js'

// Marcar "sobrante" una carpeta existente la registra como cambio_estructura
// (no toca SharePoint real) y la marca en el arbol.
test('marcar sobrante registra un cambio de estructura', async ({ page }) => {
  const graph = await mockGraph(page)

  await page.goto('/sitio/SGSI-CyberSec?e2e=1')

  const fila = page.locator('.arbol-row').first()
  await expect(fila).toBeVisible()
  await fila.getByRole('button', { name: 'sobrante' }).click()

  await expect.poll(() => graph.puts.length).toBeGreaterThan(0)
  const last = graph.puts[graph.puts.length - 1]
  expect((last.cambios_estructura || []).some((c) => c.tipo === 'sobrante')).toBe(true)
})
