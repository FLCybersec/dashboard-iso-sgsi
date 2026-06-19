import { test, expect } from '@playwright/test'
import { mockGraph } from './_helpers/graph-mock.js'

// Tanda B: la clasificacion es un MAPA editable por ruta. Efectiva = override del
// sitio (seguimiento, editable por admin) ?? semilla del repo (maestro) ?? "sin
// clasificar". Maestro stub: "01 Clasificada" lleva semilla Interna; "02 Nueva
// del equipo" no esta en el maestro -> "sin clasificar" hasta que un admin la fije.
const maestro = {
  proyecto: 'Test',
  version: 'e2e',
  generado: '2026-06-19',
  tenant_host: 'jmaseguridad.sharepoint.com',
  hub_slug: 'SGSI-Concentrador',
  clasificaciones: [
    { nivel: 'Interna', color: '#2563eb', retencion: '3 anos' },
    { nivel: 'Confidencial', color: '#d97706', retencion: '5 anos' }
  ],
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

test('clasificacion: admin asigna override a una carpeta "sin clasificar" y persiste', async ({ page }) => {
  await page.route('**/estructura-maestra-sgsi.json*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(maestro) })
  )
  const graph = await mockGraph(page, {
    foldersByDrive: { 'drive-default': ['01 Clasificada', '02 Nueva del equipo'] }
  })

  await page.goto('/sitio/SGSI-Test?e2e=1')

  // Semilla del maestro: "01 Clasificada" sale con badge Interna.
  await expect(
    page.locator('.arbol-row', { hasText: '01 Clasificada' }).first().locator('.badge', { hasText: 'Interna' })
  ).toBeVisible()

  // "02 Nueva del equipo": sin semilla -> "sin clasificar".
  const nueva = page.locator('.arbol-row', { hasText: '02 Nueva del equipo' }).first()
  await expect(nueva.locator('.badge.sin-clasificar')).toBeVisible()

  // El admin la clasifica como Confidencial (override del sitio).
  await nueva.locator('.sel-clasif').selectOption('Confidencial')

  // Persiste en el seguimiento del sitio (override por ruta, con su nivel).
  await expect.poll(() => {
    const last = graph.puts[graph.puts.length - 1]
    return last?.clasificaciones?.['02 Nueva del equipo']?.nivel
  }).toBe('Confidencial')

  // La efectiva ya muestra el badge Confidencial (override).
  await expect(nueva.locator('.badge', { hasText: 'Confidencial' })).toBeVisible()
  await expect(nueva.locator('.badge.sin-clasificar')).toHaveCount(0)
})
