import { html } from 'htm/preact'
import { useState } from 'preact/hooks'
import { colorClasificacion } from '../lib/structure-store.js'
import {
  getOverride,
  getCambiosEstructura,
  quienMigra as quienMigraDe,
  ROSTER
} from '../lib/seguimiento-store.js'
import { SelectorMigracion } from './SelectorMigracion.js'

// Arbol visual e interactivo (tipo explorador) de las carpetas de un sitio.
// Por carpeta: clasificacion (color), estructura (Creada/Pendiente), migracion
// (estado), nº de archivos, quien migra (roster) y acciones. El dashboard NO crea
// ni borra carpetas reales: las nuevas quedan como cambio para PnP.

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

function construirArbol(sitioDef, structure, migByKey, cambios) {
  const map = new Map()
  const ensure = (ruta, partial) => {
    let node = map.get(ruta)
    if (!node) {
      const segs = ruta.split('/')
      node = {
        ruta, nombre: segs[segs.length - 1], hijos: [], real: false, grupo: false,
        virtual: false, sobrante: false, bloqueada: false, motivo: '', clasificacion: null,
        color: null, existe: false, archivos: undefined, migracionEstado: 'Sin empezar',
        quienMigra: '', key: null, cambioId: null
      }
      map.set(ruta, node)
    }
    if (partial) Object.assign(node, partial)
    return node
  }

  for (const n of sitioDef.nodos) {
    const mig = migByKey.get(n.key)
    const ov = getOverride(n.key)
    ensure(n.ruta, {
      key: n.key, nombre: n.nombre, clasificacion: n.clasificacion,
      color: n.clasificacion ? colorClasificacion(structure, n.clasificacion) : null,
      real: true, existe: mig?.existe || false, archivos: mig?.archivos,
      migracionEstado: ov?.migracionEstado || 'Sin empezar',
      quienMigra: quienMigraDe(n.key),
      bloqueada: ov?.estado === 'Bloqueada',
      motivo: ov?.estado === 'Bloqueada' ? ov?.notas || '' : ''
    })
  }

  for (const c of cambios) {
    if (c.estado === 'descartado' || c.estado === 'aplicado') continue
    if (c.tipo === 'sobrante') {
      const node = map.get(c.ruta)
      if (node) node.sobrante = true
    } else if (c.tipo === 'crear') {
      ensure(c.ruta, {
        nombre: c.ruta.split('/').pop(),
        clasificacion: c.clasificacion || null,
        color: c.clasificacion ? colorClasificacion(structure, c.clasificacion) : null,
        virtual: true, cambioId: c.id
      })
    }
  }

  for (const ruta of [...map.keys()]) {
    let r = ruta
    let idx = r.lastIndexOf('/')
    while (idx !== -1) {
      r = r.slice(0, idx)
      if (!map.has(r)) ensure(r, { grupo: true })
      idx = r.lastIndexOf('/')
    }
  }

  const roots = []
  for (const ruta of [...map.keys()]) {
    const node = map.get(ruta)
    const idx = ruta.lastIndexOf('/')
    if (idx === -1) roots.push(node)
    else map.get(ruta.slice(0, idx)).hijos.push(node)
  }
  return roots
}

