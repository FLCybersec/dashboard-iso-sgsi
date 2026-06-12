import { test, expect } from '@playwright/test'
import { mockGraph } from './_helpers/graph-mock.js'

// Regresion del reporte de Franco (2026-06-12, carpetas "Año" en Finanzas):
// un doble registro de la MISMA carpeta creaba dos solicitudes con la misma
// ruta, y "quitar" descartaba solo una -> la carpeta virtual "no se podia
// quitar". Doble defensa: el store rechaza duplicados abiertos, y "quitar"
// descarta TODAS las solicitudes de la ruta.

test('registrar dos veces la misma carpeta: la segunda se rechaza', async ({ page }) => {
  const graph = await mockGraph(page)
  await page.goto('/sitio/SGSI-CyberSec?e2e=1')

  // Primera solicitud: OK.
  await page.getByTestId('agregar-raiz').click()
  let form = page.locator('.arbol-agregar').first()
  await form.locator('.arbol-nuevo-nombre').fill('99 Duplicada Test')
  await form.locator('select').selectOption('Interna')
  await form.getByRole('button', { name: 'Registrar' }).click()
  await expect.poll(() => graph.puts.length).toBeGreaterThan(0)
  await expect(page.locator('.arbol-row', { hasText: '99 Duplicada Test' })).toBeVisible()

  // Segunda solicitud con la MISMA ruta: el store la rechaza con aviso claro.
  await page.getByTestId('agregar-raiz').click()
  form = page.locator('.arbol-agregar').first()
  await form.locator('.arbol-nuevo-nombre').fill('99 Duplicada Test')
  await form.locator('select').selectOption('Interna')
  await form.getByRole('button', { name: 'Registrar' }).click()
  await expect(page.locator('.nodo-status.err', { hasText: 'Ya hay una solicitud abierta' })).toBeVisible()

  // En el archivo queda UNA sola solicitud para esa ruta.
  await expect.poll(() => {
    const last = graph.puts[graph.puts.length - 1]
    return (last?.cambios_estructura || []).filter((c) => c.ruta === '99 Duplicada Test').length
  }).toBe(1)
})

test('quitar una carpeta virtual descarta TODAS sus solicitudes duplicadas', async ({ page }) => {
  const cambio = (id) => ({
    id,
    slug: 'SGSI-CyberSec',
    tipo: 'crear',
    ruta: '99 Doble Registro',
    clasificacion: 'Interna',
    responsable: '',
    notas: '',
    estado: 'propuesto',
    creado: '2026-06-01T10:00:00.000Z',
    creadoPor: 'Martha'
  })
  // Duplicadas preexistentes (datos como los que dejo el doble clic).
  const graph = await mockGraph(page, {
    seguimientoSeed: { cambios_estructura: [cambio('cam-dup-a'), cambio('cam-dup-b')] }
  })

  await page.goto('/sitio/SGSI-CyberSec?e2e=1')
  // El arbol muestra UNA fila virtual (dedupe por ruta).
  const fila = page.locator('.arbol-row', { hasText: '99 Doble Registro' })
  await expect(fila).toHaveCount(1)

  // UN clic en "quitar" descarta AMBAS solicitudes y la fila desaparece.
  await fila.locator('.link-act', { hasText: 'quitar' }).click()
  await expect.poll(() => {
    const last = graph.puts[graph.puts.length - 1]
    const c = last?.cambios_estructura || []
    return (
      c.find((x) => x.id === 'cam-dup-a')?.estado === 'descartado' &&
      c.find((x) => x.id === 'cam-dup-b')?.estado === 'descartado'
    )
  }).toBe(true)
  await expect(page.locator('.arbol-row', { hasText: '99 Doble Registro' })).toHaveCount(0)
})
