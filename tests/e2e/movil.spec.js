import { test, expect } from '@playwright/test'
import { mockGraph } from './_helpers/graph-mock.js'

// Uso desde telefono (viewport 390x844, iPhone-ish): la barra lateral se vuelve
// cabecera con menu hamburguesa (se cierra al navegar) y las vistas con tablas
// siguen siendo operables (scroll horizontal + acciones por lote).
test.use({ viewport: { width: 390, height: 844 } })

const cambio = (id, ruta) => ({
  id,
  slug: 'SGSI-CyberSec',
  tipo: 'crear',
  ruta,
  clasificacion: 'Interna',
  responsable: '',
  notas: '',
  estado: 'propuesto',
  creado: '2026-06-01T10:00:00.000Z',
  creadoPor: 'Carmen'
})

test('movil: menu hamburguesa navega y aprobar en lote funciona', async ({ page }) => {
  const graph = await mockGraph(page, {
    seguimientoSeed: { cambios_estructura: [cambio('cam-a', '99 Movil Uno'), cambio('cam-b', '99 Movil Dos')] }
  })

  await page.goto('/?e2e=1')

  // El menu arranca plegado; la hamburguesa lo abre y navegar lo cierra.
  await expect(page.locator('.side-nav')).toBeHidden()
  const burger = page.locator('.nav-burger')
  await expect(burger).toBeVisible()
  await burger.click()
  await expect(page.locator('.side-nav')).toBeVisible()
  await page.locator('.side-nav a', { hasText: 'Aprobaciones' }).click()
  await expect(page.locator('.side-nav')).toBeHidden()
  await expect(page.locator('h1', { hasText: 'Aprobaciones' })).toBeVisible()

  // La bandeja es operable en movil: seleccionar todas y aprobar en lote.
  const tCarpetas = page.getByTestId('tabla-carpetas')
  await tCarpetas.locator('thead input[type="checkbox"]').check()
  await page.getByRole('button', { name: /Aprobar seleccionadas \(2\)/ }).click()
  await expect(tCarpetas.locator('.estado-tag', { hasText: 'Aprobada' })).toHaveCount(2)
  await expect.poll(() => {
    const last = graph.puts[graph.puts.length - 1]
    return (last?.cambios_estructura || []).filter((x) => x.estado === 'aprobado').length
  }).toBe(2)

  // Sin scroll horizontal del documento (las tablas hacen scroll interno).
  const overflowDoc = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  )
  expect(overflowDoc).toBe(false)

  // La cuenta y "Salir" estan disponibles tras la hamburguesa.
  await burger.click()
  await expect(page.locator('.sidebar-cuenta .cuenta-salir')).toBeVisible()
})
