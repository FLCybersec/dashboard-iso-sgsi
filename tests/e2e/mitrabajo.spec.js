import { test, expect } from '@playwright/test'
import { mockGraph } from './_helpers/graph-mock.js'

// "Mi trabajo" es el landing. Sin asignaciones, guia con un estado vacio claro.
test('mi trabajo es el landing y guia cuando no hay asignaciones', async ({ page }) => {
  await mockGraph(page)
  await page.goto('/?e2e=1')

  await expect(page.getByRole('heading', { name: 'Mi trabajo' })).toBeVisible()
  // Siempre puede solicitar acceso a un area.
  await expect(page.getByText('Solicitar acceso a un area')).toBeVisible()
})
