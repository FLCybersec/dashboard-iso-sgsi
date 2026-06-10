import { test, expect } from '@playwright/test'
import { mockGraph } from './_helpers/graph-mock.js'

// Regresion QA #3 (2026-06-10, Carmen): "Solicitar acceso a un area" fallaba
// para todo perfil NO-admin cuando el area era ajena. Causa: la solicitud se
// guardaba en el archivo de seguimiento del sitio DESTINO, donde el solicitante
// por definicion no tiene escritura (justo por eso pide acceso). Ahora se
// guarda con cascada: sitio destino -> area(s) propia(s) -> hub; `slug`
// conserva el destino y la bandeja de Aprobaciones la une por id.
const SEED_DANIELA = {
  version: '1.0',
  nodos: {
    'SGSI-CyberSec::09.1 Proyectos y Servicios (AFAC y otros)': {
      migracionEstado: 'En progreso',
      quienMigra: 'Daniela',
      ultimaModificacion: '2026-06-01T10:00:00.000Z',
      historial: []
    }
  },
  pendientes: [],
  fases_por_sitio: {},
  migracion_por_sitio: {},
  cambios_estructura: [],
  solicitudes_permisos: []
}

test('no-admin solicita acceso a un area ajena: se registra en su propia area', async ({ page }) => {
  const graph = await mockGraph(page, {
    seguimientoSeed: SEED_DANIELA,
    denySites: ['SGSI-Marketing'] // Daniela NO tiene acceso al area que pide
  })

  // Daniela (no-admin): su area escribible es SGSI-CyberSec (carpeta asignada).
  await page.goto('/?e2e=1&as=daniela@jmaseguridad.com')

  const panel = page.locator('.card', { hasText: 'Solicitar acceso a un area' })
  await expect(panel).toBeVisible()
  await panel.locator('select').selectOption('SGSI-Marketing')
  await panel.locator('input[type="text"]').fill('Necesito consultar campanas para un proyecto')
  await panel.getByRole('button', { name: 'Solicitar acceso' }).click()

  // La solicitud SE REGISTRA (antes: error y no se guardaba).
  await expect(page.locator('.nodo-status.ok', { hasText: 'Solicitud de acceso registrada' })).toBeVisible()

  // Quedo guardada en el archivo de un sitio donde Daniela SI escribe (su
  // area propia), con el DESTINO conservado en `slug`.
  await expect.poll(() => {
    for (const [siteId, archivo] of graph.putsPorSitio) {
      const ok = (archivo?.solicitudes_permisos || []).some(
        (s) => s.slug === 'SGSI-Marketing' && s.persona === 'Daniela' && s.estado === 'propuesto'
      )
      if (ok) return siteId
    }
    return null
  }).not.toBe(null)
  // Y NUNCA en el archivo del sitio destino (no tiene acceso).
  expect(graph.putsPorSitio.has('site-SGSI-Marketing')).toBe(false)

  // El admin la ve en Aprobaciones (la agregacion une por id aunque la
  // solicitud viva en el archivo de otro sitio).
  await page.goto('/aprobaciones?e2e=1')
  const fila = page.locator('tr', { hasText: 'Daniela' }).first()
  await expect(fila).toBeVisible()
  await expect(fila.locator('.estado-tag', { hasText: 'Pendiente' })).toBeVisible()
})
