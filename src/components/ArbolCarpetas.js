import { html } from 'htm/preact'
import { useState, useEffect, useCallback, useMemo } from 'preact/hooks'
import { colorClasificacion, clasificacionSemilla } from '../lib/structure-store.js'
import { getChildren, invalidateSitio } from '../lib/live-tree-store.js'
import {
  getOverride,
  getClasifOverride,
  getCambiosEstructura,
  quienMigra as quienMigraDe,
  accesoTemporalSitio,
  esPropietarioSitio,
  limpiarNombre,
  reconciliarSitio,
  ROSTER
} from '../lib/seguimiento-store.js'
import { SelectorMigracion } from './SelectorMigracion.js'

// Arbol visual e interactivo (tipo explorador) de las carpetas REALES de un sitio,
// leidas EN VIVO de SharePoint (via Graph) con carga LAZY por nivel: cada carpeta
// se expande bajo demanda (hay ~4214 carpetas; no se recorre todo de golpe). Ya no
// se deriva del maestro (que quedaba desfasado con el equipo creando/renombrando
// directo): si la carpeta existe, se muestra; si no, no esta. Se sobreponen las
// solicitudes de estructura (crear -> "pendiente"; sobrante -> marca) y el
// seguimiento por carpeta (migracion, quien migra, accesos). La clasificacion sale
// del maestro como SEMILLA por ruta; carpeta real sin entrada -> "sin clasificar".

function icono(virtual) {
  return html`<svg class=${`ico-carpeta ${virtual ? 'virtual' : ''}`} viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
    <path
      fill=${virtual ? 'none' : 'currentColor'}
      stroke="currentColor"
      stroke-width=${virtual ? '1.6' : '0'}
      stroke-dasharray=${virtual ? '3 2' : '0'}
      d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z"
    />
  </svg>`
}

function migTag(estado) {
  if (estado === 'Migrada' || estado === 'Verificada') return 'ok'
  if (estado === 'En progreso') return 'prog'
  return 'pend'
}

// Descripcion breve de las carpetas de control (_Plantillas/_Migracion/_Archivo).
const DESC_CARPETAS = {
  _plantillas: 'Plantillas reutilizables del area',
  _migracion: 'Zona temporal de migracion',
  _archivo: 'Documentos obsoletos que se conservan'
}
function descCarpeta(nombre) {
  return DESC_CARPETAS[(nombre || '').trim().toLowerCase()] || ''
}

// Glifo monocromo de estado (color + icono + texto; sin emojis).
function icoMig(estado) {
  if (estado === 'Verificada') return '✓✓'
  if (estado === 'Migrada') return '✓'
  if (estado === 'En progreso') return '◑'
  return '○'
}

