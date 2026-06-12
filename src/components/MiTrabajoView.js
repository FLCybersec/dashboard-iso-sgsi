import { html } from 'htm/preact'
import { useState, useEffect, useCallback } from 'preact/hooks'
import { route } from 'preact-router'
import { Cargando } from './Cargando.js'
import { currentUser } from '../auth/auth-provider.js'
import { loadStructure } from '../lib/structure-store.js'
import { loadMigrationState } from '../lib/migration-store.js'
import {
  loadSeguimiento,
  refreshSeguimientoSitio,
  misCarpetas,
  misSitios,
  updateNodo,
  addCambioEstructura,
  setCambioEstado,
  addSolicitudPermiso,
  nombreDesdeUsuario,
  esPropietarioSitio
} from '../lib/seguimiento-store.js'
import { Avatar } from './Avatar.js'
import { ArbolCarpetas } from './ArbolCarpetas.js'
import { BotonActualizar } from './BotonActualizar.js'
import { CabeceraSitio } from './SitioView.js'

// "Mi trabajo" (landing): mi avance + el arbol de MI(S) area(s) para marcar el
// estado de migracion de mis carpetas y registrar solicitudes (crear/sobrante/
// acceso). No asigno "quien migra" (eso es de admin); solo reporto y solicito.
export function MiTrabajoView() {
  const [structure, setStructure] = useState(null)
  const [mig, setMig] = useState(null)
  const [datos, setDatos] = useState(null)
  const [misAreas, setMisAreas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [, setTick] = useState(0)
  const rerender = () => setTick((t) => t + 1)
  const user = currentUser()

  const recompute = useCallback((st) => {
    const u = currentUser()
    setDatos(misCarpetas(st, u))
    setMisAreas(misSitios(st, u))
  }, [])

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const st = await loadStructure()
        setStructure(st)
        const m = await loadMigrationState(st)
        setMig(m)
        await loadSeguimiento(st)
        // Refrescar mis areas desde SharePoint: las aprobaciones del admin se
        // escriben desde OTRA sesion y no estarian en la cache de esta.
        await Promise.all(misSitios(st, currentUser()).map((s) => refreshSeguimientoSitio(st, s.slug)))
        recompute(st)
      } catch (e) {
        setError(e?.message || String(e))
      } finally {
        setLoading(false)
      }
    })()
  }, [recompute])

  const miNombre = nombreDesdeUsuario(user)

  function accionesDe(slug) {
    return {
      onMigracion: async (key, estado) => {
        await updateNodo(structure, { key, migracionEstado: estado })
        recompute(structure)
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
      // Gestion de herencias (solo visible si es propietario del area):
      // registra la solicitud de quitar acceso a UNA carpeta para PnP.
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
      },
      onQuienMigra: async () => {},
      onBloquear: async () => {},
      onDesbloquear: async () => {}
    }
  }

  if (loading) return html`<${Cargando} titulo="Cargando mi trabajo..." />`
  if (error) return html`<div class="alert error">${error}</div>`

  const persona = datos?.persona
  const nombre = datos?.nombre || user.name || 'tu usuario'

  return html`
    <div class="view-head">
      <div class="usuario-id">
        <${Avatar} me=${true} nombre=${nombre} size=${44} />
        <div>
          <h1 style="margin:0">Mi trabajo</h1>
          <div class="muted">${nombre}${persona ? ` · ${persona.migradas}/${persona.total} carpetas migradas · ${persona.pct}%` : ''}</div>
        </div>
      </div>
      <div class="view-head-actions">
        <${BotonActualizar} onRefreshed=${({ st, mig }) => { setStructure(st); setMig(mig); recompute(st); rerender() }} />
      </div>
    </div>

    ${!miNombre &&
    html`<div class="alert warn">
      No pudimos identificar tu nombre en el roster a partir de tu cuenta. Pide a un
      administrador SGSI que mapee tu correo para ver tus asignaciones.
    </div>`}

    ${persona &&
    html`<div class="bar bar-lg" style="margin:10px 0 18px"><div class="bar-fill alt" style=${`width:${persona.pct}%`}></div></div>`}

    ${misAreas.length === 0
      ? html`<div class="alert info">
          Aun no tienes un area asignada. Cuando el equipo SGSI te asigne "quien
          migra" o tengas acceso a un area, su arbol aparecera aqui para reportar tu
          avance. Tambien puedes solicitar acceso abajo.
        </div>`
      : misAreas.map((sitio) => {
          const sm = mig?.sitios.find((s) => s.slug === sitio.slug) || null
          return html`<div class="mi-area" key=${sitio.slug}>
            <h2>
              <a class="site-link" href=${`/sitio/${sitio.slug}`} onClick=${(e) => (e.preventDefault(), route(`/sitio/${sitio.slug}`))}>${sitio.nombre}</a>
            </h2>
            <p class="muted" style="margin-top:-6px">
              Marca el estado de migracion de tus carpetas. "Agregar" / "sobrante" registran
              solicitudes que aprueba el equipo SGSI.
            </p>
            <${CabeceraSitio} sitioDef=${sitio} structure=${structure} slug=${sitio.slug} onChange=${rerender} puedeEditar=${false} />
            <${ArbolCarpetas}
              sitioDef=${sitio}
              structure=${structure}
              sitioMig=${sm}
              acciones=${accionesDe(sitio.slug)}
              admin=${false}
              miNombre=${miNombre}
              esPropietario=${esPropietarioSitio(miNombre, sitio)}
            />
          </div>`
        })}

    <${SolicitarAcceso} structure=${structure} miNombre=${miNombre} />
  `
}

// Solicitud de acceso a un area (entra a la cola de solicitudes de permisos).
function SolicitarAcceso({ structure, miNombre }) {
  const [slug, setSlug] = useState('')
  const [motivo, setMotivo] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  async function solicitar() {
    if (!slug) return
    setBusy(true)
    setMsg(null)
    try {
      await addSolicitudPermiso(structure, { slug, tipo: 'agregar', persona: miNombre || '(yo)', rol: 'Integrante', motivo })
      setMsg('Solicitud de acceso registrada. El equipo SGSI la revisara.')
      setSlug('')
      setMotivo('')
    } catch (e) {
      setMsg(`Error: ${e?.message || e}`)
    } finally {
      setBusy(false)
    }
  }

  return html`
    <div class="card" style="margin-top:18px">
      <div class="fases-head"><strong>Solicitar acceso a un area</strong></div>
      <div class="nodo-line2">
        <label>
          Area
          <select value=${slug} onChange=${(e) => setSlug(e.target.value)} disabled=${busy}>
            <option value="">(elegir)</option>
            ${structure.sitios.map((s) => html`<option value=${s.slug}>${s.nombre}</option>`)}
          </select>
        </label>
        <label class="grow">
          Motivo
          <input type="text" value=${motivo} onInput=${(e) => setMotivo(e.target.value)} disabled=${busy} />
        </label>
        <button class="btn" onClick=${solicitar} disabled=${busy || !slug}>Solicitar acceso</button>
      </div>
      ${msg && html`<div class="nodo-status ok">${msg}</div>`}
    </div>
  `
}
