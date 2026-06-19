import { test, expect } from '@playwright/test'
import { mockGraph } from './_helpers/graph-mock.js'

// Regresion: en sitios multi-biblioteca (Direccion y Gobierno) las "bibliotecas"
// se aprovisionaron como CARPETAS dentro del drive por defecto. El arbol EN VIVO
// las recorre como carpetas normales del drive (la ruta completa lleva la
// biblioteca como 1a carpeta), sin tratamiento especial.
test('multi-biblioteca: el arbol en vivo recorre carpetas dentro del drive por defecto', async ({ page }) => {
  await mockGraph(page, {
    foldersByDrive: {
      'drive-default': [
        'Consejo',
        'Consejo/01.1 Actas de Sesion',
        'Consejo/01.2 Acuerdos y Seguimiento'
      ]
    }
  })

  await page.goto('/sitio/SGSI-DireccionGobierno?e2e=1')

  // La biblioteca "Consejo" aparece como carpeta raiz; al expandirla se ven sus
  // subcarpetas reales (lazy-load por nivel).
  const consejo = page.locator('.arbol-row', { hasText: 'Consejo' }).first()
  await expect(consejo).toBeVisible()
  await consejo.locator('.arbol-caret').click()
  await expect(page.locator('.arbol-row', { hasText: '01.1 Actas de Sesion' }).first()).toBeVisible()
  await expect(page.locator('.arbol-row', { hasText: '01.2 Acuerdos y Seguimiento' }).first()).toBeVisible()
})
