import { html } from 'htm/preact'
import { useState, useEffect } from 'preact/hooks'
import { route } from 'preact-router'
import { Cargando } from './Cargando.js'
import { loadStructure } from '../lib/structure-store.js'
import { loadMigrationState, peekMigrationState } from '../lib/migration-store.js'
import { loadSeguimiento, statsMigracionPorApoyo } from '../lib/seguimiento-store.js'

// Vista "Por apoyo": para cada Apoyo SGSI (Carmen, Ezequiel, Chema), los sitios
// que acompaña y el avance de migracion de cada uno. Permite al equipo SGSI
// llevar el seguimiento del proceso.
export function ApoyoView({ embedded = false } = {}) {
  const [apoyos, setApoyos] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const st = await loadStructure()
        await loadSeguimiento(st)
        // Render inmediato con inventario cacheado; recorrido vivo en 2o plano.
        setApoyos(statsMigracionPorApoyo(st, await peekMigrationState()))
        loadMigrationState(st)
          .then((mig) => setApoyos(statsMigracionPorApoyo(st, mig)))
          .catch(() => {})
      } catch (e) {
        setError(e?.message || String(e))
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return html`
    ${!embedded && html`<div class="view-head"><h1>Por apoyo SGSI</h1></div>`}
    <p class="muted" style="margin-top:-4px">
      Seguimiento del equipo SGSI: que sitios acompaña cada apoyo y su avance.
    </p>

    ${error && html`<div class="alert error">${error}</div>`}
    ${loading && html`<${Cargando} titulo="Cargando apoyos..." />`}

    ${!loading &&
    apoyos &&
    apoyos.map(
      (a) => html`
        <div class="card usuario" key=${a.nombre}>
          <div class="usuario-head">
            <div>
              <strong>${a.nombre}</strong>
              <div class="muted">${a.sitios.length} sitio(s) · ${a.migradas}/${a.total} carpetas migradas</div>
            </div>
            <div class="usuario-pct">
              <div class="bar bar-sm"><div class="bar-fill alt" style=${`width:${a.pct}%`}></div></div>
              <span class="num-sm">${a.pct}%</span>
            </div>
          </div>

          ${a.sitios.length === 0
            ? html`<div class="muted usuario-bloque">Sin sitios asignados como apoyo.</div>`
            : html`<div class="usuario-bloque">
                ${a.sitios.map(
                  (s) => html`<div class="usuario-item" key=${s.slug}>
                    <a class="site-link usuario-ruta" href=${`/sitio/${s.slug}`} onClick=${(e) => (e.preventDefault(), route(`/sitio/${s.slug}`))}>${s.nombre}</a>
                    <div class="bar bar-sm"><div class="bar-fill alt" style=${`width:${s.pct}%`}></div></div>
                    <span class="muted">${s.migradas}/${s.total} · ${s.pct}%</span>
                  </div>`
                )}
              </div>`}
        </div>
      `
    )}
  `
}
