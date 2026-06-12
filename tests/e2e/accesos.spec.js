import { test, expect } from '@playwright/test'
import { mockGraph } from './_helpers/graph-mock.js'

// Transparencia de permisos por carpeta + gestion de herencias:
// - cada carpeta del arbol tiene "accesos" que muestra quien tiene acceso
//   (propietario + acceso del sitio + accesoExtra del maestro, con herencia),
// - el boton "x" registra una solicitud de QUITAR acceso a ESA carpeta
//   (cola de permisos para PnP; el dashboard no toca permisos reales),
// - en "Mi trabajo" todo el mundo ve el equipo del area (CabeceraSitio).
test('accesos por carpeta: ver quien accede y solicitar quitar (PnP)', async ({ page }) => {
  const graph = await mockGraph(page)

  // RH: el maestro trae accesoExtra en 04.2 (Daniela) y acceso de sitio amplio.
  await page.goto('/sitio/SGSI-RecursosHumanos?e2e=1')
  const fila = page.locator('.arbol-row', { hasText: '04.2 Expedientes de Personal' }).first()
  await expect(fila).toBeVisible()

  // Toggle "accesos": panel con chips (propietaria Wendy + gente del sitio).
  await fila.locator('[data-act="accesos"]').click()
  const panel = page.getByTestId('panel-accesos')
  await expect(panel).toBeVisible()
  await expect(panel.locator('.acceso-pill', { hasText: 'Wendy' }).first()).toBeVisible()
  await expect(panel.locator('.acceso-pill', { hasText: 'Daniela' }).first()).toBeVisible()

  // "x" sobre Daniela: registra solicitud de quitar acceso A ESTA CARPETA.
  await panel.getByRole('button', { name: 'Quitar acceso a Daniela' }).click()
  await expect(panel.locator('.nodo-status.ok')).toBeVisible()
  await expect.poll(() => {
    const last = graph.puts[graph.puts.length - 1]
    return (last?.solicitudes_permisos || []).some(
      (s) =>
        s.tipo === 'quitar' &&
        s.persona === 'Daniela' &&
        s.ruta === '04.2 Expedientes de Personal' &&
        s.slug === 'SGSI-RecursosHumanos' &&
        s.estado === 'propuesto'
    )
  }).toBe(true)

  // La bandeja de Aprobaciones muestra la solicitud CON su carpeta.
  await page.locator('.side-nav a', { hasText: 'Aprobaciones' }).click()
  const filaPerm = page.locator('tr', { hasText: 'Daniela' }).first()
  await expect(filaPerm).toBeVisible()
  await expect(filaPerm.locator('td', { hasText: 'Quitar (carpeta)' })).toBeVisible()
  await expect(filaPerm.locator('code', { hasText: '04.2 Expedientes de Personal' })).toBeVisible()
})

test('mi trabajo muestra el equipo del area (permisos del grupo) a todos', async ({ page }) => {
  await mockGraph(page)
  await page.goto('/?e2e=1')
  const area = page.locator('.mi-area').first()
  await expect(area).toBeVisible()
  // Cabecera con propietario y lista de acceso, visible sin ser admin de la vista.
  const cab = area.locator('.cabecera-sitio')
  await expect(cab).toBeVisible()
  await expect(cab.locator('.acceso-list')).toBeVisible()
})

test('acceso heredado de un padre con accesoExtra se ve en los hijos', async ({ page }) => {
  // Maestro stub: Daniela tiene accesoExtra SOLO en el padre (no en el sitio);
  // el hijo debe mostrarla como acceso extra heredado "desde" el padre.
  const maestro = {
    proyecto: 'Test',
    version: 'e2e',
    generado: '2026-06-12',
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
        carpetas: [
          {
            nombre: '01 Padre',
            clasificacion: 'Interna',
            accesoExtra: ['Daniela'],
            hijos: [{ nombre: '01.1 Hijo', clasificacion: 'Interna' }]
          }
        ]
      }
    ]
  }
  await page.route('**/estructura-maestra-sgsi.json*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(maestro) })
  )
  await mockGraph(page)

  await page.goto('/sitio/SGSI-Test?e2e=1')
  const hijo = page.locator('.arbol-row', { hasText: '01.1 Hijo' }).first()
  await expect(hijo).toBeVisible()
  // El contador del toggle refleja el extra heredado.
  await expect(hijo.locator('[data-act="accesos"]')).toHaveText(/accesos \(\+1\)/)
  await hijo.locator('[data-act="accesos"]').click()
  const panel = page.getByTestId('panel-accesos')
  const daniela = panel.locator('.acceso-pill', { hasText: 'Daniela' }).first()
  await expect(daniela).toBeVisible()
  await expect(daniela.locator('.temporal.extra')).toBeVisible()
  await expect(daniela.locator('.temporal.extra')).toHaveText(/01 Padre/)
})
