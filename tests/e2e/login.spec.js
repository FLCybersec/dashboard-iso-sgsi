import { test, expect } from '@playwright/test'

// Login: sin modo E2E, la app debe mostrar la pantalla de login con el boton
// habilitado (Client ID ya configurado) y la marca JMA.
test('muestra la pantalla de login con boton habilitado', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Dashboard de Migracion/i })).toBeVisible()
  const btn = page.getByRole('button', { name: /Iniciar sesion con Microsoft/i })
  await expect(btn).toBeVisible()
  await expect(btn).toBeEnabled()
  // El logo de marca debe estar presente.
  await expect(page.locator('img.login-logo')).toBeVisible()
})
