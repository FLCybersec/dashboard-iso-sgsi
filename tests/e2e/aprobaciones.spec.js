import { test, expect } from '@playwright/test'
import { mockGraph } from './_helpers/graph-mock.js'

// Ciclo de vida de una solicitud en Aprobaciones, gestionado a mano y en
// lenguaje llano: Pendiente -> Aprobada (con nombre final + comentario) ->
// Creada. No se autodetecta por nombre/ruta.
test('aprobar una carpeta anota nombre final + comentario y pasa a Aprobada', async ({ page }) => {
  const graph = await mockGraph(page)

  // 1) El usuario solicita crear una carpeta desde el arbol del sitio.
  await page.goto('/sitio/SGSI-CyberSec?e2e=1')
  await page.getByTestId('agregar-raiz').click()
  const form = page.locator('.arbol-agregar').first()
  await form.locator('.arbol-nuevo-nombre').fill('99 Borrador Test')
  await form.getByRole('button', { name: 'Registrar' }).click()
  await expect.poll(() => graph.puts.length).toBeGreaterThan(0)

  // 2) El admin entra a Aprobaciones (navegacion del SPA, conserva el estado en
  // memoria) y la ve como "Pendiente".
  await page.locator('.side-nav a', { hasText: 'Aprobaciones' }).click()
  const fila = page.locator('tr', { hasText: '99 Borrador Test' }).first()
  await expect(fila).toBeVisible()
  await expect(fila.locator('.estado-tag', { hasText: 'Pendiente' })).toBeVisible()

  // 3) Aprobar abre el formulario: el nombre final es OBLIGATORIO (el campo
  // arranca vacio y sin el no se puede confirmar); luego nombre + comentario.
  await fila.getByRole('button', { name: 'Aprobar' }).click()
  const fAprobar = page.getByTestId('aprobar-form')
  await expect(fAprobar).toBeVisible()
  const inputs = fAprobar.locator('input')
  await expect(inputs.nth(0)).toHaveValue('')
  await expect(fAprobar.getByRole('button', { name: 'Confirmar aprobacion' })).toBeDisabled()
  await inputs.nth(0).fill('99 Nombre Final Acordado')
  await expect(fAprobar.getByRole('button', { name: 'Confirmar aprobacion' })).toBeEnabled()
  await inputs.nth(1).fill('Renombrada al crear segun acuerdo')
  await fAprobar.getByRole('button', { name: 'Confirmar aprobacion' }).click()

  // Persiste estado aprobado + nombre final + comentario.
  await expect.poll(() => {
    const last = graph.puts[graph.puts.length - 1]
    return (last?.cambios_estructura || []).some(
      (c) => c.estado === 'aprobado' && c.nombreFinal === '99 Nombre Final Acordado' && c.comentario === 'Renombrada al crear segun acuerdo'
    )
  }).toBe(true)

  // 4) La fila ahora es "Aprobada" y muestra el nombre final acordado.
  const filaAprobada = page.locator('tr', { hasText: '99 Borrador Test' }).first()
  await expect(filaAprobada.locator('.estado-tag', { hasText: 'Aprobada' })).toBeVisible()
  await expect(page.locator('tr', { hasText: 'final acordado: 99 Nombre Final Acordado' })).toBeVisible()

  // 5) "Marcar creada" cierra el ciclo (manual, no autodetectado).
  await filaAprobada.getByRole('button', { name: 'Marcar creada' }).click()
  await expect.poll(() => {
    const last = graph.puts[graph.puts.length - 1]
    return (last?.cambios_estructura || []).some(
      (c) => c.nombreFinal === '99 Nombre Final Acordado' && c.estado === 'aplicado'
    )
  }).toBe(true)
  await expect(page.locator('tr', { hasText: '99 Borrador Test' }).first().locator('.estado-tag', { hasText: 'Creada' })).toBeVisible()
})
