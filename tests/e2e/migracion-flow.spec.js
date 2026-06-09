import { test, expect } from '@playwright/test'
import { mockGraph } from './_helpers/graph-mock.js'

// Migracion por CARPETA desde el arbol: cambiar el estado en el selector de una
// carpeta auto-guarda `migracionEstado` en el nodo del seguimiento (PUT).
test('migracion por carpeta (arbol) persiste el estado', async ({ page }) => {
  const graph = await mockGraph(page)

  await page.goto('/sitio/SGSI-CyberSec?e2e=1')

  const sel = page.locator('.arbol-mig select').first()
  await expect(sel).toBeVisible()
  await sel.selectOption('Migrada')

  await expect.poll(() => graph.puts.length).toBeGreaterThan(0)
  const last = graph.puts[graph.puts.length - 1]
  const algunoMigrado = Object.values(last.nodos || {}).some((n) => n.migracionEstado === 'Migrada')
  expect(algunoMigrado).toBe(true)
})
