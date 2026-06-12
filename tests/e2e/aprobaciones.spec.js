import { test, expect } from '@playwright/test'
import { mockGraph } from './_helpers/graph-mock.js'

// Ciclo de vida de una solicitud en Aprobaciones, gestionado a mano y en
// lenguaje llano: Pendiente -> Aprobada -> Creada. Aprobar es UN clic (sin
// formulario ni "nombre final": el nombre canonico lo fija Cowork al generar el
// PnP). El marcado es OPTIMISTA: la UI cambia al instante y NO se relee la
// estructura completa por Graph (el TTL o "Actualizar" reconcilian).
test('aprobar es un clic y marcar creada no relee la estructura', async ({ page }) => {
  const graph = await mockGraph(page)

  // GETs de children (lectura de estructura via Graph) para verificar que
  // marcar creada NO dispara una relectura completa bloqueante.
  let childrenGets = 0
  page.on('request', (r) => {
    if (r.method() === 'GET' && /graph\.microsoft\.com/.test(r.url()) && /:\/children|\/root\/children/.test(r.url())) {
      childrenGets++
    }
  })

  // 1) El usuario solicita crear una carpeta desde el arbol del sitio.
  await page.goto('/sitio/SGSI-CyberSec?e2e=1')
  await page.getByTestId('agregar-raiz').click()
  const form = page.locator('.arbol-agregar').first()
  await form.locator('.arbol-nuevo-nombre').fill('99 Borrador Test')
  await form.locator('select').selectOption('Interna')
  await form.getByRole('button', { name: 'Registrar' }).click()
  await expect.poll(() => graph.puts.length).toBeGreaterThan(0)

  // 2) El admin entra a Aprobaciones (navegacion del SPA, conserva el estado en
  // memoria) y la ve como "Pendiente".
  await page.locator('.side-nav a', { hasText: 'Aprobaciones' }).click()
  const fila = page.locator('tr', { hasText: '99 Borrador Test' }).first()
  await expect(fila).toBeVisible()
  await expect(fila.locator('.estado-tag', { hasText: 'Pendiente' })).toBeVisible()

  // 3) Aprobar: un clic, sin formulario. La fila pasa a "Aprobada" al instante.
  await fila.getByRole('button', { name: 'Aprobar' }).click()
  await expect(page.getByTestId('aprobar-form')).toHaveCount(0)
  const filaAprobada = page.locator('tr', { hasText: '99 Borrador Test' }).first()
  await expect(filaAprobada.locator('.estado-tag', { hasText: 'Aprobada' })).toBeVisible()

  // Persiste estado aprobado, sin exigir nombre final.
  await expect.poll(() => {
    const last = graph.puts[graph.puts.length - 1]
    return (last?.cambios_estructura || []).some(
      (c) => c.ruta === '99 Borrador Test' && c.estado === 'aprobado' && !c.nombreFinal
    )
  }).toBe(true)

  // 4) "Marcar creada" cierra el ciclo (manual, no autodetectado) y la UI
  // cambia al instante, SIN relectura completa de los sitios por Graph.
  const childrenAntes = childrenGets
  await filaAprobada.getByRole('button', { name: 'Marcar creada' }).click()
  await expect(page.locator('tr', { hasText: '99 Borrador Test' }).first().locator('.estado-tag', { hasText: 'Creada' })).toBeVisible()
  await expect.poll(() => {
    const last = graph.puts[graph.puts.length - 1]
    return (last?.cambios_estructura || []).some(
      (c) => c.ruta === '99 Borrador Test' && c.estado === 'aplicado'
    )
  }).toBe(true)
  expect(childrenGets).toBe(childrenAntes)
})

// Acciones por lote: checkbox por fila + "seleccionar todas", para aprobar y
// marcar creadas/aplicadas en bloque, tanto carpetas como permisos.
test('aprobar y marcar en lote carpetas y permisos', async ({ page }) => {
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
  const permiso = (id, persona) => ({
    id,
    slug: 'SGSI-CyberSec',
    tipo: 'agregar',
    persona,
    rol: 'Integrante',
    motivo: 'Proyecto',
    estado: 'propuesto',
    creado: '2026-06-01T10:00:00.000Z',
    creadoPor: 'Carmen'
  })
  const graph = await mockGraph(page, {
    seguimientoSeed: {
      cambios_estructura: [cambio('cam-a', '99 Lote Uno'), cambio('cam-b', '99 Lote Dos')],
      solicitudes_permisos: [permiso('perm-a', 'Daniela'), permiso('perm-b', 'Mauro')]
    }
  })

  await page.goto('/aprobaciones?e2e=1')
  const tCarpetas = page.getByTestId('tabla-carpetas')
  const tPermisos = page.getByTestId('tabla-permisos')
  await expect(tCarpetas.locator('tbody tr')).toHaveCount(2)
  await expect(tPermisos.locator('tbody tr')).toHaveCount(2)

  // --- Carpetas: seleccionar todas -> aprobar en bloque.
  await tCarpetas.locator('thead input[type="checkbox"]').check()
  await page.getByRole('button', { name: /Aprobar seleccionadas \(2\)/ }).click()
  await expect(tCarpetas.locator('.estado-tag', { hasText: 'Aprobada' })).toHaveCount(2)
  await expect.poll(() => {
    const last = graph.puts[graph.puts.length - 1]
    const c = last?.cambios_estructura || []
    return c.filter((x) => x.estado === 'aprobado').length
  }).toBe(2)

  // --- Carpetas: seleccionar todas -> marcar creadas en bloque.
  await tCarpetas.locator('thead input[type="checkbox"]').check()
  await page.getByRole('button', { name: /Marcar creadas\/aplicadas seleccionadas \(2\)/ }).click()
  await expect(tCarpetas.locator('.estado-tag', { hasText: 'Creada' })).toHaveCount(2)
  await expect.poll(() => {
    const last = graph.puts[graph.puts.length - 1]
    const c = last?.cambios_estructura || []
    return c.filter((x) => x.estado === 'aplicado').length
  }).toBe(2)

  // --- Permisos: seleccionar una por checkbox de fila + completar con la otra.
  await tPermisos.locator('tbody input[type="checkbox"]').first().check()
  await tPermisos.locator('tbody input[type="checkbox"]').nth(1).check()
  await page.getByRole('button', { name: /Aprobar seleccionadas \(2\)/ }).click()
  await expect(tPermisos.locator('.estado-tag', { hasText: 'Aprobada' })).toHaveCount(2)
  await expect.poll(() => {
    const last = graph.puts[graph.puts.length - 1]
    const p = last?.solicitudes_permisos || []
    return p.filter((x) => x.estado === 'aprobado').length
  }).toBe(2)

  // --- Permisos: marcar aplicadas en bloque.
  await tPermisos.locator('thead input[type="checkbox"]').check()
  await page.getByRole('button', { name: /Marcar aplicadas seleccionadas \(2\)/ }).click()
  await expect(tPermisos.locator('.estado-tag', { hasText: 'Aplicada' })).toHaveCount(2)
  await expect.poll(() => {
    const last = graph.puts[graph.puts.length - 1]
    const p = last?.solicitudes_permisos || []
    return p.filter((x) => x.estado === 'aplicado').length
  }).toBe(2)
})
