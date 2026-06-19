import { test, expect } from '@playwright/test'
import { mockGraph } from './_helpers/graph-mock.js'

// Regresion del BUG prioritario: la Tanda D dejaba las vistas globales esperando
// el crawl recursivo completo (~4214 carpetas), bloqueando el render >5 min.
// Ahora el render NO espera el crawl: la grilla pinta de inmediato y el conteo
// vivo llega en segundo plano. Se simula el coste del crawl retardando TODAS las
// llamadas de children 4s; aun asi las vistas deben renderizar muy rapido.
const DELAY = 4000

test('Sitios renderiza sin esperar el crawl (no bloqueante)', async ({ page }) => {
  await mockGraph(page, {
    foldersByDrive: { 'drive-default': ['00.1 Contexto y Alcance', '00.2 Politicas'] },
    delayChildrenMs: DELAY
  })

  await page.goto('/sitios?e2e=1')

  // La grilla de sitios aparece muy por debajo del retardo del crawl.
  await expect(page.locator('.sitio-card').first()).toBeVisible({ timeout: 2000 })
})

test('Resumen renderiza sin esperar el crawl (no bloqueante)', async ({ page }) => {
  await mockGraph(page, {
    foldersByDrive: { 'drive-default': ['00.1 Contexto y Alcance'] },
    delayChildrenMs: DELAY
  })

  await page.goto('/resumen?e2e=1')

  // El avance global y la tabla por sitio se ven sin esperar el crawl.
  await expect(page.locator('.progress-global.destacado', { hasText: 'Avance de migracion de contenido' })).toBeVisible({ timeout: 2000 })
  await expect(page.getByText('Concentrador Documental SGSI')).toBeVisible({ timeout: 2000 })
})
