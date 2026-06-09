import { defineConfig, devices } from '@playwright/test'

// Tests E2E del dashboard. Levantan el dev server de Vite y usan el modo de
// pruebas (?e2e=1) para evitar el login interactivo de Microsoft; las llamadas
// a Graph se interceptan con mocks (tests/e2e/_helpers/graph-mock.js).
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: true,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    trace: 'on-first-retry'
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60_000
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
})
