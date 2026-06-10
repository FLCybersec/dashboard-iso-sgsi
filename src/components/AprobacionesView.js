import { html } from 'htm/preact'
import { Fragment } from 'preact'
import { Cargando } from './Cargando.js'
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

// Bandeja central de aprobaciones: concentra TODAS las solicitudes (cambios de
// estructura + permisos) de TODOS los sitios en un solo lugar, para que el admin
// no tenga que entrar sitio por sitio. El dashboard NO ejecuta los cambios: solo
// registra y deja la cola lista para PnP (spec; CLAUDE.md).
//
// Ciclo de vida (en lenguaje llano, gestionado SIEMPRE a mano desde aqui):
//   Pendiente  -> Aprobar  -> Aprobada
//   Aprobada   -> "Creada/Aplicada" (cuando ya se hizo en la realidad)
//   (en cualquier momento) -> Descartada (si no procede)
// NO se autodetecta por nombre/ruta: el nombre final puede diferir del
// solicitado (podemos renombrar al crear), por eso pasar a Creada/Aplicada es
// manual. Al aprobar una carpeta nueva el "nombre final" (con su numeral) es
// OBLIGATORIO: es el momento en que el SGSI fija el nombre coherente; sin el no
// se puede aprobar. Solo lo "aprobado" entra al export para PnP (Evidencia).

// estado interno -> etiqueta llana. "aplicado" se llama "Creada" para carpetas
// nuevas y "Aplicada" para sobrantes y permisos.
function estadoLabel(estado, tipo) {
  if (estado === 'propuesto') return 'Pendiente'
  if (estado === 'aprobado') return 'Aprobada'
  if (estado === 'aplicado') return tipo === 'crear' ? 'Creada' : 'Aplicada'
  if (estado === 'descartado') return 'Descartada'
  return estado
}

function tagClase(estado) {
  if (estado === 'aplicado') return 'ok'
  if (estado === 'descartado') return 'pend'
  if (estado === 'aprobado') return 'na'
  return 'prog'
}

// Abiertas primero (Pendiente, Aprobada), luego cerradas (Creada/Aplicada, Descartada).
const ORDEN = { propuesto: 0, aprobado: 1, aplicado: 2, descartado: 3 }
function ordenar(arr) {
  return [...arr].sort((a, b) => (ORDEN[a.estado] ?? 9) - (ORDEN[b.estado] ?? 9))
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
      // Releer SIEMPRE de SharePoint: las solicitudes las crean OTRAS sesiones
      // (cada area escribe su propio archivo); con la cache en memoria de esta
      // sesion no aparecerian hasta recargar el navegador.
      await loadSeguimiento(st, { force: true })
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

  if (loading) return html`<${Cargando} titulo="Cargando aprobaciones..." />`

  const nombreSitio = (slug) =>
    structure?.sitios.find((s) => s.slug === slug)?.nombre || slug || '—'

  const carpetas = ordenar(getCambiosEstructura())
  const permisos = ordenar(getSolicitudesPermiso())

  const porAprobar =
    carpetas.filter((c) => c.estado === 'propuesto').length +
    permisos.filter((p) => p.estado === 'propuesto').length
  const porAplicar =
    carpetas.filter((c) => c.estado === 'aprobado').length +
    permisos.filter((p) => p.estado === 'aprobado').length

  const ctx = { structure, busy, run, nombreSitio }

  return html`
    <div class="view-head">
      <div>
        <h1>Aprobaciones</h1>
        <div class="muted">
          Todas las solicitudes de los sitios, en un solo lugar y con su ciclo de
          vida visible: <strong>Pendiente</strong> → <strong>Aprobada</strong> →
          <strong>Creada/Aplicada</strong> (o <strong>Descartada</strong>). El
          dashboard solo registra; la creacion de carpetas y el cambio de permisos
          reales los ejecuta el equipo con PnP, y se marcan aqui a mano cuando ya
          se hicieron.
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
      ? html`<div class="muted">No hay solicitudes de carpetas.</div>`
      : html`<table class="tabla">
        <thead>
          <tr><th>Sitio</th><th>Tipo</th><th>Ruta / nombre final</th><th>Clasif.</th><th>Solicita</th><th>Estado</th><th></th></tr>
        </thead>
        <tbody>
          ${carpetas.map((c) => html`<${FilaCarpeta} key=${c.id} c=${c} ctx=${ctx} />`)}
        </tbody>
      </table>`}

    <h2 style="margin-top:28px">Permisos (accesos a sitios)</h2>
    ${permisos.length === 0
      ? html`<div class="muted">No hay solicitudes de permisos.</div>`
      : html`<table class="tabla">
        <thead>
          <tr><th>Sitio</th><th>Accion</th><th>Persona</th><th>Rol</th><th>Solicita</th><th>Estado</th><th></th></tr>
        </thead>
        <tbody>
          ${permisos.map((p) => html`<${FilaPermiso} key=${p.id} p=${p} ctx=${ctx} />`)}
        </tbody>
      </table>`}

    <div class="muted" style="margin-top:24px">
      Tras aprobar, exporta la cola desde <strong>Evidencia</strong> para entregarla a PnP.
    </div>
  `
}

