import { html } from 'htm/preact'
import { useState, useEffect, useCallback } from 'preact/hooks'
import { route } from 'preact-router'
import { Cargando } from './Cargando.js'
import { loadStructure } from '../lib/structure-store.js'
import { loadMigrationState, peekMigrationState } from '../lib/migration-store.js'
import {
  loadSeguimiento,
  statsMigracionGlobal,
  statsMigracionSitio,
  statsMigracionPorPersona,
  requiereAtencion,
  actividadReciente
} from '../lib/seguimiento-store.js'
import { Avatar } from './Avatar.js'
import { BotonActualizar } from './BotonActualizar.js'

// Vista Resumen: avance de MIGRACION (global y por persona) sobre la estructura
// REAL de SharePoint (carpetas vivas como denominador; arbol en vivo).
export function HomeView() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [revalidando, setRevalidando] = useState(false)

  const build = (st, mig) => ({
    st,
    mig,
    migGlobal: statsMigracionGlobal(st, mig),
    personas: statsMigracionPorPersona(st),
    atencion: requiereAtencion(st, mig),
    actividad: actividadReciente(st, 12)
  })

  // Render NO bloqueante: estructura + seguimiento (rapido) + inventario cacheado
  // (peek). El recorrido vivo de los 12 sitios corre en SEGUNDO PLANO y refresca
  // las metricas al terminar (stale-while-revalidate); nunca bloquea el render.
  const run = useCallback(async (force) => {
    setLoading(true)
    setError(null)
    try {
      const st = await loadStructure()
      await loadSeguimiento(st, { force })
      const cached = force ? null : await peekMigrationState()
      setData(build(st, cached))
      setLoading(false)
      setRevalidando(true)
      loadMigrationState(st, { force })
        .then((mig) => setData(build(st, mig)))
        .catch((e) => setError(e?.message || String(e)))
        .finally(() => setRevalidando(false))
    } catch (e) {
      setError(e?.message || String(e))
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    run(false)
  }, [run])

  const tsLabel = data?.mig?.fetchedAt
    ? `Inventario: ${formatTs(data.mig.fetchedAt)}${data.mig.fromCache ? ' (cache)' : ''}`
    : 'Inventario: calculando...'

  return html`
    <div class="view-head">
      <h1>Resumen</h1>
      <div class="view-head-actions">
        ${data && html`<span class="muted">${revalidando ? 'Actualizando inventario...' : tsLabel}</span>`}
        <${BotonActualizar} refrescar=${() => run(true)} />
      </div>
    </div>

    ${error && html`<div class="alert error">No se pudo leer el estado en SharePoint: ${error}</div>`}
    ${loading && !data && html`<${Cargando} />`}
    ${data && html`<${Resumen} data=${data} />`}
  `
}

