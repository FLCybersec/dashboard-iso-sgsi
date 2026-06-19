import { html } from 'htm/preact'
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
// solicitado, por eso pasar a Creada/Aplicada es manual. Aprobar SOLO cambia el
// estado (un clic, sin formulario): el nombre canonico (numeral, acentos,
// mayusculas) lo fija Cowork al generar el PnP y actualizar el maestro. Solo lo
// "aprobado" entra al export para PnP (Evidencia).
//
// Marcado OPTIMISTA: cada accion cambia el estado en memoria y la UI al
// instante; la escritura del seguimiento corre en segundo plano (cola por
// sitio, que ademas serializa acciones rapidas consecutivas). No se relee la
// estructura completa por Graph: el TTL de 2 min o el boton "Actualizar"
// reconcilian el arbol y las metricas. Si la escritura falla, se revierte el
// estado visible y se muestra el error.

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

const ABIERTOS = new Set(['propuesto', 'aprobado'])

export function AprobacionesView() {
  const [structure, setStructure] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [, setTick] = useState(0)
  const rerender = () => setTick((t) => t + 1)
  // Seleccion para acciones por lote (ids), una por tabla.
  const [selCarpetas, setSelCarpetas] = useState(() => new Set())
  const [selPermisos, setSelPermisos] = useState(() => new Set())

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

  // Optimista: la UI cambia al instante; la escritura corre en segundo plano.
  // En error se revierte sobre la copia vigente del store (la escritura pudo
  // haber refundido el archivo con el servidor y reemplazado el objeto).
  function aplicarOptimista(item, estado, persistir) {
    const prev = item.estado
    item.estado = estado
    setError(null)
    rerender()
    persistir().then(
      // Al confirmar tambien se re-renderiza: la escritura relee y fusiona el
      // archivo del sitio, y pueden aparecer solicitudes de otras sesiones.
      () => rerender(),
      (e) => {
        item.estado = prev
        const vivo = [...getCambiosEstructura(), ...getSolicitudesPermiso()].find((x) => x.id === item.id)
        if (vivo) vivo.estado = prev
        setError(e?.message || String(e))
        rerender()
      }
    )
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

  const persistirCarpeta = (c, estado) => setCambioEstado(structure, c.id, estado)
  const persistirPermiso = (p, estado) => setSolicitudPermisoEstado(structure, p.id, estado)

  // Lote: aprueba las seleccionadas pendientes, o marca creadas/aplicadas las
  // seleccionadas aprobadas. Cada item se escribe en segundo plano (la cola por
  // sitio serializa); la seleccion se limpia al disparar.
  function lote(items, sel, setSel, estadoDesde, estadoA, persistir) {
    for (const it of items) {
      if (sel.has(it.id) && it.estado === estadoDesde) {
        aplicarOptimista(it, estadoA, () => persistir(it, estadoA))
      }
    }
    setSel(new Set())
  }

  const ctx = { nombreSitio }

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
          se hicieron. El nombre definitivo de cada carpeta se fija al generar el
          PnP y actualizar el maestro.
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

    <h2 style="margin-top:16px">Permisos (accesos a sitios)</h2>
    <div class="muted" style="margin-top:-6px">
      Via principal del dashboard: gestionar accesos y romper herencias por carpeta.
    </div>
    ${permisos.length === 0
      ? html`<div class="muted">No hay solicitudes de permisos.</div>`
      : html`
        <${BarraLote}
          items=${permisos}
          sel=${selPermisos}
          labelAplicar="Marcar aplicadas seleccionadas"
          onAprobar=${() => lote(permisos, selPermisos, setSelPermisos, 'propuesto', 'aprobado', persistirPermiso)}
          onAplicar=${() => lote(permisos, selPermisos, setSelPermisos, 'aprobado', 'aplicado', persistirPermiso)}
        />
        <table class="tabla" data-testid="tabla-permisos">
        <thead>
          <tr>
            <th><${CheckTodas} items=${permisos} sel=${selPermisos} setSel=${setSelPermisos} /></th>
            <th>Sitio</th><th>Accion</th><th>Persona</th><th>Rol</th><th>Solicita</th><th>Estado</th><th></th>
          </tr>
        </thead>
        <tbody>
          ${permisos.map((p) => html`<${FilaPermiso}
            key=${p.id}
            p=${p}
            ctx=${ctx}
            sel=${selPermisos}
            setSel=${setSelPermisos}
            onEstado=${(estado) => aplicarOptimista(p, estado, () => persistirPermiso(p, estado))}
          />`)}
        </tbody>
      </table>`}

    <h2 style="margin-top:28px">Carpetas (cambios de estructura) <span class="muted" style="font-weight:normal;font-size:0.8em">— secundario / opcional</span></h2>
    <div class="muted" style="margin-top:-6px">
      Flujo inverso: el equipo crea y renombra carpetas directo en SharePoint, asi
      que esta cola es OPCIONAL (solicitudes puntuales). El arbol ya no depende de
      su aprobacion.
    </div>
    ${carpetas.length === 0
      ? html`<div class="muted">No hay solicitudes de carpetas.</div>`
      : html`
        <${BarraLote}
          items=${carpetas}
          sel=${selCarpetas}
          labelAplicar="Marcar creadas/aplicadas seleccionadas"
          onAprobar=${() => lote(carpetas, selCarpetas, setSelCarpetas, 'propuesto', 'aprobado', persistirCarpeta)}
          onAplicar=${() => lote(carpetas, selCarpetas, setSelCarpetas, 'aprobado', 'aplicado', persistirCarpeta)}
        />
        <table class="tabla" data-testid="tabla-carpetas">
        <thead>
          <tr>
            <th><${CheckTodas} items=${carpetas} sel=${selCarpetas} setSel=${setSelCarpetas} /></th>
            <th>Sitio</th><th>Tipo</th><th>Ruta / nombre final</th><th>Clasif.</th><th>Solicita</th><th>Estado</th><th></th>
          </tr>
        </thead>
        <tbody>
          ${carpetas.map((c) => html`<${FilaCarpeta}
            key=${c.id}
            c=${c}
            ctx=${ctx}
            sel=${selCarpetas}
            setSel=${setSelCarpetas}
            onEstado=${(estado) => aplicarOptimista(c, estado, () => persistirCarpeta(c, estado))}
          />`)}
        </tbody>
      </table>`}

    <div class="muted" style="margin-top:24px">
      Tras aprobar, exporta la cola desde <strong>Evidencia</strong> para entregarla a PnP.
    </div>
  `
}

// Checkbox de cabecera: selecciona/deselecciona todas las solicitudes ABIERTAS
// (Pendiente o Aprobada); las cerradas no tienen acciones y no se seleccionan.
function CheckTodas({ items, sel, setSel }) {
  const abiertas = items.filter((x) => ABIERTOS.has(x.estado))
  const todas = abiertas.length > 0 && abiertas.every((x) => sel.has(x.id))
  if (abiertas.length === 0) return null
  return html`<input
    type="checkbox"
    title="Seleccionar todas"
    aria-label="Seleccionar todas"
    checked=${todas}
    onChange=${() => setSel(todas ? new Set() : new Set(abiertas.map((x) => x.id)))}
  />`
}

function CheckFila({ item, sel, setSel }) {
  if (!ABIERTOS.has(item.estado)) return null
  return html`<input
    type="checkbox"
    aria-label="Seleccionar solicitud"
    checked=${sel.has(item.id)}
    onChange=${() => {
      const n = new Set(sel)
      n.has(item.id) ? n.delete(item.id) : n.add(item.id)
      setSel(n)
    }}
  />`
}

// Barra de acciones por lote sobre la seleccion de una tabla. Cuenta SOLO las
// seleccionadas que siguen abiertas: una fila que se cerro (p. ej. descartada)
// despues de seleccionarla ya no tiene acciones y no debe sumar.
function BarraLote({ items, sel, labelAplicar, onAprobar, onAplicar }) {
  const abiertas = items.filter((x) => sel.has(x.id) && ABIERTOS.has(x.estado))
  const nAprobar = abiertas.filter((x) => x.estado === 'propuesto').length
  const nAplicar = abiertas.filter((x) => x.estado === 'aprobado').length
  if (abiertas.length === 0) return null
  return html`<div class="lote-bar" data-testid="lote-bar">
    <span class="muted">${abiertas.length} seleccionada${abiertas.length === 1 ? '' : 's'}</span>
    <button class="btn" disabled=${nAprobar === 0} onClick=${onAprobar}>
      Aprobar seleccionadas${nAprobar ? ` (${nAprobar})` : ''}
    </button>
    <button class="btn secondary dark-on-light" disabled=${nAplicar === 0} onClick=${onAplicar}>
      ${labelAplicar}${nAplicar ? ` (${nAplicar})` : ''}
    </button>
  </div>`
}

// Botones de transicion. Aprobar es UN clic (sin formulario): solo cambia el
// estado; descartar y marcar creada/aplicada igual. Todo optimista.
function Acciones({ item, tipo, onEstado }) {
  if (item.estado === 'propuesto') {
    return html`
      <button class="btn secondary dark-on-light" onClick=${() => onEstado('aprobado')}>Aprobar</button>
      <button class="btn secondary dark-on-light" onClick=${() => onEstado('descartado')}>Descartar</button>
    `
  }
  if (item.estado === 'aprobado') {
    return html`
      <button class="btn secondary dark-on-light" onClick=${() => onEstado('aplicado')}>${tipo === 'crear' ? 'Marcar creada' : 'Marcar aplicada'}</button>
      <button class="btn secondary dark-on-light" onClick=${() => onEstado('descartado')}>Descartar</button>
    `
  }
  return html`<span class="muted">—</span>`
}

// Linea de metadatos de aprobacion (nombre final acordado + comentario), si los
// hay (solicitudes aprobadas antes del cambio de flujo, o anotadas por Cowork).
function MetaAprobacion({ item, mostrarNombre }) {
  return html`
    ${mostrarNombre && item.nombreFinal && item.nombreFinal !== item.ruta &&
    html`<div class="muted">final acordado: <code>${item.nombreFinal}</code></div>`}
    ${item.comentario && html`<div class="muted">nota: ${item.comentario}</div>`}
  `
}

function FilaCarpeta({ c, ctx, sel, setSel, onEstado }) {
  const { nombreSitio } = ctx
  return html`<tr>
    <td><${CheckFila} item=${c} sel=${sel} setSel=${setSel} /></td>
    <td>
      <a class="back-link" href=${`/sitio/${c.slug}`} onClick=${(e) => (e.preventDefault(), route(`/sitio/${c.slug}`))}>${nombreSitio(c.slug)}</a>
    </td>
    <td>${c.tipo === 'crear' ? 'Crear' : 'Sobrante'}</td>
    <td>
      <code>${c.ruta}</code>
      <${MetaAprobacion} item=${c} mostrarNombre=${c.tipo === 'crear'} />
    </td>
    <td>${c.clasificacion || '—'}</td>
    <td>${c.creadoPor || '—'}</td>
    <td><span class=${`estado-tag ${tagClase(c.estado)}`}>${estadoLabel(c.estado, c.tipo)}</span></td>
    <td><${Acciones} item=${c} tipo=${c.tipo} onEstado=${onEstado} /></td>
  </tr>`
}

function FilaPermiso({ p, ctx, sel, setSel, onEstado }) {
  const { nombreSitio } = ctx
  return html`<tr>
    <td><${CheckFila} item=${p} sel=${sel} setSel=${setSel} /></td>
    <td>
      <a class="back-link" href=${`/sitio/${p.slug}`} onClick=${(e) => (e.preventDefault(), route(`/sitio/${p.slug}`))}>${nombreSitio(p.slug)}</a>
    </td>
    <td>${p.tipo === 'agregar' ? 'Agregar' : 'Quitar'}${p.ruta ? ' (carpeta)' : ''}</td>
    <td>
      ${p.persona}
      ${p.ruta && html`<div class="muted">carpeta: <code>${p.ruta}</code></div>`}
      <${MetaAprobacion} item=${p} mostrarNombre=${false} />
    </td>
    <td>${p.rol}</td>
    <td>${p.creadoPor || '—'}</td>
    <td><span class=${`estado-tag ${tagClase(p.estado)}`}>${estadoLabel(p.estado, p.tipo)}</span></td>
    <td><${Acciones} item=${p} tipo=${p.tipo} onEstado=${onEstado} /></td>
  </tr>`
}
