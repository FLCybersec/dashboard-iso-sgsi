import { html } from 'htm/preact'
import { useState, useEffect, useCallback } from 'preact/hooks'
import { route } from 'preact-router'
import { Cargando } from './Cargando.js'
import { loadStructure } from '../lib/structure-store.js'
import { loadMigrationState, refreshMigrationSite } from '../lib/migration-store.js'
import {
  loadSeguimiento,
  refreshSeguimientoSitio,
  updateNodo,
  statsMigracionSitio,
  getApoyoSitio,
  setApoyoSitio,
  EQUIPO_APOYO,
  accesoTemporalSitio,
  getCambiosEstructura,
  addCambioEstructura,
  setCambioEstado,
  ROSTER,
  ROLES_PERMISO,
  TIPOS_PERMISO,
  getSolicitudesPermiso,
  addSolicitudPermiso,
  setSolicitudPermisoEstado
} from '../lib/seguimiento-store.js'
import { ArbolCarpetas } from './ArbolCarpetas.js'
import { BotonActualizar } from './BotonActualizar.js'

// Vista Sitio: arbol visual de carpetas con migracion por carpeta. Cabecera con
// propietario y acceso; panel de migracion con responsable del area y Apoyo SGSI;
// avance del sitio DERIVADO. Se mantienen fases y estructura evolutiva.
export function SitioView({ slug, puedeEditar = true }) {
  const [structure, setStructure] = useState(null)
  const [sitioMig, setSitioMig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [, setTick] = useState(0)
  const rerender = () => setTick((t) => t + 1)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const st = await loadStructure()
      setStructure(st)
      // Migracion y seguimiento en paralelo: son lecturas independientes.
      const [mig] = await Promise.all([loadMigrationState(st), loadSeguimiento(st)])
      // Refrescar ESTE sitio desde SharePoint: otras sesiones (el area o el
      // admin) pueden haber agregado/aprobado solicitudes desde que cargamos.
      await refreshSeguimientoSitio(st, slug)
      setSitioMig(mig.sitios.find((s) => s.slug === slug) || null)
    } catch (e) {
      setError(e?.message || String(e))
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => {
    cargar()
  }, [cargar])

  const sitioDef = structure?.sitios.find((s) => s.slug === slug)

  const acciones = {
    onMigracion: async (key, estado) => {
      await updateNodo(structure, { key, migracionEstado: estado })
      rerender()
    },
    onQuienMigra: async (key, nombre) => {
      await updateNodo(structure, { key, quienMigra: nombre })
      rerender()
    },
    // "Bloquear" se retiro de la UI (2026-06-12, pedido de Franco); solo queda
    // "desbloquear" para limpiar bloqueos historicos que sigan registrados.
    onDesbloquear: async (key) => {
      await updateNodo(structure, { key, estado: 'Pendiente', nota: 'Desbloqueada' })
      rerender()
    },
    onAgregar: async (parentRuta, nombre, clasificacion) => {
      const ruta = parentRuta ? `${parentRuta}/${nombre}` : nombre
      await addCambioEstructura(structure, { slug, tipo: 'crear', ruta, clasificacion })
      rerender()
    },
    onSobrante: async (ruta) => {
      await addCambioEstructura(structure, { slug, tipo: 'sobrante', ruta })
      rerender()
    },
    onQuitarVirtual: async (cambioId) => {
      await setCambioEstado(structure, cambioId, 'descartado')
      rerender()
    },
    // Gestion de herencias: registra la solicitud de quitar acceso a UNA
    // carpeta (entra a Aprobaciones y al export PnP; no toca permisos reales).
    onQuitarAcceso: async (ruta, persona) => {
      await addSolicitudPermiso(structure, {
        slug,
        tipo: 'quitar',
        persona,
        rol: 'Integrante',
        motivo: 'Quitar acceso a la carpeta (gestion de herencias)',
        ruta
      })
      rerender()
    }
  }

  return html`
    <div class="view-head">
      <div>
        <a class="back-link" href="/sitios" onClick=${(e) => (e.preventDefault(), route('/sitios'))}>← Sitios</a>
        <h1>${sitioDef ? sitioDef.nombre : slug}</h1>
        <div class="muted"><code>${slug}</code></div>
      </div>
      ${sitioDef &&
      html`<div class="head-derecha">
      <div class="view-head-actions">
        <${BotonActualizar} onRefreshed=${({ mig }) => { setSitioMig(mig.sitios.find((s) => s.slug === slug) || null); rerender() }} />
      </div>
      <div class="sitio-metricas">
        <div class="card" style="min-width:150px">
          <div class="num">${statsMigracionSitio(sitioDef).pct}%</div>
          <div class="lbl">Migracion: ${statsMigracionSitio(sitioDef).migradas}/${statsMigracionSitio(sitioDef).total} carpetas</div>
        </div>
        ${sitioMig &&
        html`<div class="card card-sec" style="min-width:140px">
          <div class="num sec">${sitioMig.pct}%</div>
          <div class="lbl">Estructura: ${sitioMig.creadas}/${sitioMig.total}</div>
        </div>`}
      </div>
      </div>`}
    </div>

    ${error && html`<div class="alert error">${error}</div>`}
    ${loading && html`<${Cargando} titulo="Cargando sitio..." />`}

    ${!loading && !error && !sitioDef &&
    html`<div class="alert error">No se encontro el sitio "${slug}" en la estructura maestra.</div>`}

    ${!loading &&
    sitioDef &&
    html`
      <${CabeceraSitio} sitioDef=${sitioDef} structure=${structure} slug=${slug} onChange=${rerender} puedeEditar=${puedeEditar} />

      ${sitioMig && !sitioMig.existeSitio &&
      html`<div class="alert warn">
        El sitio aun no existe en SharePoint (estructura pendiente). Aun asi puedes
        registrar el avance de migracion por carpeta y planear carpetas nuevas.
      </div>`}
      ${sitioDef.nota && html`<div class="alert info">${sitioDef.nota}</div>`}

      <h2 style="margin-top:16px">Carpetas (arbol)</h2>
      <${ArbolCarpetas} sitioDef=${sitioDef} structure=${structure} sitioMig=${sitioMig} acciones=${acciones} admin=${puedeEditar} />

      <h2 style="margin-top:28px">Informacion del sitio</h2>
      <${IndicadorSitio} sitioMig=${sitioMig} />
      <${EstructuraEvolutivaPanel}
        structure=${structure}
        slug=${slug}
        onChange=${rerender}
        puedeEditar=${puedeEditar}
        onCreada=${() => {
          // La carpeta ya existe en SharePoint: reconciliar SOLO este sitio y
          // en segundo plano (sin bloquear el marcado ni releer los 12 sitios).
          // Si falla, el TTL de 2 min o el boton "Actualizar" lo reintentan.
          refreshMigrationSite(structure, slug)
            .then((mig) => {
              if (mig) setSitioMig(mig.sitios.find((s) => s.slug === slug) || null)
            })
            .catch(() => {})
        }}
      />
      <${PermisosSolicitudPanel} structure=${structure} slug=${slug} onChange=${rerender} puedeEditar=${puedeEditar} />
    `}
  `
}

