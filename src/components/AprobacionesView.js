import { html } from 'htm/preact'
import { useState, useEffect, useCallback } from 'preact/hooks'
import { route } from 'preact-router'
import { loadStructure } from '../lib/structure-store.js'
import {
  loadSeguimiento,
  getCambiosEstructura,
  setCambioEstado,
  getSolicitudesPermiso,
  setSolicitudPermisoEstado
} from '../lib/seguimiento-store.js'

// Bandeja central de aprobaciones: concentra TODAS las solicitudes pendientes
// (cambios de estructura + permisos) de TODOS los sitios en un solo lugar, para
// que el admin no tenga que entrar sitio por sitio. El dashboard NO ejecuta los
// cambios: solo registra y deja la cola lista para PnP (spec; CLAUDE.md).
//
// Flujo de estados (igual para carpetas y permisos):
//   propuesto -> Aprobar -> aprobado -> Aplicado -> aplicado
//   (en cualquier momento se puede Descartar)
// Solo lo "aprobado" entra al export para PnP (Evidencia).
const ABIERTOS = ['propuesto', 'aprobado']

function tagClase(estado) {
  if (estado === 'aplicado') return 'ok'
  if (estado === 'descartado') return 'pend'
  return 'prog'
}

export function AprobacionesView() {
  const [structure, setStructure] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [, setTick] = useState(0)
  const rerender = () => setTick((t) => t + 1)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const st = await loadStructure()
      await loadSeguimiento(st)
      setStructure(st)
    } catch (e) {
      setError(e?.message || String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  async function run(fn) {
    setBusy(true)
    setError(null)
    try {
      await fn()
      rerender()
    } catch (e) {
      setError(e?.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  if (loading) return html`<div class="loading">Cargando aprobaciones...</div>`

  const nombreSitio = (slug) =>
    structure?.sitios.find((s) => s.slug === slug)?.nombre || slug || '—'

  const carpetas = getCambiosEstructura().filter((c) => ABIERTOS.includes(c.estado))
  const permisos = getSolicitudesPermiso().filter((p) => ABIERTOS.includes(p.estado))

  const porAprobar =
    carpetas.filter((c) => c.estado === 'propuesto').length +
    permisos.filter((p) => p.estado === 'propuesto').length
  const porAplicar =
    carpetas.filter((c) => c.estado === 'aprobado').length +
    permisos.filter((p) => p.estado === 'aprobado').length

  const accionesEstado = (estado, onAprobar, onAplicar, onDescartar) => html`
    ${estado === 'propuesto' &&
    html`<button class="btn secondary dark-on-light" disabled=${busy} onClick=${onAprobar}>Aprobar</button>`}
    <button class="btn secondary dark-on-light" disabled=${busy} onClick=${onAplicar}>Aplicado</button>
    <button class="btn secondary dark-on-light" disabled=${busy} onClick=${onDescartar}>Descartar</button>
  `

  return html`
    <div class="view-head">
      <div>
        <h1>Aprobaciones</h1>
        <div class="muted">
          Todas las solicitudes pendientes de los sitios, en un solo lugar. El
          dashboard solo registra: la creacion de carpetas y el cambio de permisos
          reales los ejecuta el equipo con PnP.
        </div>
      </div>
      <div class="sitio-metricas">
        <div class="card" style="min-width:150px">
          <div class="num">${porAprobar}</div>
          <div class="lbl">Pendientes de aprobar</div>
        </div>
        <div class="card card-sec" style="min-width:150px">
          <div class="num sec">${porAplicar}</div>
          <div class="lbl">Aprobadas, por aplicar</div>
        </div>
      </div>
    </div>

    ${error && html`<div class="alert error">${error}</div>`}

    <h2 style="margin-top:16px">Carpetas (cambios de estructura)</h2>
    ${carpetas.length === 0
      ? html`<div class="muted">No hay solicitudes de carpetas pendientes.</div>`
      : html`<table class="tabla">
        <thead>
          <tr><th>Sitio</th><th>Tipo</th><th>Ruta</th><th>Clasif.</th><th>Solicita</th><th>Estado</th><th></th></tr>
        </thead>
        <tbody>
          ${carpetas.map(
            (c) => html`<tr key=${c.id}>
              <td>
                <a class="back-link" href=${`/sitio/${c.slug}`} onClick=${(e) => (e.preventDefault(), route(`/sitio/${c.slug}`))}>${nombreSitio(c.slug)}</a>
              </td>
              <td>${c.tipo === 'crear' ? 'Crear' : 'Sobrante'}</td>
              <td><code>${c.ruta}</code></td>
              <td>${c.clasificacion || '—'}</td>
              <td>${c.creadoPor || '—'}</td>
              <td><span class=${`estado-tag ${tagClase(c.estado)}`}>${c.estado}</span></td>
              <td>
                ${accionesEstado(
                  c.estado,
                  () => run(() => setCambioEstado(structure, c.id, 'aprobado')),
                  () => run(() => setCambioEstado(structure, c.id, 'aplicado')),
                  () => run(() => setCambioEstado(structure, c.id, 'descartado'))
                )}
              </td>
            </tr>`
          )}
        </tbody>
      </table>`}

    <h2 style="margin-top:28px">Permisos (accesos a sitios)</h2>
    ${permisos.length === 0
      ? html`<div class="muted">No hay solicitudes de permisos pendientes.</div>`
      : html`<table class="tabla">
        <thead>
          <tr><th>Sitio</th><th>Accion</th><th>Persona</th><th>Rol</th><th>Solicita</th><th>Estado</th><th></th></tr>
        </thead>
        <tbody>
          ${permisos.map(
            (p) => html`<tr key=${p.id}>
              <td>
                <a class="back-link" href=${`/sitio/${p.slug}`} onClick=${(e) => (e.preventDefault(), route(`/sitio/${p.slug}`))}>${nombreSitio(p.slug)}</a>
              </td>
              <td>${p.tipo === 'agregar' ? 'Agregar' : 'Quitar'}</td>
              <td>${p.persona}</td>
              <td>${p.rol}</td>
              <td>${p.creadoPor || '—'}</td>
              <td><span class=${`estado-tag ${tagClase(p.estado)}`}>${p.estado}</span></td>
              <td>
                ${accionesEstado(
                  p.estado,
                  () => run(() => setSolicitudPermisoEstado(structure, p.id, 'aprobado')),
                  () => run(() => setSolicitudPermisoEstado(structure, p.id, 'aplicado')),
                  () => run(() => setSolicitudPermisoEstado(structure, p.id, 'descartado'))
                )}
              </td>
            </tr>`
          )}
        </tbody>
      </table>`}

    <div class="muted" style="margin-top:24px">
      Tras aprobar, exporta la cola desde <strong>Evidencia</strong> para entregarla a PnP.
    </div>
  `
}
