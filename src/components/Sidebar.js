import { html } from 'htm/preact'
import { route } from 'preact-router'
import { Avatar } from './Avatar.js'

// Barra lateral de navegacion (escala mejor que la barra superior). 5 entradas
// para admin; el usuario normal solo ve "Mi trabajo". La cuenta va al pie.
const ENTRADAS = [
  { path: '/', label: 'Mi trabajo', admin: false },
  { path: '/resumen', label: 'Resumen', admin: true },
  { path: '/personas', label: 'Personas', admin: true },
  { path: '/sitios', label: 'Sitios', admin: true },
  { path: '/evidencia', label: 'Evidencia', admin: true }
]

function activa(path, actual) {
  if (path === '/') return actual === '/' || actual === ''
  return actual === path || actual.startsWith(path + '/') || (path === '/sitios' && actual.startsWith('/sitio/'))
}

export function Sidebar({ rol, name, email, onLogout, busy, path }) {
  const admin = rol === 'admin'
  const entradas = ENTRADAS.filter((e) => admin || !e.admin)

  return html`
    <aside class="sidebar">
      <div class="sidebar-brand clickable" onClick=${() => route('/')} title="Ir a Mi trabajo">
        <img src="/logos/logo_jma_cybersec_horizontal_color.png" alt="JMA CyberSec" />
        <span class="brand-sub">SGSI · Migracion ISO 27001</span>
      </div>

      <nav class="side-nav">
        ${entradas.map(
          (e) => html`<a
            class=${`side-link ${activa(e.path, path) ? 'on' : ''}`}
            href=${e.path}
            onClick=${(ev) => (ev.preventDefault(), route(e.path))}
            >${e.label}</a
          >`
        )}
      </nav>

      <div class="sidebar-cuenta">
        <div class="cuenta-top">
          <${Avatar} me=${true} nombre=${name} size=${34} />
          <div class="who">
            <span class="who-nombre">${name}</span>
            <small>${admin ? html`<span class="rol-badge">admin</span> ` : ''}${email}</small>
          </div>
        </div>
        <button class="btn secondary dark-on-light btn-sm cuenta-salir" onClick=${onLogout} disabled=${busy}>Salir</button>
      </div>
    </aside>
  `
}
