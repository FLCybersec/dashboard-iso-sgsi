import { test, expect } from '@playwright/test'
import { mockGraph } from './_helpers/graph-mock.js'

// Sin asignaciones, "Por usuario" guia con un estado vacio (ya no usa el
// propietario por defecto; el sujeto es "quien migra").
test('por usuario guia cuando nadie tiene carpetas asignadas', async ({ page }) => {
  await mockGraph(page)
  await page.goto('/personas?e2e=1')

  await expect(page.getByRole('heading', { name: 'Personas' })).toBeVisible()
  await expect(page.getByText(/Aun nadie tiene carpetas asignadas/i)).toBeVisible()
})

// Con una carpeta asignada a Daniela (cualquiera del roster), aparece su tarjeta.
test('por usuario muestra a quien tiene carpetas asignadas (Daniela)', async ({ page }) => {
  await mockGraph(page, {
    seguimientoSeed: {
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
  })

  await page.goto('/personas?e2e=1')
  await expect(page.locator('.usuario', { hasText: 'Daniela' }).first()).toBeVisible()
})