// Botones de transicion + formulario de aprobacion (nombre final + comentario).
// Devuelve el contenido de la celda de acciones; el formulario se muestra en una
// fila aparte (ver Fila*). `conNombreFinal` solo para carpetas nuevas (crear).
function Acciones({ item, tipo, ctx, aprobando, setAprobando, onAplicar, onDescartar }) {
  const { busy } = ctx
  if (item.estado === 'propuesto') {
    return html`
      <button class="btn secondary dark-on-light" disabled=${busy || aprobando} onClick=${() => setAprobando(true)}>Aprobar</button>
      <button class="btn secondary dark-on-light" disabled=${busy} onClick=${onDescartar}>Descartar</button>
    `
  }
  if (item.estado === 'aprobado') {
    return html`
      <button class="btn secondary dark-on-light" disabled=${busy} onClick=${onAplicar}>${tipo === 'crear' ? 'Marcar creada' : 'Marcar aplicada'}</button>
      <button class="btn secondary dark-on-light" disabled=${busy} onClick=${onDescartar}>Descartar</button>
    `
  }
  return html`<span class="muted">—</span>`
}

function FormAprobar({ ctx, colSpan, conNombreFinal, valorNombre, valorSolicitado, valorComentario, onConfirmar, onCancelar }) {
  const { busy } = ctx
  // Precargar con el nombre ya acordado si existe, o con el solicitado como base
  // editable. Asi el campo nunca arranca vacio (el boton queda habilitado) y el
  // SGSI solo confirma o ajusta el numeral. Sigue siendo obligatorio: si se borra,
  // no se puede aprobar.
  const [nombreFinal, setNombreFinal] = useState(valorNombre || valorSolicitado || '')
  const [comentario, setComentario] = useState(valorComentario || '')
  const faltaNombre = conNombreFinal && !nombreFinal.trim()
  return html`<tr class="aprobar-row">
    <td colSpan=${colSpan}>
      <div class="nodo-line2" data-testid="aprobar-form">
        ${conNombreFinal &&
        html`<label class="grow">
          Nombre final acordado (obligatorio, con su numeral; puede diferir del solicitado)
          <input type="text" value=${nombreFinal} placeholder=${valorSolicitado || ''} onInput=${(e) => setNombreFinal(e.target.value)} disabled=${busy} />
        </label>`}
        <label class="grow">
          Comentario
          <input type="text" value=${comentario} onInput=${(e) => setComentario(e.target.value)} disabled=${busy} />
        </label>
        <button class="btn" disabled=${busy || faltaNombre} title=${faltaNombre ? 'Fija el nombre final (con su numeral) para poder aprobar' : ''} onClick=${() => onConfirmar({ nombreFinal, comentario })}>Confirmar aprobacion</button>
        <button class="btn secondary dark-on-light" disabled=${busy} onClick=${onCancelar}>Cancelar</button>
      </div>
    </td>
  </tr>`
}

