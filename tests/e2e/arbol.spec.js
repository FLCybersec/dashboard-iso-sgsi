import { test, expect } from '@playwright/test'
import { mockGraph } from './_helpers/graph-mock.js'

// "Agregar carpeta" en el arbol registra un cambio_estructura tipo crear y la
// muestra como "pendiente de crear" (sin tocar SharePoint real).
test('agregar carpeta en el arbol la registra como pendiente de crear', async ({ page }) => {
  const graph = await mockGraph(page)

  await page.goto('/sitio/SGSI-CyberSec?e2e=1')

  await page.getByTestId('agregar-raiz').click()
  const form = page.locator('.arbol-agregar').first()
  await form.locator('.arbol-nuevo-nombre').fill('99 Carpeta Nueva Test')
  await form.getByRole('button', { name: 'Registrar' }).click()

  await expect.poll(() => graph.puts.length).toBeGreaterThan(0)
  const last = graph.puts[graph.puts.length - 1]
  expect(
    (last.cambios_estructura || []).some((c) => c.tipo === 'crear' && c.ruta === '99 Carpeta Nueva Test')
  ).toBe(true)

  await expect(
    page.locator('.arbol-nodo.pendiente', { hasText: '99 Carpeta Nueva Test' }).first()
  ).toBeVisible()
})
