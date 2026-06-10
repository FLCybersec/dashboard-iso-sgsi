import { test, expect } from '@playwright/test'
import { mockGraph } from './_helpers/graph-mock.js'

// Se puede pedir una subcarpeta DENTRO de una carpeta que tambien esta
// "pendiente de crear": cada una es su propio cambio_estructura "crear" con su
// ruta/padre, y el arbol muestra la pendiente anidada dentro de la pendiente.
test('agregar carpeta dentro de una pendiente la anida como pendiente', async ({ page }) => {
  const graph = await mockGraph(page)

  await page.goto('/sitio/SGSI-CyberSec?e2e=1')

  // 1) Carpeta raiz pendiente de crear.
  await page.getByTestId('agregar-raiz').click()
  const rootForm = page.locator('.arbol-agregar').first()
  await rootForm.locator('.arbol-nuevo-nombre').fill('99 Padre Pendiente')
  await rootForm.locator('select').selectOption('Interna')
  await rootForm.getByRole('button', { name: 'Registrar' }).click()

  const padre = page.locator('.arbol-nodo.pendiente', { hasText: '99 Padre Pendiente' }).first()
  await expect(padre).toBeVisible()

  // 2) Dentro de la pendiente, agregar una subcarpeta (pendiente dentro de pendiente).
  const filaPadre = padre.locator('.arbol-row').first()
  await filaPadre.getByRole('button', { name: '+ carpeta' }).click()
  const subForm = padre.locator('.arbol-agregar').first()
  await subForm.locator('.arbol-nuevo-nombre').fill('Sub Pendiente')
  await subForm.locator('select').selectOption('Interna')
  await subForm.getByRole('button', { name: 'Registrar' }).click()

  // 3) Persiste como cambio "crear" con la ruta padre/hijo.
  await expect.poll(() => {
    const last = graph.puts[graph.puts.length - 1]
    return (last?.cambios_estructura || []).some(
      (c) => c.tipo === 'crear' && c.ruta === '99 Padre Pendiente/Sub Pendiente'
    )
  }).toBe(true)

  // 4) El arbol muestra la pendiente anidada dentro de la pendiente.
  await expect(padre.locator('.arbol-nodo.pendiente', { hasText: 'Sub Pendiente' })).toBeVisible()
})
