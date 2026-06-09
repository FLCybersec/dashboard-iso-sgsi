import { test, expect } from '@playwright/test'
import { mockGraph } from './_helpers/graph-mock.js'

// Regresion: en sitios multi-biblioteca (Direccion y Gobierno) las "bibliotecas"
// se aprovisionaron como CARPETAS dentro del drive por defecto. La deteccion debe
// usar la ruta completa (con la biblioteca como 1a carpeta) contra ese drive.
test('multi-biblioteca: detecta carpetas dentro del drive por defecto', async ({ page }) => {
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

  // La carpeta dentro de la biblioteca "Consejo" debe detectarse como existente
  // (badge de estructura "Creada" en su fila del arbol).
  const fila = page.locator('.arbol-row', { hasText: '01.1 Actas de Sesion' }).first()
  await expect(fila).toBeVisible()
  await expect(fila).toContainText('Creada')
})
