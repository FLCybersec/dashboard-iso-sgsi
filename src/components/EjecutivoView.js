import { html } from 'htm/preact'
import { useState, useEffect } from 'preact/hooks'
import { loadStructure } from '../lib/structure-store.js'
import { Cargando } from './Cargando.js'
import { loadMigrationState } from '../lib/migration-store.js'
import {
  loadSeguimiento,
  statsMigracionGlobal,
  statsMigracionSitio,
  requiereAtencion
} from '../lib/seguimiento-store.js'

// Resumen ejecutivo de 1 pagina para Direccion (imprimible / PDF).
export function EjecutivoView() {
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
        const aten = requiereAtencion(st, mig)
        setData({
          global: statsMigracionGlobal(st, mig),
          sitios: st.sitios.map((s) => ({ nombre: s.nombre, ...statsMigracionSitio(s, mig.sitios.find((x) => x.slug === s.slug)) })),
          atencion:
            aten.sinQuien.length + aten.restringidasVacias.length + aten.bloqueadas.length +
            aten.sitiosEstancados.length + aten.huerfanos.length,
          sitiosEstancados: aten.sitiosEstancados
        })
      } catch (e) {
        setError(e?.message || String(e))
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  if (loading) return html`<${Cargando} titulo="Preparando resumen..." />`
  if (error) return html`<div class="alert error">${error}</div>`

  const fecha = fechaHoy()

  return html`
    <div class="view-head no-print">
      <h1>Resumen ejecutivo</h1>
      <button class="btn" onClick=${() => window.print()}>Imprimir / PDF</button>
    </div>

    <div class="ejecutivo">
      <div class="ej-cab">
        <img class="ej-logo" src="/logos/logo_jma_cybersec_horizontal_color.png" alt="JMA CyberSec" />
        <div class="ej-titulo">
          <strong>Migracion documental ISO 27001 — SGSI</strong>
          <div class="muted">Avance de migracion de contenido · ${fecha}</div>
        </div>
      </div>

      <div class="ej-global">
        <div class="ej-pct">${data.global.pct}%</div>
        <div>
          <div class="bar bar-lg"><div class="bar-fill alt" style=${`width:${data.global.pct}%`}></div></div>
          <div class="muted">${data.global.migradas} de ${data.global.total} carpetas migradas · ${data.atencion} elemento(s) requieren atencion</div>
        </div>
      </div>

      <h2>Avance por area</h2>
      <table class="tabla">
        <thead><tr><th>Area</th><th>Migradas</th><th>%</th></tr></thead>
        <tbody>
          ${data.sitios.map(
            (s) => html`<tr key=${s.nombre}><td>${s.nombre}</td><td>${s.migradas}/${s.total}</td><td>${s.pct}%</td></tr>`
          )}
        </tbody>
      </table>

      ${data.sitiosEstancados.length > 0 &&
      html`<h2>Areas que requieren atencion</h2>
        <ul>
          ${data.sitiosEstancados.map((x) => html`<li>${x.sitio} — ${x.pct}% (sin avance desde ${x.ultima.slice(0, 10)})</li>`)}
        </ul>`}

      <div class="ej-pie muted">JMA CyberSec · Documento interno · Generado el ${fecha}</div>
    </div>
  `
}

function fechaHoy() {
  try {
    return new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
  } catch {
    return ''
  }
}