export function ArbolCarpetas({
  sitioDef,
  structure,
  acciones,
  admin = false,
  miNombre = '',
  esPropietario = false,
  recargarToken = 0,
  onSitioInfo = null
}) {
  const slug = sitioDef.slug
  // Estado por nivel: ruta -> { folders, archivos, existeSitio, loading, error, loaded }.
  const [nivel, setNivel] = useState(() => new Map())
  const [expandidos, setExpandidos] = useState(() => new Set())
  const [, setTick] = useState(0)
  const rerender = () => setTick((t) => t + 1)

  const cargarNivel = useCallback(
    async (ruta, { force = false } = {}) => {
      setNivel((prev) => {
        const m = new Map(prev)
        m.set(ruta, { ...(m.get(ruta) || {}), loading: true, error: null })
        return m
      })
      try {
        const data = await getChildren(slug, ruta, { force })
        setNivel((prev) => {
          const m = new Map(prev)
          m.set(ruta, { ...data, loading: false, error: null, loaded: true })
          return m
        })
        if (ruta === '' && onSitioInfo) onSitioInfo({ existeSitio: data.existeSitio })
        // Reconciliacion por itemId del nivel recien cargado: re-llave el
        // seguimiento de carpetas renombradas y sella itemId en las que faltan.
        if (data.folders?.length) {
          reconciliarSitio(structure, slug, data.folders)
            .then((cambio) => { if (cambio) rerender() })
            .catch(() => {})
        }
      } catch (e) {
        setNivel((prev) => {
          const m = new Map(prev)
          m.set(ruta, { folders: [], archivos: 0, loading: false, error: e?.message || String(e), loaded: true })
          return m
        })
      }
    },
    [slug, onSitioInfo, structure]
  )

  // Al montar / cambiar de sitio o al pulsar "Actualizar" (recargarToken): se
  // reinicia el estado y se recarga la raiz. El token > 0 fuerza saltar la cache.
  useEffect(() => {
    setNivel(new Map())
    setExpandidos(new Set())
    if (recargarToken > 0) invalidateSitio(slug)
    cargarNivel('', { force: recargarToken > 0 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, recargarToken])

  const toggle = useCallback(
    (ruta) => {
      setExpandidos((prev) => {
        const s = new Set(prev)
        if (s.has(ruta)) {
          s.delete(ruta)
        } else {
          s.add(ruta)
          cargarNivel(ruta)
        }
        return s
      })
    },
    [cargarNivel]
  )

  // Tras registrar una carpeta nueva dentro de un nodo, se auto-expande para que
  // la pendiente sea visible de inmediato.
  const autoExpand = useCallback(
    (ruta) => {
      if (ruta === '') return
      setExpandidos((prev) => {
        if (prev.has(ruta)) return prev
        const s = new Set(prev)
        s.add(ruta)
        return s
      })
    },
    []
  )

  // Semilla del maestro por ruta (clasificacion + accesoExtra/Excluido por carpeta).
  const seedPorRuta = useMemo(
    () => new Map((sitioDef.nodos || []).map((n) => [n.ruta, n])),
    [sitioDef]
  )

  const cambios = getCambiosEstructura(slug)
  const abierto = (c) => c.estado !== 'descartado' && c.estado !== 'aplicado'
  const sobrantes = useMemo(
    () => new Set(cambios.filter((c) => c.tipo === 'sobrante' && abierto(c)).map((c) => c.ruta)),
    [cambios]
  )

  // Hijos virtuales (solicitudes "crear" abiertas) DIRECTOS de parentRuta. Una
  // misma ruta puede acumular varias solicitudes (doble clic, dos personas): se
  // juntan los ids para que "quitar" las descarte todas.
  const hijosVirtuales = useCallback(
    (parentRuta) => {
      const out = new Map()
      for (const c of cambios) {
        if (c.tipo !== 'crear' || !abierto(c)) continue
        const idx = c.ruta.lastIndexOf('/')
        const padre = idx === -1 ? '' : c.ruta.slice(0, idx)
        if (padre !== parentRuta) continue
        const ex = out.get(c.ruta) || {
          ruta: c.ruta,
          nombre: c.ruta.split('/').pop(),
          clasificacion: c.clasificacion || null,
          cambioIds: []
        }
        ex.cambioIds.push(c.id)
        out.set(c.ruta, ex)
      }
      return [...out.values()]
    },
    [cambios]
  )

  const niveles = Object.keys(structure.clasificaciones || {})
  const ctx = {
    slug, structure, niveles, acciones, rerender, admin, miNombre, esPropietario,
    sitioDef, nivel, expandidos, toggle, autoExpand, cargarNivel, seedPorRuta,
    sobrantes, hijosVirtuales
  }

  const raiz = nivel.get('')
  const rootVirtuales = hijosVirtuales('')

  return html`
    <div class="arbol-toolbar">
      <span class="muted">Carpetas reales en SharePoint (lectura en vivo).</span>
      <${AgregarRaiz} ctx=${ctx} />
    </div>
    <div class="arbol">
      ${raiz?.loading && !raiz?.loaded && html`<div class="muted arbol-cargando">Cargando carpetas...</div>`}
      ${raiz?.error && html`<div class="nodo-status err">No se pudieron leer las carpetas: ${raiz.error}</div>`}
      ${(raiz?.folders || []).map(
        (f) => html`<${ArbolNodo} key=${f.ruta} folder=${f} nivel=${0} ctx=${ctx} extraHeredado=${[]} />`
      )}
      ${rootVirtuales.map(
        (v) => html`<${ArbolNodo} key=${v.ruta} virtual=${v} nivel=${0} ctx=${ctx} extraHeredado=${[]} />`
      )}
      ${raiz?.loaded && !raiz?.error && (raiz.folders || []).length === 0 && rootVirtuales.length === 0 &&
      html`<div class="muted">Este sitio no tiene carpetas todavia.</div>`}
    </div>
  `
}

// Acceso efectivo de una carpeta segun el maestro: propietario + acceso del
// sitio (herencia) + equipo de migracion temporal + accesoExtra de la carpeta
// y de sus ancestros (herencia rota aditiva), menos accesoExcluido. SOLO
// informativo: los permisos reales los gestiona PnP; "quitar" registra una
// solicitud que aprueba el SGSI y autoriza Franco.
function accesoEfectivo(sitioDef, node, extraHeredado) {
  const excluidos = new Set((node.accesoExcluido || []).map((p) => limpiarNombre(p)))
  const vistos = new Set()
  const out = []
  const push = (persona, tipo, desde) => {
    const p = limpiarNombre(persona)
    if (!p || vistos.has(p.toLowerCase())) return
    vistos.add(p.toLowerCase())
    out.push({ persona: p, tipo, desde: desde || '', excluido: excluidos.has(p) })
  }
  if (sitioDef.propietario) push(sitioDef.propietario, 'propietario')
  // El acceso del sitio suele repetir al propietario con nombre corto
  // ("Wendy" vs "Wendy Rodriguez"): se omite para no duplicar el chip.
  for (const p of sitioDef.acceso || []) {
    if (!esPropietarioSitio(p, sitioDef)) push(p, 'sitio')
  }
  for (const p of accesoTemporalSitio(sitioDef)) push(p, 'temporal')
  for (const e of extraHeredado || []) push(e.persona, 'extra', e.desde)
  for (const p of node.accesoExtra || []) push(p, 'extra')
  return out
}

// Linea de chips con el acceso de la carpeta + boton de quitar (solicitud PnP).
function PanelAccesos({ node, nivel, ctx, extraHeredado }) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const puedeQuitar = (ctx.admin || ctx.esPropietario) && typeof ctx.acciones?.onQuitarAcceso === 'function'
  const lista = accesoEfectivo(ctx.sitioDef, node, extraHeredado)

  async function quitar(persona) {
    setBusy(true)
    setMsg(null)
    try {
      await ctx.acciones.onQuitarAcceso(node.ruta, persona)
      setMsg(`Solicitud registrada: quitar a ${persona} de esta carpeta (la aprueba el SGSI; PnP aplica el cambio real).`)
    } catch (e) {
      setMsg(`Error: ${e?.message || e}`)
    } finally {
      setBusy(false)
    }
  }

  return html`<div class="arbol-accesos arbol-indent" style=${{ '--nivel': nivel + 1 }} data-testid="panel-accesos">
    <div class="accesos-chips">
      <span class="muted">Acceso:</span>
      ${lista.map(
        (a) => html`<span class=${`acceso-pill ${a.excluido ? 'excluido' : ''}`} key=${a.persona} title=${a.desde ? `acceso extra desde ${a.desde}` : ''}>
          ${a.persona}
          ${a.tipo === 'propietario' && html`<span class="temporal">propietario</span>`}
          ${a.tipo === 'temporal' && html`<span class="temporal">temporal</span>`}
          ${a.tipo === 'extra' && html`<span class="temporal extra">carpeta${a.desde ? ` · ${a.desde.split('/').pop()}` : ''}</span>`}
          ${a.excluido && html`<span class="temporal">sin acceso aqui</span>`}
          ${puedeQuitar && a.tipo !== 'propietario' && !a.excluido &&
          html`<button class="pill-quitar" title=${`Solicitar quitar a ${a.persona} de esta carpeta (PnP)`} aria-label=${`Quitar acceso a ${a.persona}`} disabled=${busy} onClick=${() => quitar(a.persona)}>×</button>`}
        </span>`
      )}
    </div>
    <div class="muted">
      Segun el maestro; el dashboard no cambia permisos reales.${puedeQuitar ? ' "×" registra una solicitud de quitar acceso a ESTA carpeta para PnP.' : ''}
    </div>
    ${msg && html`<div class=${`nodo-status ${msg.startsWith('Error') ? 'err' : 'ok'}`}>${msg}</div>`}
  </div>`
}

function AgregarRaiz({ ctx }) {
  const [abierto, setAbierto] = useState(false)
  if (!abierto) {
    return html`<button class="btn" onClick=${() => setAbierto(true)} data-testid="agregar-raiz">+ Agregar carpeta</button>`
  }
  return html`<${FormAgregar} ctx=${ctx} parentRuta="" onClose=${() => setAbierto(false)} />`
}

// Un nodo del arbol. Es REAL (carpeta viva de Graph; `folder`) o VIRTUAL
// (solicitud "crear" abierta; `virtual`). Los reales cargan sus hijos al
// expandir; los virtuales muestran sus pendientes anidadas siempre.
function ArbolNodo({ folder = null, virtual = null, nivel: depth, ctx, extraHeredado = [] }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [agregando, setAgregando] = useState(false)
  const [confirmandoSobrante, setConfirmandoSobrante] = useState(false)
  const [verAccesos, setVerAccesos] = useState(false)

  const esVirtual = !!virtual
  const ruta = esVirtual ? virtual.ruta : folder.ruta
  const nombre = esVirtual ? virtual.nombre : folder.nombre
  const key = `${ctx.slug}::${ruta}`
  const seed = ctx.seedPorRuta.get(ruta)
  const ov = getOverride(key)

  // Clasificacion EFECTIVA: en virtuales la del cambio; en reales el override del
  // sitio (seguimiento) y, si no, la semilla del repo (maestro + clasificaciones-sgsi).
  const clasificacion = esVirtual
    ? virtual.clasificacion
    : getClasifOverride(ctx.slug, ruta) || clasificacionSemilla(ctx.structure, ctx.slug, ruta)
  const color = clasificacion ? colorClasificacion(ctx.structure, clasificacion) : null
  const accesoExtra = seed?.accesoExtra || []
  const accesoExcluido = seed?.accesoExcluido || []
  const migracionEstado = ov?.migracionEstado || 'Sin empezar'
  const quienMigra = quienMigraDe(key)
  const bloqueada = ov?.estado === 'Bloqueada'
  const motivo = bloqueada ? ov?.notas || '' : ''
  const sobrante = ctx.sobrantes.has(ruta)
  const childCount = esVirtual ? 0 : folder.childCount
  const itemId = esVirtual ? null : folder.itemId || null

  // Datos del nivel propio (hijos reales) cuando esta expandido.
  const data = ctx.nivel.get(ruta)
  const expandido = esVirtual ? true : ctx.expandidos.has(ruta)
  const hijosVirt = ctx.hijosVirtuales(ruta)
  const hijosReales = data?.folders || []
  // Un nodo real puede tener hijos (childCount del facet de carpeta) o pendientes;
  // un virtual solo tiene pendientes anidadas.
  const tieneHijos = esVirtual ? hijosVirt.length > 0 : childCount > 0 || hijosVirt.length > 0

  const node = { ruta, nombre, accesoExtra, accesoExcluido }

  const indent = { '--nivel': depth }
  const indentHijo = { '--nivel': depth + 1 }

  async function run(fn) {
    setBusy(true)
    setErr(null)
    try {
      await fn()
      ctx.rerender()
    } catch (e) {
      setErr(e?.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  const clase = `arbol-nodo${esVirtual ? ' pendiente' : ''}${sobrante ? ' sobrante' : ''}${bloqueada ? ' bloqueada' : ''}`
  const desc = descCarpeta(nombre)
  const extraParaHijos = [...extraHeredado, ...accesoExtra.map((p) => ({ persona: p, desde: ruta }))]

  return html`
    <div class=${clase}>
      <div class="arbol-row arbol-indent" style=${indent}>
        <span class="arbol-caret" onClick=${() => !esVirtual && tieneHijos && ctx.toggle(ruta)}>${!esVirtual && tieneHijos ? (expandido ? '▾' : '▸') : ''}</span>
        ${icono(esVirtual)}
        <span class="arbol-nombre" title=${desc || nombre}>${nombre}</span>
        ${desc && html`<span class="carpeta-desc muted" title=${desc}>${desc}</span>`}
        ${clasificacion
          ? html`<span class="badge" style=${`background:${color}`}>${clasificacion}</span>`
          : !esVirtual && html`<span class="badge sin-clasificar" title="Sin clasificar (asignar)">sin clasificar</span>`}
        ${!esVirtual && ctx.admin && typeof ctx.acciones?.onClasificar === 'function' &&
        html`<select class="sel-clasif" disabled=${busy} title="Clasificacion (override del sitio)" onChange=${(e) => run(() => ctx.acciones.onClasificar(ruta, e.target.value, itemId))}>
          <option value="" selected=${!clasificacion}>sin clasificar</option>
          ${ctx.niveles.map((n) => html`<option value=${n} selected=${n === clasificacion}>${n}</option>`)}
        </select>`}

        ${esVirtual
          ? html`<span class="estado-tag prog">pendiente de crear</span>`
          : html`
              <span class=${`estado-tag ${migTag(migracionEstado)}`}><span class="ico-estado">${icoMig(migracionEstado)}</span> ${migracionEstado}</span>
              ${typeof childCount === 'number' && childCount > 0 && html`<span class="muted">${childCount} elem.</span>`}
              ${bloqueada && html`<span class="estado-tag err" title=${motivo}>Bloqueada</span>`}
            `}
        ${sobrante && html`<span class="estado-tag err">sobrante</span>`}

        <span class="arbol-acciones">
          ${!esVirtual &&
          html`
            <span class="arbol-mig">
              <${SelectorMigracion}
                valor=${migracionEstado}
                disabled=${busy || !(ctx.admin || ctx.esPropietario || (quienMigra && quienMigra === ctx.miNombre))}
                onCambio=${(v) => run(() => ctx.acciones.onMigracion(key, v, itemId))}
              />
            </span>
            ${ctx.admin
              ? html`<select class="sel-quien" disabled=${busy} onChange=${(e) => run(() => ctx.acciones.onQuienMigra(key, e.target.value, itemId))}>
                  <option value="" selected=${!quienMigra}>quien migra...</option>
                  ${ROSTER.map((p) => html`<option value=${p} selected=${p === quienMigra}>${p}</option>`)}
                </select>`
              : quienMigra
                ? html`<span class="muted">migra: ${quienMigra}</span>`
                : html`<span class="muted">sin asignar</span>`}
          `}
          ${!esVirtual &&
          html`<button class="link-act" data-act="accesos" disabled=${busy} onClick=${() => setVerAccesos(!verAccesos)}>
            accesos${accesoExtra.length || extraHeredado.length ? ` (+${accesoExtra.length + extraHeredado.length})` : ''}
          </button>`}
          <button class="link-act" data-act="agregar" disabled=${busy} onClick=${() => setAgregando(!agregando)}>+ carpeta</button>
          ${!esVirtual &&
          !sobrante &&
          html`<button class="link-act" data-act="sobrante" disabled=${busy} onClick=${() =>
            typeof childCount === 'number' && childCount > 0
              ? setConfirmandoSobrante(true)
              : run(() => ctx.acciones.onSobrante(ruta))}>sobrante</button>`}
          ${!esVirtual &&
          ctx.admin &&
          bloqueada &&
          html`<button class="link-act" disabled=${busy} onClick=${() => run(() => ctx.acciones.onDesbloquear(key))}>desbloquear</button>`}
          ${esVirtual && html`<button class="link-act" disabled=${busy} onClick=${() => run(async () => {
            for (const id of virtual.cambioIds || []) await ctx.acciones.onQuitarVirtual(id)
          })}>quitar</button>`}
        </span>
      </div>

      ${err && html`<div class="nodo-status err arbol-indent" style=${indent}>${err}</div>`}

      ${verAccesos &&
      html`<${PanelAccesos} node=${node} nivel=${depth} ctx=${ctx} extraHeredado=${extraHeredado} />`}

      ${confirmandoSobrante &&
      html`<div class="arbol-confirm arbol-indent" style=${indentHijo} data-testid="confirm-sobrante">
        <span class="warn-text">Esta carpeta tiene <strong>${childCount}</strong> elemento(s). Marcarla como sobrante propone ELIMINARLA en SharePoint (lo aplica PnP). ¿Confirmar?</span>
        <button class="btn" disabled=${busy} onClick=${() => run(async () => { await ctx.acciones.onSobrante(ruta); setConfirmandoSobrante(false) })}>Confirmar sobrante</button>
        <button class="btn secondary dark-on-light" disabled=${busy} onClick=${() => setConfirmandoSobrante(false)}>Cancelar</button>
      </div>`}

      ${agregando &&
      html`<div class="arbol-indent" style=${indentHijo}>
        <${FormAgregar} ctx=${ctx} parentRuta=${ruta} onClose=${() => setAgregando(false)} onAgregado=${() => ctx.autoExpand(ruta)} />
      </div>`}

      ${expandido &&
      html`<div class="arbol-hijos">
        ${data?.loading && html`<div class="muted arbol-indent" style=${indentHijo}>Cargando...</div>`}
        ${data?.error && html`<div class="nodo-status err arbol-indent" style=${indentHijo}>${data.error}</div>`}
        ${hijosReales.map(
          (f) => html`<${ArbolNodo} key=${f.ruta} folder=${f} nivel=${depth + 1} ctx=${ctx} extraHeredado=${extraParaHijos} />`
        )}
        ${hijosVirt.map(
          (v) => html`<${ArbolNodo} key=${v.ruta} virtual=${v} nivel=${depth + 1} ctx=${ctx} extraHeredado=${extraParaHijos} />`
        )}
      </div>`}
    </div>
  `
}

function FormAgregar({ ctx, parentRuta, onClose, onAgregado = null }) {
  const [nombre, setNombre] = useState('')
  const [clasif, setClasif] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  async function agregar() {
    if (!nombre.trim() || !clasif) return
    setBusy(true)
    setErr(null)
    try {
      await ctx.acciones.onAgregar(parentRuta, nombre.trim(), clasif)
      setNombre('')
      setClasif('')
      onClose()
      onAgregado?.()
      ctx.rerender()
    } catch (e) {
      setErr(e?.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  const faltaClasif = !!nombre.trim() && !clasif

  return html`
    <div class="arbol-agregar">
      <input class="arbol-nuevo-nombre" type="text" value=${nombre} placeholder="Nombre de la nueva carpeta" onInput=${(e) => setNombre(e.target.value)} disabled=${busy} />
      <select value=${clasif} onChange=${(e) => setClasif(e.target.value)} disabled=${busy} class=${faltaClasif ? 'campo-invalido' : ''} aria-invalid=${faltaClasif} required>
        <option value="">Clasificacion (obligatoria)</option>
        ${ctx.niveles.map((n) => html`<option value=${n}>${n}</option>`)}
      </select>
      <button class="btn" onClick=${agregar} disabled=${busy || !nombre.trim() || !clasif}>Registrar</button>
      <button class="btn secondary dark-on-light" onClick=${onClose} disabled=${busy}>Cancelar</button>
      ${faltaClasif && html`<span class="nodo-status err">Selecciona una clasificacion para poder registrar la carpeta.</span>`}
      ${err && html`<span class="nodo-status err">No se pudo guardar: ${err}</span>`}
    </div>
  `
}