export function ArbolCarpetas({ sitioDef, structure, sitioMig, acciones, admin = false, miNombre = '', esPropietario = false }) {
  const [colapsados, setColapsados] = useState(() => new Set())
  const [, setTick] = useState(0)
  const rerender = () => setTick((t) => t + 1)

  const migByKey = new Map((sitioMig?.nodos || []).map((n) => [n.key, n]))
  const cambios = getCambiosEstructura(sitioDef.slug)
  const roots = construirArbol(sitioDef, structure, migByKey, cambios)
  const niveles = Object.keys(structure.clasificaciones || {})

  const toggle = (ruta) => {
    const s = new Set(colapsados)
    s.has(ruta) ? s.delete(ruta) : s.add(ruta)
    setColapsados(s)
  }
  const ctx = { colapsados, toggle, niveles, acciones, rerender, admin, miNombre, esPropietario }

  return html`
    <div class="arbol-toolbar">
      <button class="btn secondary dark-on-light" onClick=${() => setColapsados(new Set())}>Abrir todo</button>
      <button class="btn secondary dark-on-light" onClick=${() => setColapsados(new Set(todasLasRutas(roots)))}>Cerrar todo</button>
      <${AgregarRaiz} ctx=${ctx} />
    </div>
    <div class="arbol">
      ${roots.map((n) => html`<${ArbolNodo} key=${n.ruta} node=${n} nivel=${0} ctx=${ctx} />`)}
    </div>
  `
}

function todasLasRutas(roots) {
  const out = []
  const walk = (ns) => ns.forEach((n) => (out.push(n.ruta), walk(n.hijos)))
  walk(roots)
  return out
}

function AgregarRaiz({ ctx }) {
  const [abierto, setAbierto] = useState(false)
  if (!abierto) {
    return html`<button class="btn" onClick=${() => setAbierto(true)} data-testid="agregar-raiz">+ Agregar carpeta</button>`
  }
  return html`<${FormAgregar} ctx=${ctx} parentRuta="" onClose=${() => setAbierto(false)} />`
}

