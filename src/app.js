import { html } from 'htm/preact'
import { useState, useCallback } from 'preact/hooks'
import { Router, getCurrentUrl } from 'preact-router'
import { evaluateSession, login, logout } from './auth/auth-provider.js'
import { isClientIdConfigured } from './auth/msal-config.js'
import { LoginScreen } from './components/LoginScreen.js'
import { Sidebar } from './components/Sidebar.js'
import { HomeView } from './components/HomeView.js'
import { SitioView } from './components/SitioView.js'
import { SitiosView } from './components/SitiosView.js'
import { EvidenciaView } from './components/EvidenciaView.js'
import { PersonasView } from './components/PersonasView.js'
import { MiTrabajoView } from './components/MiTrabajoView.js'
import { EjecutivoView } from './components/EjecutivoView.js'
import { AprobacionesView } from './components/AprobacionesView.js'

// Componente raiz: sesion + login, y shell con barra lateral + contenido.
// Navegacion concentrada en 5 entradas (Sidebar); rutas gateadas por rol.
export function App() {
  const [session, setSession] = useState(() => evaluateSession())
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [path, setPath] = useState(() => getCurrentUrl())

  const handleLogin = useCallback(async () => {
    setError(null)
    setBusy(true)
    try {
      setSession(await login())
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setBusy(false)
    }
  }, [])

  const handleLogout = useCallback(async () => {
    setBusy(true)
    try {
      await logout()
      setSession(evaluateSession())
    } finally {
      setBusy(false)
    }
  }, [])

  if (session.status !== 'ok') {
    return html`<${LoginScreen}
      session=${session}
      onLogin=${handleLogin}
      busy=${busy}
      error=${error}
      configured=${isClientIdConfigured()}
    />`
  }

  const admin = session.rol === 'admin'
  const observador = session.rol === 'observador'
  const verGlobal = admin || observador

  // Vistas globales: admin edita; observador (consultoria ISO) solo lee
  // (puedeEditar=false desactiva toda accion de escritura).
  const rutasGlobales = verGlobal
    ? [
        html`<${HomeView} path="/resumen" />`,
        html`<${PersonasView} path="/personas" />`,
        html`<${SitiosView} path="/sitios" />`,
        html`<${SitioView} path="/sitio/:slug" puedeEditar=${admin} />`,
        html`<${EvidenciaView} path="/evidencia" />`,
        html`<${EjecutivoView} path="/ejecutivo" />`
      ]
    : []
  // Aprobaciones es bandeja de gestion (escritura): solo admin.
  const rutasAdmin = admin ? [html`<${AprobacionesView} path="/aprobaciones" />`] : []

  // Landing: el observador no tiene "Mi trabajo"; entra directo al Resumen.
  const inicio = observador ? html`<${HomeView} path="/" />` : html`<${MiTrabajoView} path="/" />`
  const fallback = observador ? html`<${HomeView} default />` : html`<${MiTrabajoView} default />`

  return html`
    <div class="app-shell">
      <${Sidebar}
        rol=${session.rol}
        name=${session.name}
        email=${session.email}
        onLogout=${handleLogout}
        busy=${busy}
        path=${path}
      />
      <main class="main">
        <${Router} onChange=${(e) => setPath(e.url)}>
          ${inicio}
          ${rutasGlobales}
          ${rutasAdmin}
          ${fallback}
        <//>
      </main>
    </div>
  `
}
