import { test, expect } from '@playwright/test'
import { mockGraph } from './_helpers/graph-mock.js'

// Tanda D: barrido de huerfanos. Una entrada de seguimiento con avance cuya
// carpeta YA NO existe viva (renombrada sin reconciliar / borrada) se surfacea en
// "Requiere atencion" del Resumen, sin borrarse (revision humana).
test('huerfanos: seguimiento sin carpeta viva se surfacea en Requiere atencion', async ({ page }) => {
  await mockGraph(page, {
    // Hay carpetas vivas, pero NINGUNA se llama "Carpeta Borrada".
    foldersByDrive: { 'drive-default': ['00.1 Contexto y Alcance'] },
    seguimientoSeed: {
      nodos: {
        'SGSI-K9::Carpeta Borrada': {
          migracionEstado: 'Migrada',
          quienMigra: 'Daniela',
          itemId: 'item-inexistente',
          historial: []
        }
      }
    }
  })

  await page.goto('/resumen?e2e=1')

  await expect(page.getByRole('heading', { name: 'Resumen' })).toBeVisible()
  // El panel "Requiere atencion" lista la entrada huerfana.
  const aten = page.locator('.card', { hasText: 'Requiere atencion' })
  await expect(aten.locator('li', { hasText: 'sin carpeta viva' })).toBeVisible()
})
