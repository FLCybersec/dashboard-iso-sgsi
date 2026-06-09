import { html } from 'htm/preact'
import { useState, useEffect } from 'preact/hooks'
import { route } from 'preact-router'
import { Cargando } from './Cargando.js'
import { loadStructure } from '../lib/structure-store.js'
import { loadMigrationState } from '../lib/migration-store.js'
import { loadSeguimiento, statsMigracionSitio, getApoyoSitio } from '../lib/seguimiento-store.js'

// "Sitios" (admin): lista de sitios -> arbol de cada uno. Migracion (derivada) y
// estructura por sitio; clic para entrar al arbol.
export function SitiosView() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const st = await loadStructure()
        const mig = await loadMigrationState(st)
        await loadSeguimiento(st)
        setData({
          sitios: st.sitios.map((s) => ({
            slug: s.slug,
            nombre: s.nombre,
            propietario: s.propietario,
            apoyo: getApoyoSitio(s.slug),
            mig: statsMigracionSitio(s),
            estr: mig.sitios.find((x) => x.slug === s.slug)
          }))
        })
      } catch (e) {
        setError(e?.message || String(e))
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  if (loading) return html`<${Cargando} titulo="Cargando sitios..." />`
  if (error) return html`<div class="alert error">${error}</div>`

  return html`
    <div class="view-head"><h1>Sitios</h1></div>
    <div class="sitios-grid">
      ${data.sitios.map(
        (s) => html`<div
          class="card sitio-card clickable"
          key=${s.slug}
          onClick=${() => route(`/sitio/${s.slug}`)}
        >
          <div class="sitio-card-top">
            <strong>${s.nombre}</strong>
            <span class="num-sm">${s.mig.pct}%</span>
          </div>
          <div class="bar bar-sm"><div class="bar-fill alt" style=${`width:${s.mig.pct}%`}></div></div>
          <div class="muted">
            Migracion ${s.mig.migradas}/${s.mig.total} · Estructura ${s.estr ? `${s.estr.pct}%` : '—'}
          </div>
          <div class="muted">${s.propietario || '—'}${s.apoyo ? ` · apoyo: ${s.apoyo}` : ''}</div>
        </div>`
      )}
    </div>
  `
}
