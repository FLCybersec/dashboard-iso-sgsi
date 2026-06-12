import { html } from 'htm/preact'
import { useState } from 'preact/hooks'
import { route } from 'preact-router'
import { Avatar } from './Avatar.js'

// Barra lateral de navegacion (escala mejor que la barra superior). El admin ve
// todas las entradas; el observador (consultoria ISO) ve las globales en solo
// lectura, sin "Mi trabajo" ni "Aprobaciones"; el usuario normal solo ve "Mi
// trabajo". La cuenta va al pie.
//
// En movil (<=760px, CSS) la barra se vuelve cabecera superior: el menu y la
// cuenta se pliegan tras el boton hamburguesa y se cierran al navegar.
const ENTRADAS = [
  { path: '/', label: 'Mi trabajo', roles: ['admin', 'usuario'] },
  { path: '/resumen', label: 'Resumen', roles: ['admin', 'observador'] },
  { path: '/aprobaciones', label: 'Aprobaciones', roles: ['admin'] },
  { path: '/personas', label: 'Personas', roles: ['admin', 'observador'] },
  { path: '/sitios', label: 'Sitios', roles: ['admin', 'observador'] },
  { path: '/evidencia', label: 'Evidencia', roles: ['admin', 'observador'] }
]

// Etiqueta del badge de rol bajo el nombre (null = sin badge).
const BADGE = { admin: 'admin', observador: 'consultor · solo lectura' }

function activa(path, actual) {
  if (path === '/') return actual === '/' || actual === ''
  return actual === path || actual.startsWith(path + '/') || (path === '/sitios' && actual.startsWith('/sitio/'))
}

export function Sidebar({ rol, name, email, onLogout, busy, path }) {
  const entradas = ENTRADAS.filter((e) => e.roles.includes(rol))
  const badge = BADGE[rol] || null
  const [abierto, setAbierto] = useState(false)
  const ir = (p) => {
    setAbierto(false)
    route(p)
  }

  return html`
    <aside class=${`sidebar ${abierto ? 'abierta' : ''}`}>
      <div class="sidebar-brand">
        <div class="brand-logo clickable" onClick=${() => ir('/')} title="Inicio">
          <img src="/logos/logo_jma_cybersec_horizontal_color.png" alt="JMA CyberSec" />
          <span class="brand-sub">SGSI · Migracion ISO 27001</span>
        </div>
        <button
          class="nav-burger"
          aria-label=${abierto ? 'Cerrar menu' : 'Abrir menu'}
          aria-expanded=${abierto}
          onClick=${() => setAbierto(!abierto)}
        >☰</button>
      </div>

      <nav class="side-nav">
        ${entradas.map(
          (e) => html`<a
            class=${`side-link ${activa(e.path, path) ? 'on' : ''}`}
            href=${e.path}
            onClick=${(ev) => (ev.preventDefault(), ir(e.path))}
            >${e.label}</a
          >`
        )}
      </nav>

      <div class="sidebar-cuenta">
        <div class="cuenta-top">
          <${Avatar} me=${true} nombre=${name} size=${34} />
          <div class="who">
            <span class="who-nombre">${name}</span>
            <small>${badge ? html`<span class="rol-badge">${badge}</span> ` : ''}${email}</small>
          </div>
        </div>
        <button class="btn secondary dark-on-light btn-sm cuenta-salir" onClick=${onLogout} disabled=${busy}>Salir</button>
      </div>
    </aside>
  `
}
