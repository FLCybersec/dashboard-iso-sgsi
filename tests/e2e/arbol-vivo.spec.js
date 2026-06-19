import { test, expect } from '@playwright/test'
import { mockGraph } from './_helpers/graph-mock.js'

// Tanda A: el arbol sale EN VIVO de SharePoint (no del maestro) y carga LAZY por
// nivel. Maestro stub minimo: una carpeta clasificada ("01 Clasificada") y otra
// que NO esta en el maestro ("02 Nueva del equipo") -> debe salir "sin clasificar".
const maestro = {
  proyecto: 'Test',
  version: 'e2e',
  generado: '2026-06-19',
  tenant_host: 'jmaseguridad.sharepoint.com',
  hub_slug: 'SGSI-Concentrador',
  clasificaciones: [{ nivel: 'Interna', color: '#2563eb', retencion: '3 anos' }],
  sitios: [
    {
      slug: 'SGSI-Test',
      nombre: 'Sitio Test',
      tipo: 'area',
      propietario: 'Wendy Rodriguez',
      acceso: ['Wendy'],
      carpetas: [{ nombre: '01 Clasificada', clasificacion: 'Interna' }]
    }
  ]
}

test('arbol en vivo: lazy-load por nivel y badge "sin clasificar"', async ({ page }) => {
  await page.route('**/estructura-maestra-sgsi.json*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(maestro) })
  )
  await mockGraph(page, {
    foldersByDrive: {
      'drive-default': [
        '01 Clasificada',
        '01 Clasificada/01.1 Subcarpeta',
        '02 Nueva del equipo'
      ]
    }
  })

  await page.goto('/sitio/SGSI-Test?e2e=1')

  // Raiz: las dos carpetas reales del drive (no las del maestro).
  await expect(page.locator('.arbol-row', { hasText: '01 Clasificada' }).first()).toBeVisible()
  const nueva = page.locator('.arbol-row', { hasText: '02 Nueva del equipo' }).first()
  await expect(nueva).toBeVisible()

  // La carpeta del maestro lleva su clasificacion (semilla); la nueva, "sin clasificar".
  await expect(page.locator('.arbol-row', { hasText: '01 Clasificada' }).first().locator('.badge', { hasText: 'Interna' })).toBeVisible()
  await expect(nueva.locator('.badge.sin-clasificar')).toBeVisible()

  // Ya no existe el estado de ESTRUCTURA "Pendiente/Creada" en el arbol.
  await expect(page.locator('.arbol .estr-tag')).toHaveCount(0)

  // Lazy: la subcarpeta NO esta en el DOM hasta expandir el padre.
  await expect(page.locator('.arbol-row', { hasText: '01.1 Subcarpeta' })).toHaveCount(0)
  await page.locator('.arbol-row', { hasText: '01 Clasificada' }).first().locator('.arbol-caret').click()
  await expect(page.locator('.arbol-row', { hasText: '01.1 Subcarpeta' }).first()).toBeVisible()
})
