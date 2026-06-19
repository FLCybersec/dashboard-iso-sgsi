import { html } from 'htm/preact'
import { useState, useEffect } from 'preact/hooks'
import { route } from 'preact-router'
import { Cargando } from './Cargando.js'
import { loadStructure } from '../lib/structure-store.js'
import { loadMigrationState, peekMigrationState } from '../lib/migration-store.js'
import { loadSeguimiento, statsMigracionSitio, getApoyoSitio } from '../lib/seguimiento-store.js'

// "Sitios" (admin): lista de sitios -> arbol de cada uno. Migracion (derivada)
// sobre carpetas reales; clic para entrar al arbol. El conteo vivo (caro) se
// calcula en SEGUNDO PLANO: la grilla pinta de inmediato.
export function SitiosView() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [revalidando, setRevalidando] = useState(false)

  const build = (st, mig) => ({
    sitios: st.sitios.map((s) => {
      const estr = mig?.sitios?.find((x) => x.slug === s.slug)
      return {
        slug: s.slug,
        nombre: s.nombre,
        propietario: s.propietario,
        apoyo: getApoyoSitio(s.slug),
        mig: statsMigracionSitio(s, estr),
        existeSitio: estr ? !!estr.existeSitio : null
      }
    })
  })

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const st = await loadStructure()
        await loadSeguimiento(st)
        const cached = await peekMigrationState()
        setData(build(st, cached))
        setLoading(false)
        setRevalidando(true)
        loadMigrationState(st)
          .then((mig) => setData(build(st, mig)))
          .catch((e) => setError(e?.message || String(e)))
          .finally(() => setRevalidando(false))
      } catch (e) {
        setError(e?.message || String(e))
        setLoading(false)
      }
    })()
  }, [])

  if (loading && !data) return html`<${Cargando} titulo="Cargando sitios..." />`
  if (error && !data) return html`<div class="alert error">${error}</div>`

  return html`
    <div class="view-head">
      <h1>Sitios</h1>
      ${revalidando && html`<span class="muted">Calculando carpetas reales...</span>`}
    </div>
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
            Migracion ${s.mig.migradas}/${s.mig.total} carpetas${s.existeSitio === false ? ' · sitio no creado' : ''}
          </div>
          <div class="muted">${s.propietario || '—'}${s.apoyo ? ` · apoyo: ${s.apoyo}` : ''}</div>
        </div>`
      )}
    </div>
  `
}