// Linea de metadatos de aprobacion (nombre final acordado + comentario).
function MetaAprobacion({ item, mostrarNombre }) {
  return html`
    ${mostrarNombre && item.nombreFinal && item.nombreFinal !== item.ruta &&
    html`<div class="muted">final acordado: <code>${item.nombreFinal}</code></div>`}
    ${item.comentario && html`<div class="muted">nota: ${item.comentario}</div>`}
  `
}

function FilaCarpeta({ c, ctx }) {
  const { structure, run, nombreSitio } = ctx
  const [aprobando, setAprobando] = useState(false)
  const conNombreFinal = c.tipo === 'crear'

  const confirmar = ({ nombreFinal, comentario }) =>
    run(async () => {
      await setCambioEstado(structure, c.id, 'aprobado', {
        nombreFinal: conNombreFinal ? nombreFinal : undefined,
        comentario
      })
      setAprobando(false)
    })

  return html`<${Fragment}>
    <tr>
      <td>
        <a class="back-link" href=${`/sitio/${c.slug}`} onClick=${(e) => (e.preventDefault(), route(`/sitio/${c.slug}`))}>${nombreSitio(c.slug)}</a>
      </td>
      <td>${c.tipo === 'crear' ? 'Crear' : 'Sobrante'}</td>
      <td>
        <code>${c.ruta}</code>
        <${MetaAprobacion} item=${c} mostrarNombre=${conNombreFinal} />
      </td>
      <td>${c.clasificacion || '—'}</td>
      <td>${c.creadoPor || '—'}</td>
      <td><span class=${`estado-tag ${tagClase(c.estado)}`}>${estadoLabel(c.estado, c.tipo)}</span></td>
      <td>
        <${Acciones}
          item=${c}
          tipo=${c.tipo}
          ctx=${ctx}
          aprobando=${aprobando}
          setAprobando=${setAprobando}
          onAplicar=${() => run(() => setCambioEstado(structure, c.id, 'aplicado'))}
          onDescartar=${() => run(() => setCambioEstado(structure, c.id, 'descartado'))}
        />
      </td>
    </tr>
    ${aprobando &&
    html`<${FormAprobar}
      ctx=${ctx}
      colSpan=${7}
      conNombreFinal=${conNombreFinal}
      valorNombre=${c.nombreFinal || ''}
      valorSolicitado=${c.ruta || ''}
      valorComentario=${c.comentario || ''}
      onConfirmar=${confirmar}
      onCancelar=${() => setAprobando(false)}
    />`}
  <//>`
}

function FilaPermiso({ p, ctx }) {
  const { structure, run, nombreSitio } = ctx
  const [aprobando, setAprobando] = useState(false)

  const confirmar = ({ comentario }) =>
    run(async () => {
      await setSolicitudPermisoEstado(structure, p.id, 'aprobado', { comentario })
      setAprobando(false)
    })

  return html`<${Fragment}>
    <tr>
      <td>
        <a class="back-link" href=${`/sitio/${p.slug}`} onClick=${(e) => (e.preventDefault(), route(`/sitio/${p.slug}`))}>${nombreSitio(p.slug)}</a>
      </td>
      <td>${p.tipo === 'agregar' ? 'Agregar' : 'Quitar'}</td>
      <td>
        ${p.persona}
        <${MetaAprobacion} item=${p} mostrarNombre=${false} />
      </td>
      <td>${p.rol}</td>
      <td>${p.creadoPor || '—'}</td>
      <td><span class=${`estado-tag ${tagClase(p.estado)}`}>${estadoLabel(p.estado, p.tipo)}</span></td>
      <td>
        <${Acciones}
          item=${p}
          tipo=${p.tipo}
          ctx=${ctx}
          aprobando=${aprobando}
          setAprobando=${setAprobando}
          onAplicar=${() => run(() => setSolicitudPermisoEstado(structure, p.id, 'aplicado'))}
          onDescartar=${() => run(() => setSolicitudPermisoEstado(structure, p.id, 'descartado'))}
        />
      </td>
    </tr>
    ${aprobando &&
    html`<${FormAprobar}
      ctx=${ctx}
      colSpan=${7}
      conNombreFinal=${false}
      valorNombre=""
      valorComentario=${p.comentario || ''}
      onConfirmar=${confirmar}
      onCancelar=${() => setAprobando(false)}
    />`}
  <//>`
}