function Resumen({ data }) {
  const { st, mig, migGlobal, personas, atencion, actividad } = data
  const totalAtencion =
    atencion.sinQuien.length + atencion.restringidasVacias.length + atencion.bloqueadas.length +
    atencion.sitiosEstancados.length + atencion.huerfanos.length
  return html`
    <div class="progress-global destacado">
      <div class="progress-global-top">
        <strong>Avance de migracion de contenido</strong>
        <span>${migGlobal.pct}%</span>
      </div>
      <div class="bar bar-lg"><div class="bar-fill alt" style=${`width:${migGlobal.pct}%`}></div></div>
      <div class="muted">${migGlobal.migradas} de ${migGlobal.total} carpetas reales migradas${mig ? ` · ${mig.totalCarpetas} carpetas en ${mig.sitiosCreados}/${mig.totalSitios} sitios (lectura en vivo)` : ' · inventario calculandose...'}</div>
    </div>

    <h2 style="margin-top:24px">Avance por persona</h2>
    ${personas.length === 0
      ? html`<div class="alert info">Aun nadie tiene carpetas asignadas. Asigna "quien migra" en un sitio para empezar.</div>`
      : ''}
    <div class="personas-mini">
      ${personas.map(
        (p) => html`
          <div class="persona-mini" onClick=${() => route('/personas')}>
            <div class="persona-mini-top">
              <span class="persona-mini-id"><${Avatar} nombre=${p.nombre} upn=${p.upn} size=${28} /> ${p.nombre}</span>
              <span class="num-sm">${p.pct}%</span>
            </div>
            <div class="bar bar-sm"><div class="bar-fill alt" style=${`width:${p.pct}%`}></div></div>
            <div class="muted">${p.migradas}/${p.total} carpetas${p.pendientes ? ` · ${p.pendientes} pend.` : ''}</div>
          </div>
        `
      )}
    </div>

    <h2 style="margin-top:24px">Migracion por sitio</h2>
    <table class="tabla">
      <thead>
        <tr><th>Sitio</th><th>Migracion</th><th>%</th><th class="col-sec">Carpetas reales</th></tr>
      </thead>
      <tbody>
        ${st.sitios.map((s) => {
          const estr = mig?.sitios?.find((x) => x.slug === s.slug)
          const m = statsMigracionSitio(s, estr)
          return html`
            <tr key=${s.slug}>
              <td>
                <a class="site-link" href=${`/sitio/${s.slug}`} onClick=${(e) => (e.preventDefault(), route(`/sitio/${s.slug}`))}>${s.nombre}</a>
                <div class="muted"><code>${s.slug}</code></div>
              </td>
              <td>
                <div class="bar bar-sm"><div class="bar-fill alt" style=${`width:${m.pct}%`}></div></div>
                <span class="muted">${m.migradas}/${m.total}</span>
              </td>
              <td>${m.pct}%</td>
              <td class="col-sec muted">
                ${estr ? (estr.existeSitio ? `${estr.totalCarpetas}` : 'sitio no creado') : '—'}
                ${estr?.warning && html`<span class="estado-tag err" title=${estr.warning}>sin lectura</span>`}
              </td>
            </tr>
          `
        })}
      </tbody>
    </table>

    <div class="paneles-2">
      <div class="card">
        <div class="fases-head"><strong>Requiere atencion</strong><span class="muted">${totalAtencion}</span></div>
        ${totalAtencion === 0
          ? html`<div class="muted">Nada pendiente de atencion.</div>`
          : html`<ul class="aten-resumen">
              ${atencion.sinQuien.length ? html`<li>${atencion.sinQuien.length} carpeta(s) sin quien migra</li>` : ''}
              ${atencion.restringidasVacias.length ? html`<li>${atencion.restringidasVacias.length} Restringida(s) sin migrar</li>` : ''}
              ${atencion.bloqueadas.length ? html`<li>${atencion.bloqueadas.length} bloqueada(s)</li>` : ''}
              ${atencion.sitiosEstancados.length ? html`<li>${atencion.sitiosEstancados.length} sitio(s) sin avance 7+ dias</li>` : ''}
              ${atencion.huerfanos.length ? html`<li>${atencion.huerfanos.length} con seguimiento sin carpeta viva (¿renombrada/borrada?)</li>` : ''}
            </ul>`}
      </div>
      <div class="card">
        <div class="fases-head"><strong>Actividad reciente</strong></div>
        ${actividad.length === 0
          ? html`<div class="muted">Sin cambios recientes.</div>`
          : html`<div class="feed-mini">
              ${actividad.map(
                (e, i) => html`<div class="feed-mini-item" key=${i}>
                  <span class="muted">${e.fecha?.slice(5, 10)}</span> ${e.por || 'Alguien'}
                  ${e.migracion ? html` → <span class="estado-tag prog">${e.migracion}</span>` : ''}
                  <span class="muted">${e.sitio}</span>
                </div>`
              )}
            </div>`}
      </div>
    </div>
  `
}

function formatTs(ts) {
  try {
    return new Date(ts).toLocaleString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return ''
  }
}
