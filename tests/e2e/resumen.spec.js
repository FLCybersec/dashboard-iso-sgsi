import { test, expect } from '@playwright/test'
import { mockGraph } from './_helpers/graph-mock.js'

// Resumen: con sesion E2E y Graph mockeado, el dashboard detecta el estado y
// renderiza el avance global y la tabla de sitios.
test('Resumen carga avance global y sitios (Graph mockeado)', async ({ page }) => {
  await mockGraph(page, {
    // El hub tiene 2 carpetas creadas en su biblioteca por defecto.
    foldersByDrive: { 'drive-default': ['00.1 Contexto y Alcance', '_Plantillas'] }
  })

  await page.goto('/resumen?e2e=1')

  await expect(page.getByRole('heading', { name: 'Resumen' })).toBeVisible()
  // Encabeza la migracion de contenido sobre la estructura REAL (arbol vivo). El
  // estado de estructura "Pendiente/Creada" ya no existe (Tanda D).
  await expect(page.locator('.progress-global.destacado', { hasText: 'Avance de migracion de contenido' })).toBeVisible()
  await expect(page.locator('.progress-global.destacado', { hasText: 'carpetas reales' })).toBeVisible()

  // La tabla de sitios debe mostrar el concentrador (hub).
  await expect(page.getByText('Concentrador Documental SGSI')).toBeVisible()
  // El % global de migracion es visible.
  await expect(page.locator('.progress-global.destacado .progress-global-top span')).toContainText('%')
})