// Solicitudes de permisos: registrar agregar/quitar a una persona en el sitio.
function PermisosSolicitudPanel({ structure, slug, onChange, puedeEditar = true }) {
  const [tipo, setTipo] = useState('agregar')
  const [persona, setPersona] = useState('')
  const [rol, setRol] = useState('Integrante')
  const [motivo, setMotivo] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const solicitudes = getSolicitudesPermiso(slug)

  async function run(fn) {
    setBusy(true)
    setErr(null)
    try {
      await fn()
      onChange()
    } catch (e) {
      setErr(e?.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  async function agregar() {
    if (!persona) return
    await run(async () => {
      await addSolicitudPermiso(structure, { slug, tipo, persona, rol, motivo })
      setPersona('')
      setMotivo('')
    })
  }

  return html`
    <div class="card estructura-panel">
      <div class="fases-head">
        <strong>Solicitudes de permisos (para PnP)</strong>
        <span class="muted">solo registro; el dashboard NO cambia permisos reales</span>
      </div>
      ${puedeEditar &&
      html`<div class="nodo-line2">
        <label>
          Accion
          <select value=${tipo} onChange=${(e) => setTipo(e.target.value)} disabled=${busy}>
            ${TIPOS_PERMISO.map((t) => html`<option value=${t}>${t === 'agregar' ? 'Agregar' : 'Quitar'}</option>`)}
          </select>
        </label>
        <label>
          Persona
          <select value=${persona} onChange=${(e) => setPersona(e.target.value)} disabled=${busy}>
            <option value="">(elegir)</option>
            ${ROSTER.map((p) => html`<option value=${p}>${p}</option>`)}
          </select>
        </label>
        <label>
          Rol
          <select value=${rol} onChange=${(e) => setRol(e.target.value)} disabled=${busy}>
            ${ROLES_PERMISO.map((r) => html`<option value=${r}>${r}</option>`)}
          </select>
        </label>
        <label class="grow">
          Motivo
          <input type="text" value=${motivo} onInput=${(e) => setMotivo(e.target.value)} disabled=${busy} />
        </label>
        <button class="btn" onClick=${agregar} disabled=${busy || !persona}>Registrar</button>
      </div>
      ${err && html`<div class="nodo-status err">${err}</div>`}`}

      ${solicitudes.length > 0 &&
      html`<table class="tabla" style="margin-top:12px">
        <thead><tr><th>Accion</th><th>Persona</th><th>Rol</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          ${solicitudes.map(
            (s) => html`<tr key=${s.id}>
              <td>${s.tipo === 'agregar' ? 'Agregar' : 'Quitar'}${s.ruta ? ' (carpeta)' : ''}</td>
              <td>
                ${s.persona}
                ${s.ruta && html`<div class="muted">carpeta: <code>${s.ruta}</code></div>`}
              </td>
              <td>${s.rol}</td>
              <td><span class=${`estado-tag ${s.estado === 'aplicado' ? 'ok' : s.estado === 'descartado' ? 'pend' : 'prog'}`}>${s.estado}</span></td>
              <td>
                ${puedeEditar && s.estado === 'propuesto' &&
                html`<button class="btn secondary dark-on-light" disabled=${busy} onClick=${() => run(() => setSolicitudPermisoEstado(structure, s.id, 'aprobado'))}>Aprobar</button>`}
                ${puedeEditar && (s.estado === 'propuesto' || s.estado === 'aprobado') &&
                html`<button class="btn secondary dark-on-light" disabled=${busy} onClick=${() => run(() => setSolicitudPermisoEstado(structure, s.id, 'aplicado'))}>Aplicado</button>
                  <button class="btn secondary dark-on-light" disabled=${busy} onClick=${() => run(() => setSolicitudPermisoEstado(structure, s.id, 'descartado'))}>Descartar</button>`}
              </td>
            </tr>`
          )}
        </tbody>
      </table>`}
    </div>
  `
}

// Cabecera del sitio: propietario, acceso (con temporal) y Apoyo SGSI editable.
// Exportada: "Mi trabajo" la muestra (solo lectura) para que TODO el equipo vea
// los permisos del grupo de trabajo de su area.
export function CabeceraSitio({ sitioDef, structure, slug, onChange, puedeEditar = true }) {
  const [apoyo, setApoyo] = useState(getApoyoSitio(slug))
  const [busy, setBusy] = useState(false)
  const acceso = sitioDef.acceso || []

  async function cambiarApoyo(val) {
    setApoyo(val)
    setBusy(true)
    try {
      await setApoyoSitio(structure, slug, val)
      onChange()
    } finally {
      setBusy(false)
    }
  }

  return html`
    <div class="card cabecera-sitio">
      <div class="cab-grid">
        <div>
          <div class="muted">Responsable del area (propietario)</div>
          <strong>${sitioDef.propietario || '—'}</strong>
        </div>
        <div>
          <div class="muted">Apoyo SGSI</div>
          ${puedeEditar
            ? html`<select value=${apoyo} disabled=${busy} onChange=${(e) => cambiarApoyo(e.target.value)}>
                <option value="">(sin asignar)</option>
                ${EQUIPO_APOYO.map((n) => html`<option value=${n} selected=${n === apoyo}>${n}</option>`)}
              </select>`
            : html`<strong>${apoyo || '—'}</strong>`}
        </div>
        <div class="cab-acceso">
          <div class="muted">Acceso</div>
          <div class="acceso-list">
            ${acceso.length === 0 && html`<span class="muted">Sin acceso definido</span>`}
            ${acceso.map((nombre) => html`<span class="acceso-pill">${nombre}</span>`)}
            ${accesoTemporalSitio(sitioDef).map(
              (nombre) => html`<span class="acceso-pill"
                >${nombre}<span class="temporal">temporal</span></span
              >`
            )}
          </div>
        </div>
      </div>
      <div class="muted" style="margin-top:8px">
        El acceso del maestro es permanente; el del equipo de migracion en areas
        ajenas es temporal (a retirar al cierre). Los administradores de coleccion
        no se muestran (no leibles via Graph).
      </div>
    </div>
  `
}

// Cola de cambios de estructura (crear / sobrante) -> aprobar/aplicar para PnP.
// El REGISTRO se hace de forma visual desde el arbol (agregar / sobrante), nunca
// escribiendo rutas a mano.
function EstructuraEvolutivaPanel({ structure, slug, onChange, puedeEditar = true, onCreada = null }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const cambios = getCambiosEstructura(slug)

  async function run(fn) {
    setBusy(true)
    setErr(null)
    try {
      await fn()
      onChange()
    } catch (e) {
      setErr(e?.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  return html`
    <div class="card estructura-panel">
      <div class="fases-head">
        <strong>Cambios de estructura (cola para PnP)</strong>
        <span class="muted">se registran desde el arbol: "+ carpeta" / "sobrante"</span>
      </div>
      ${err && html`<div class="nodo-status err">${err}</div>`}

      ${cambios.length === 0
        ? html`<div class="muted">Sin solicitudes de estructura.${puedeEditar ? ' Usa el arbol de arriba para proponer una carpeta nueva o marcar una sobrante.' : ''}</div>`
        : html`<table class="tabla" style="margin-top:12px">
        <thead>
          <tr><th>Tipo</th><th>Ruta</th><th>Clasif.</th><th>Estado</th><th></th></tr>
        </thead>
        <tbody>
          ${cambios.map(
            (c) => html`<tr key=${c.id}>
              <td>${c.tipo === 'crear' ? 'Crear' : 'Sobrante'}</td>
              <td><code>${c.ruta}</code></td>
              <td>${c.clasificacion || '—'}</td>
              <td><span class=${`estado-tag ${c.estado === 'aplicado' ? 'ok' : c.estado === 'descartado' ? 'pend' : 'prog'}`}>${c.estado}</span></td>
              <td>
                ${puedeEditar && c.estado === 'propuesto' &&
                html`<button class="btn secondary dark-on-light" disabled=${busy} onClick=${() => run(() => setCambioEstado(structure, c.id, 'aprobado'))}>Aprobar</button>`}
                ${puedeEditar && (c.estado === 'propuesto' || c.estado === 'aprobado') &&
                html`<button class="btn secondary dark-on-light" disabled=${busy} onClick=${() => run(async () => {
                    await setCambioEstado(structure, c.id, 'aplicado')
                    if (c.tipo === 'crear' && onCreada) onCreada()
                  })}>Aplicado</button>
                  <button class="btn secondary dark-on-light" disabled=${busy} onClick=${() => run(() => setCambioEstado(structure, c.id, 'descartado'))}>Descartar</button>`}
              </td>
            </tr>`
          )}
        </tbody>
      </table>`}
    </div>
  `
}

// Indicador del sitio (SOLO LECTURA): "Sitio creado" (detectado via Graph) y
// "Control de versiones" (informativo: SharePoint lo trae activo por defecto en
// bibliotecas; no es verificable con los scopes actuales). Sin fases a mano.
function IndicadorSitio({ sitioMig }) {
  const creado = !!sitioMig?.existeSitio
  return html`
    <div class="card">
      <div class="fases-head">
        <strong>Indicadores del sitio</strong>
        <span class="muted">solo lectura</span>
      </div>
      <div class="indicadores">
        <div class="indicador">
          <span class=${`estr-tag ${creado ? 'ok' : 'pend'}`}>${creado ? '✓ Si' : '○ No'}</span>
          <span>Sitio creado</span>
        </div>
        <div class="indicador">
          <span class="estr-tag info">i</span>
          <span>
            Control de versiones
            <span class="muted">— informativo: las bibliotecas de SharePoint lo traen activo por defecto; no verificable via Graph con los permisos actuales.</span>
          </span>
        </div>
      </div>
    </div>
  `
}
