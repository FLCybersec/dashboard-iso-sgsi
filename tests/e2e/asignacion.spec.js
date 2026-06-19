import { test, expect } from '@playwright/test'
import { mockGraph } from './_helpers/graph-mock.js'

// "Quien migra" puede ser CUALQUIERA del roster (no solo el propietario).
test('asignar quien migra a cualquiera del roster persiste', async ({ page }) => {
  const graph = await mockGraph(page, {
    foldersByDrive: { 'drive-default': ['09.1 Proyectos y Servicios (AFAC y otros)'] }
  })
  await page.goto('/sitio/SGSI-CyberSec?e2e=1')

  const fila = page.locator('.arbol-row').first()
  await expect(fila).toBeVisible()
  await fila.locator('.sel-quien').selectOption('Daniela')

  await expect.poll(() => graph.puts.length).toBeGreaterThan(0)
  const last = graph.puts[graph.puts.length - 1]
  const algunoDaniela = Object.values(last.nodos || {}).some((n) => n.quienMigra === 'Daniela')
  expect(algunoDaniela).toBe(true)
})

// Verificacion controlada: el usuario E2E es Franco (verificador) y puede marcar
// "Verificada".
test('Franco (verificador) puede marcar Verificada', async ({ page }) => {
  const graph = await mockGraph(page, {
    foldersByDrive: { 'drive-default': ['09.1 Proyectos y Servicios (AFAC y otros)'] }
  })
  await page.goto('/sitio/SGSI-CyberSec?e2e=1')

  const sel = page.locator('.arbol-mig select').first()
  await sel.selectOption('Verificada')

  await expect.poll(() => graph.puts.length).toBeGreaterThan(0)
  const last = graph.puts[graph.puts.length - 1]
  const verificada = Object.values(last.nodos || {}).some((n) => n.migracionEstado === 'Verificada')
  expect(verificada).toBe(true)
})
