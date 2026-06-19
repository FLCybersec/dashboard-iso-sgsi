import { test, expect } from '@playwright/test'
import { mockGraph } from './_helpers/graph-mock.js'

// Tanda C: el seguimiento se ancla al itemId (estable ante renombres). Si una
// carpeta se renombra, el avance ligado a la ruta vieja debe SEGUIR a la carpeta
// (re-llave por itemId), no perderse.
//
// Simulacion: el mock genera el itemId de una carpeta raiz "X" como "item-X/".
// La carpeta viva es "10.1 CANINOS" (nombre NUEVO) -> su itemId sera
// "item-10.1 CANINOS/". Sembramos un seguimiento con el avance en la ruta VIEJA
// ("1 CANINOS") pero con ESE itemId: es justo el estado tras un renombre antes de
// reconciliar. Al cargar, reconciliarSitio debe mover el avance a "10.1 CANINOS".
const maestro = {
  proyecto: 'Test',
  version: 'e2e',
  generado: '2026-06-19',
  tenant_host: 'jmaseguridad.sharepoint.com',
  hub_slug: 'SGSI-Concentrador',
  clasificaciones: [{ nivel: 'Interna', color: '#2563eb', retencion: '3 anos' }],
  sitios: [
    { slug: 'SGSI-Test', nombre: 'Sitio Test', tipo: 'area', propietario: 'Wendy Rodriguez', acceso: ['Wendy'], carpetas: [] }
  ]
}

const seguimientoSeed = {
  version: '1.0',
  nodos: {
    'SGSI-Test::1 CANINOS': {
      tipo: 'carpeta',
      migracionEstado: 'Migrada',
      quienMigra: 'Daniela',
      itemId: 'item-10.1 CANINOS/',
      historial: []
    }
  },
  clasificaciones: {}
}

test('reconciliacion por itemId: el avance sigue a la carpeta renombrada', async ({ page }) => {
  await page.route('**/estructura-maestra-sgsi.json*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(maestro) })
  )
  const graph = await mockGraph(page, {
    foldersByDrive: { 'drive-default': ['10.1 CANINOS'] },
    seguimientoSeed
  })

  await page.goto('/sitio/SGSI-Test?e2e=1')

  // La carpeta viva "10.1 CANINOS" hereda el avance de la ruta vieja "1 CANINOS".
  const fila = page.locator('.arbol-row', { hasText: '10.1 CANINOS' }).first()
  await expect(fila).toBeVisible()
  await expect(fila.locator('.estado-tag', { hasText: 'Migrada' })).toBeVisible()

  // Persistio el re-llave: el avance vive en la ruta NUEVA, no en la vieja, y
  // queda evidencia del movimiento en el historial.
  await expect.poll(() => {
    const last = graph.puts[graph.puts.length - 1]
    if (!last?.nodos) return null
    return {
      nueva: !!last.nodos['SGSI-Test::10.1 CANINOS'],
      vieja: !!last.nodos['SGSI-Test::1 CANINOS']
    }
  }).toEqual({ nueva: true, vieja: false })

  const last = graph.puts[graph.puts.length - 1]
  const ent = last.nodos['SGSI-Test::10.1 CANINOS']
  expect(ent.migracionEstado).toBe('Migrada')
  expect(ent.itemId).toBe('item-10.1 CANINOS/')
  expect((ent.historial || []).some((h) => /Reconciliada por itemId/.test(h.nota || ''))).toBe(true)
})
