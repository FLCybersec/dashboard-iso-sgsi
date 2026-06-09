import { html } from 'htm/preact'
import { useState, useEffect } from 'preact/hooks'
import { loadStructure } from '../lib/structure-store.js'
import { Cargando } from './Cargando.js'
import { loadMigrationState } from '../lib/migration-store.js'
import {
  loadSeguimiento,
  getSeguimiento,
  getPendientes,
  statsMigracionGlobal
} from '../lib/seguimiento-store.js'
import { route } from 'preact-router'
import { exportEvidencia, exportCambiosCSV, exportSolicitudesAprobadas } from '../lib/exporter.js'

// Vista Evidencia/Export (Tanda 5): genera el libro Excel de evidencia.
export function EvidenciaView() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [done, setDone] = useState(null)

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const structure = await loadStructure()
        const mig = await loadMigrationState(structure)
        await loadSeguimiento(structure)
        setData({ structure, mig, seg: getSeguimiento() })
      } catch (e) {
        setError(e?.message || String(e))
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  async function exportar() {
    setExporting(true)
    setError(null)
    setDone(null)
    try {
      const nombre = await exportEvidencia(data)
      setDone(`Evidencia generada: ${nombre}`)
    } catch (e) {
      setError(e?.message || String(e))
    } finally {
      setExporting(false)
    }
  }

  function exportarCSV() {
    setError(null)
    setDone(null)
    try {
      const { nombre, total } = exportCambiosCSV(data)
      setDone(
        total === 0
          ? 'No hay cambios de estructura para exportar.'
          : `CSV generado: ${nombre} (${total} cambio(s))`
      )
    } catch (e) {
      setError(e?.message || String(e))
    }
  }

  function exportarSolicitudes() {
    setError(null)
    setDone(null)
    try {
      const { total } = exportSolicitudesAprobadas()
      setDone(
        total === 0
          ? 'No hay solicitudes APROBADAS para exportar. Apruebalas primero en la vista del sitio.'
          : `Solicitudes aprobadas exportadas (CSV + JSON): ${total} elemento(s).`
      )
    } catch (e) {
      setError(e?.message || String(e))
    }
  }

  return html`
    <div class="view-head"><h1>Evidencia / Export</h1></div>

    ${error && html`<div class="alert error">${error}</div>`}
    ${loading && html`<${Cargando} titulo="Preparando datos..." />`}

    ${!loading &&
    data &&
    html`
      <div class="alert info">
        Genera un libro Excel (.xlsx) con el estado completo para auditoria:
        Resumen por sitio, Carpetas con estado efectivo, Historial de cambios,
        Pendientes y Checklist de fases.
      </div>

      <div class="cards">
        <div class="card">
          <div class="num">${statsMigracionGlobal(data.structure).pct}%</div>
          <div class="lbl">Migracion global</div>
        </div>
        <div class="card card-sec">
          <div class="num sec">${data.mig.pctGlobal}%</div>
          <div class="lbl">Estructura (carpetas creadas)</div>
        </div>
        <div class="card">
          <div class="num">${Object.keys(data.seg?.nodos || {}).length}</div>
          <div class="lbl">Carpetas con estado puesto a mano</div>
        </div>
        <div class="card">
          <div class="num">${getPendientes().length}</div>
          <div class="lbl">Pendientes</div>
        </div>
      </div>

      <div class="export-actions">
        <button class="btn" onClick=${exportar} disabled=${exporting} data-testid="export-btn">
          ${exporting ? 'Generando...' : 'Exportar evidencia a Excel'}
        </button>
        <button
          class="btn secondary dark-on-light"
          onClick=${exportarCSV}
          disabled=${exporting}
          data-testid="export-pnp-btn"
        >
          Exportar cambios de estructura (CSV para PnP)
        </button>
        <button
          class="btn"
          onClick=${exportarSolicitudes}
          disabled=${exporting}
          data-testid="export-solicitudes-btn"
        >
          Exportar solicitudes aprobadas (CSV + JSON)
        </button>
        <button class="btn secondary dark-on-light" onClick=${() => route('/ejecutivo')}>
          Resumen ejecutivo (imprimible)
        </button>
      </div>
      ${done && html`<div class="nodo-status ok" style="margin-top:10px">${done}</div>`}
    `}
  `
}
