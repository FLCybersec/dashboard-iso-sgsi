import { test, expect } from '@playwright/test'
import { mockGraph } from './_helpers/graph-mock.js'

// Regresion del "lost update" entre sesiones: el PUT del seguimiento reemplaza
// el archivo COMPLETO del sitio. Si otra sesion (el area) propuso una subcarpeta
// dentro de una carpeta virtual DESPUES de que esta sesion (el admin) cargo su
// copia, aprobar el padre desde la copia vieja borraba la subcarpeta del
// servidor: la aprobacion "no aparecia" y la carpeta "desaparecia". La
// escritura ahora relee y fusiona antes de subir.
test('aprobar con copia vieja NO borra la subcarpeta propuesta por otra sesion', async ({ page }) => {
  const padre = {
    id: 'cam-padre',
    slug: 'SGSI-CyberSec',
    tipo: 'crear',
    ruta: '99 Padre Pendiente',
    clasificacion: '',
    responsable: '',
    notas: '',
    estado: 'propuesto',
    creado: '2026-06-01T10:00:00.000Z',
    creadoPor: 'Carmen'
  }
  const hijo = {
    id: 'cam-hijo',
    slug: 'SGSI-CyberSec',
    tipo: 'crear',
    ruta: '99 Padre Pendiente/Sub Pendiente',
    clasificacion: '',
    responsable: '',
    notas: '',
    estado: 'propuesto',
    creado: '2026-06-01T11:00:00.000Z',
    creadoPor: 'Carmen'
  }

  // El archivo del sitio arranca solo con el padre: es lo que carga el admin.
  const graph = await mockGraph(page, {
    seguimientoSeed: { cambios_estructura: [padre] }
  })

  await page.goto('/aprobaciones?e2e=1')
  const filaPadre = page.locator('tr', { hasText: '99 Padre Pendiente' }).first()
  await expect(filaPadre).toBeVisible()

  // OTRA sesion (el area) propone la subcarpeta dentro de la virtual: sube el
  // archivo con padre + hijo. La copia en memoria del admin sigue sin el hijo.
  await page.evaluate(
    async ({ padre, hijo }) => {
      await fetch(
        'https://graph.microsoft.com/v1.0/sites/site-SGSI-CyberSec/drive/root:/_seguimiento/seguimiento-migracion.json:/content',
        { method: 'PUT', body: JSON.stringify({ cambios_estructura: [padre, hijo] }) }
      )
    },
    { padre, hijo }
  )

  // El admin aprueba el padre desde su copia vieja (un clic, sin formulario).
  await filaPadre.getByRole('button', { name: 'Aprobar' }).click()

  // El ultimo PUT conserva la subcarpeta del area Y aprueba el padre.
  await expect.poll(() => {
    const last = graph.puts[graph.puts.length - 1]
    const c = last?.cambios_estructura || []
    return (
      c.some((x) => x.id === 'cam-hijo' && x.estado === 'propuesto') &&
      c.some((x) => x.id === 'cam-padre' && x.estado === 'aprobado')
    )
  }).toBe(true)

  // Y tras la fusion, la solicitud de la subcarpeta APARECE en la bandeja.
  await expect(page.locator('tr', { hasText: '99 Padre Pendiente/Sub Pendiente' })).toBeVisible()
})
