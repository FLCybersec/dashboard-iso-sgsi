import { html } from 'htm/preact'
import { useState, useEffect, useCallback } from 'preact/hooks'
import { route } from 'preact-router'
import { loadStructure } from '../lib/structure-store.js'
import {
  loadSeguimiento,
  statsMigracionPorPersona,
  updateNodo,
  getApoyoSitio
} from '../lib/seguimiento-store.js'
import { Avatar } from './Avatar.js'
import { SelectorMigracion } from './SelectorMigracion.js'

// "Por usuario" (vista principal de seguimiento): TODAS las personas con tareas
// de migracion (quien migra), con foto, avance, apoyo de sus sitios y ultima
// actualizacion. El estado de cada carpeta se edita aqui mismo.
export function UsuariosView({ embedded = false } = {}) {
  const [structure, setStructure] = useState(null)
  const [personas, setPersonas] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const recompute = useCallback((st) => setPersonas(statsMigracionPorPersona(st)), [])

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const st = await loadStructure()
        setStructure(st)
        await loadSeguimiento(st)
        recompute(st)
      } catch (e) {
        setError(e?.message || String(e))
      } finally {
        setLoading(false)
      }
    })()
  }, [recompute])

  const onCambiar = useCallback(
    async (key, estado) => {
      await updateNodo(structure, { key, migracionEstado: estado })
      recompute(structure)
    },
    [structure, recompute]
  )

  if (loading) return html`<div class="loading">Cargando avance por persona...</div>`
  if (error) return html`<div class="alert error">${error}</div>`

  return html`
    ${!embedded && html`<div class="view-head"><h1>Migracion por usuario</h1></div>`}

    ${personas.length === 0
      ? html`<div class="alert info">
          Aun nadie tiene carpetas asignadas como "quien migra". Entra a un sitio y
          asigna quien migra cada carpeta; las personas con tareas apareceran aqui.
        </div>`
      : personas.map((p) => html`<${PersonaCard} key=${p.nombre} persona=${p} onCambiar=${onCambiar} />`)}
  `
}

function PersonaCard({ persona, onCambiar }) {
  const [abierto, setAbierto] = useState(false)
  const porSitio = agruparPorSitio(persona.carpetas)
  const apoyos = [...new Set(porSitio.map((g) => getApoyoSitio(g.slug)).filter(Boolean))]

  return html`
    <div class="card usuario">
      <div class="usuario-head" onClick=${() => setAbierto(!abierto)}>
        <div class="usuario-id">
          <${Avatar} nombre=${persona.nombre} upn=${persona.upn} size=${40} />
          <div>
            <strong>${persona.nombre}</strong>
            <div class="muted">
              ${persona.migradas}/${persona.total} migradas · ${persona.pendientes} pend.
              ${persona.ultima ? ` · ultima ${persona.ultima.slice(0, 10)}` : ''}
              ${apoyos.length ? ` · apoyo: ${apoyos.join(', ')}` : ''}
            </div>
          </div>
        </div>
        <div class="usuario-pct">
          <div class="bar bar-sm"><div class="bar-fill alt" style=${`width:${persona.pct}%`}></div></div>
          <span class="num-sm">${persona.pct}%</span>
          <span class="muted">${abierto ? '▾' : '▸'}</span>
        </div>
      </div>

      ${abierto &&
      porSitio.map(
        (g) => html`<div class="usuario-bloque">
          <div class="muted usuario-sitio">
            <a class="site-link" href=${`/sitio/${g.slug}`} onClick=${(e) => (e.preventDefault(), route(`/sitio/${g.slug}`))}>${g.sitioNombre}</a>
          </div>
          ${g.carpetas.map(
            (c) => html`<div class="usuario-item" key=${c.key}>
              <span class="usuario-ruta"><code>${c.ruta}</code></span>
              <${SelectorMigracion} valor=${c.estado} onCambio=${(v) => onCambiar(c.key, v)} />
            </div>`
          )}
        </div>`
      )}
    </div>
  `
}

function agruparPorSitio(carpetas) {
  const mapa = new Map()
  for (const c of carpetas) {
    if (!mapa.has(c.slug)) mapa.set(c.slug, { slug: c.slug, sitioNombre: c.sitioNombre, carpetas: [] })
    mapa.get(c.slug).carpetas.push(c)
  }
  return [...mapa.values()]
}