function ArbolNodo({ node, nivel, ctx }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [agregando, setAgregando] = useState(false)
  const [bloqueando, setBloqueando] = useState(false)
  const [confirmandoSobrante, setConfirmandoSobrante] = useState(false)
  const [motivo, setMotivo] = useState('')
  const expandido = !ctx.colapsados.has(node.ruta)
  const tieneHijos = node.hijos.length > 0
  // Sangria por nivel via variable CSS (.arbol-indent): en escritorio son 18px
  // por nivel; en movil el CSS la reduce y dibuja la jerarquia con lineas guia.
  const indent = { '--nivel': nivel }
  const indentHijo = { '--nivel': nivel + 1 }

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

  const clase = `arbol-nodo${node.virtual ? ' pendiente' : ''}${node.sobrante ? ' sobrante' : ''}${node.bloqueada ? ' bloqueada' : ''}`
  const desc = descCarpeta(node.nombre)

  return html`
    <div class=${clase}>
      <div class="arbol-row arbol-indent" style=${indent}>
        <span class="arbol-caret" onClick=${() => tieneHijos && ctx.toggle(node.ruta)}>${tieneHijos ? (expandido ? '▾' : '▸') : ''}</span>
        ${icono(node.virtual)}
        <span class="arbol-nombre" title=${desc || node.nombre}>${node.nombre}</span>
        ${desc && html`<span class="carpeta-desc muted" title=${desc}>${desc}</span>`}
        ${node.clasificacion && html`<span class="badge" style=${`background:${node.color}`}>${node.clasificacion}</span>`}

        ${node.virtual
          ? html`<span class="estado-tag prog">pendiente de crear</span>`
          : node.real &&
            html`
              <span class=${`estr-tag ${node.existe ? 'ok' : 'pend'}`}>${node.existe ? '✓ Creada' : '○ Pendiente'}</span>
              <span class=${`estado-tag ${migTag(node.migracionEstado)}`}><span class="ico-estado">${icoMig(node.migracionEstado)}</span> ${node.migracionEstado}</span>
              ${typeof node.archivos === 'number' && html`<span class="muted">${node.archivos} arch.</span>`}
              ${node.bloqueada && html`<span class="estado-tag err">Bloqueada</span>`}
            `}
        ${node.sobrante && html`<span class="estado-tag err">sobrante</span>`}

        <span class="arbol-acciones">
          ${node.real &&
          html`
            <span class="arbol-mig">
              <${SelectorMigracion}
                valor=${node.migracionEstado}
                disabled=${busy || !(ctx.admin || ctx.esPropietario || (node.quienMigra && node.quienMigra === ctx.miNombre))}
                onCambio=${(v) => run(() => ctx.acciones.onMigracion(node.key, v))}
              />
            </span>
            ${ctx.admin
              ? html`<select class="sel-quien" disabled=${busy} onChange=${(e) => run(() => ctx.acciones.onQuienMigra(node.key, e.target.value))}>
                  <option value="" selected=${!node.quienMigra}>quien migra...</option>
                  ${ROSTER.map((p) => html`<option value=${p} selected=${p === node.quienMigra}>${p}</option>`)}
                </select>`
              : node.quienMigra
                ? html`<span class="muted">migra: ${node.quienMigra}</span>`
                : html`<span class="muted">sin asignar</span>`}
          `}
          <button class="link-act" data-act="agregar" disabled=${busy} onClick=${() => setAgregando(!agregando)}>+ carpeta</button>
          ${node.real &&
          !node.sobrante &&
          html`<button class="link-act" data-act="sobrante" disabled=${busy} onClick=${() =>
            typeof node.archivos === 'number' && node.archivos > 0
              ? setConfirmandoSobrante(true)
              : run(() => ctx.acciones.onSobrante(node.ruta))}>sobrante</button>`}
          ${node.real &&
          ctx.admin &&
          (node.bloqueada
            ? html`<button class="link-act" disabled=${busy} onClick=${() => run(() => ctx.acciones.onDesbloquear(node.key))}>desbloquear</button>`
            : html`<button class="link-act" disabled=${busy} onClick=${() => setBloqueando(!bloqueando)}>bloquear</button>`)}
          ${node.virtual && html`<button class="link-act" disabled=${busy} onClick=${() => run(() => ctx.acciones.onQuitarVirtual(node.cambioId))}>quitar</button>`}
        </span>
      </div>

      ${err && html`<div class="nodo-status err arbol-indent" style=${indent}>${err}</div>`}

      ${confirmandoSobrante &&
      html`<div class="arbol-confirm arbol-indent" style=${indentHijo} data-testid="confirm-sobrante">
        <span class="warn-text">Esta carpeta tiene <strong>${node.archivos}</strong> archivo(s). Marcarla como sobrante propone ELIMINARLA en SharePoint (lo aplica PnP). ¿Confirmar?</span>
        <button class="btn" disabled=${busy} onClick=${() => run(async () => { await ctx.acciones.onSobrante(node.ruta); setConfirmandoSobrante(false) })}>Confirmar sobrante</button>
        <button class="btn secondary dark-on-light" disabled=${busy} onClick=${() => setConfirmandoSobrante(false)}>Cancelar</button>
      </div>`}

      ${bloqueando &&
      html`<div class="arbol-agregar arbol-indent" style=${indentHijo}>
        <input class="arbol-nuevo-nombre" type="text" value=${motivo} placeholder="Motivo del bloqueo" onInput=${(e) => setMotivo(e.target.value)} disabled=${busy} />
        <button class="btn" disabled=${busy || !motivo.trim()} onClick=${() => run(async () => { await ctx.acciones.onBloquear(node.key, motivo.trim()); setBloqueando(false); setMotivo('') })}>Bloquear</button>
        <button class="btn secondary dark-on-light" disabled=${busy} onClick=${() => setBloqueando(false)}>Cancelar</button>
      </div>`}

      ${agregando &&
      html`<div class="arbol-indent" style=${indentHijo}>
        <${FormAgregar} ctx=${ctx} parentRuta=${node.ruta} onClose=${() => setAgregando(false)} />
      </div>`}

      ${tieneHijos && expandido &&
      html`<div class="arbol-hijos">
        ${node.hijos.map((h) => html`<${ArbolNodo} key=${h.ruta} node=${h} nivel=${nivel + 1} ctx=${ctx} />`)}
      </div>`}
    </div>
  `
}

function FormAgregar({ ctx, parentRuta, onClose }) {
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
