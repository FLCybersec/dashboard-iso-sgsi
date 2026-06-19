// Seguimiento de migracion. Almacenamiento POR SITIO: cada area guarda su propio
// `_seguimiento/seguimiento-migracion.json` en su sitio, para que cada persona
// escriba donde ya tiene permiso (alcance impuesto por SharePoint via Graph
// delegado). El dashboard agrega los sitios accesibles para las vistas globales.
//
// Migracion no destructiva: el archivo legado del hub (que tenia TODO) se lee
// como semilla/respaldo; cada sitio sin archivo propio se siembra en memoria
// desde ese legado y persiste a su sitio en la primera escritura. El hub queda
// intacto. La agregacion scope-a cada sitio a su slug para no duplicar.
//
// Clave de nodo canonica: `${slug}::${ruta}`.

import { getGraphClient } from '../graph/graph-client.js'
import { resolveSiteId } from '../graph/sharepoint-reader.js'
import { enParalelo } from './concurrencia.js'
import { downloadSeguimiento, uploadSeguimiento } from '../graph/seguimiento-graph.js'
import { currentUser } from '../auth/auth-provider.js'
import { esAdmin } from '../auth/allowed-users.js'

export const ESTADOS = ['Pendiente', 'En progreso', 'Creada', 'Verificada', 'Bloqueada', 'N/A']
export const PRIORIDADES = ['alta', 'media', 'baja']
export const ESTADOS_MIGRACION_CARPETA = ['Sin empezar', 'En progreso', 'Migrada', 'Verificada']
const MIGRADAS = new Set(['Migrada', 'Verificada'])

export const TIPOS_CAMBIO = ['crear', 'sobrante']
export const ESTADOS_CAMBIO = ['propuesto', 'aprobado', 'aplicado', 'descartado']

export const EQUIPO_MIGRACION = ['Franco', 'Carmen', 'Ezequiel', 'Chema']

// ¿La persona figura en el propietario/acceso del maestro de ESTE sitio?
export function esMiembroMaestro(nombre, sitio) {
  const n = limpiarNombre(nombre).toLowerCase()
  if (!n) return false
  const enAcceso = (sitio?.acceso || []).some((a) => {
    const x = limpiarNombre(a).toLowerCase()
    return x === n || x.split(/[ /]+/)[0] === n
  })
  const propi = limpiarNombre(sitio?.propietario || '').toLowerCase()
  const enPropi = propi === n || propi.split(/[ /]+/).includes(n)
  return enAcceso || enPropi
}

// ¿La persona es el PROPIETARIO del maestro de ESTE sitio (su area propia)? A
// diferencia de `esMiembroMaestro`, ignora la lista de acceso: solo el dueno.
export function esPropietarioSitio(nombre, sitio) {
  const n = limpiarNombre(nombre).toLowerCase()
  if (!n) return false
  const propi = limpiarNombre(sitio?.propietario || '').toLowerCase()
  return propi === n || propi.split(/[ /]+/).includes(n)
}

// Miembros del equipo de migracion que en ESTE sitio tienen acceso SOLO temporal
// (es decir, no figuran en su propietario/acceso del maestro). En su area propia
// son permanentes y no llevan badge.
export function accesoTemporalSitio(sitio) {
  return EQUIPO_MIGRACION.filter((p) => !esMiembroMaestro(p, sitio))
}

export const EQUIPO_APOYO = ['Carmen', 'Ezequiel', 'Chema']

export const ROSTER = [
  'Jorge', 'Jose Maria', 'Martha', 'Franco', 'Jose Arley', 'Daniela', 'Wendy',
  'Nabiki', 'Miguel', 'Ezequiel', 'Carmen', 'America', 'Mauro', 'Juan Manuel',
  'Samuel', 'Ireri', 'Chema', 'Rita', 'Joel', 'Angel'
]

export const ROSTER_UPN = {
  Franco: 'flazzarini@jmacybersec.com',
  Ezequiel: 'etorres@jmacybersec.com',
  Carmen: 'crodriguez@jmacybersec.com',
  Chema: 'cgonzalez@jmacybersec.com',
  Jorge: 'jalvarez@jmaseguridad.com'
}

const VERIFICADORES_EMAIL = new Set([
  'flazzarini@jmacybersec.com',
  'etorres@jmacybersec.com',
  'crodriguez@jmacybersec.com',
  'cgonzalez@jmacybersec.com'
])

export function nombreDesdeEmail(email) {
  const e = (email || '').trim().toLowerCase()
  for (const [nombre, upn] of Object.entries(ROSTER_UPN)) {
    if (upn.toLowerCase() === e) return nombre
  }
  return ''
}

// Nombre del roster del usuario: por correo conocido, o por el primer nombre de
// su display name de Entra (heuristica para el personal sin UPN mapeado).
export function nombreDesdeUsuario(user) {
  const porEmail = nombreDesdeEmail(user?.email)
  if (porEmail) return porEmail
  const dn = limpiarNombre(user?.name || '').toLowerCase()
  if (!dn) return ''
  const primero = dn.split(/\s+/)[0]
  return ROSTER.find((r) => r.toLowerCase().split(/\s+/)[0] === primero) || ''
}

export function puedeVerificar() {
  return VERIFICADORES_EMAIL.has((currentUser().email || '').trim().toLowerCase())
}

export const TIPOS_PERMISO = ['agregar', 'quitar']
export const ROLES_PERMISO = ['Propietario', 'Integrante', 'Lectura']

export function limpiarNombre(nombre) {
  return (nombre || '').replace(/\s*\(.*?\)\s*/g, ' ').trim()
}

export const FASES = [
  { key: 'sitio_creado', label: 'Sitio creado' },
  { key: 'asociado_hub', label: 'Asociado al hub' },
  { key: 'carpetas_creadas', label: 'Carpetas creadas' },
  { key: 'permisos_aplicados', label: 'Permisos aplicados' },
  { key: 'retencion_aplicada', label: 'Retencion aplicada' },
  { key: 'versionado_activado', label: 'Versionado activado' },
  { key: 'sync_validado', label: 'Sync validado' }
]
function fasesVacias() {
  return FASES.reduce((acc, f) => ((acc[f.key] = false), acc), {})
}

// ---- Estado en memoria (por sitio) ----
let segPorSitio = new Map() // slug -> objeto de seguimiento (datos de ese sitio)
let siteIdPorSlug = new Map() // slug -> siteId | null
let hubSlugActual = null
let cargado = false

function emptySeg() {
  return {
    version: '1.0',
    fecha_inicial: new Date().toISOString(),
    nodos: {},
    pendientes: [],
    fases_por_sitio: {},
    migracion_por_sitio: {},
    cambios_estructura: [],
    solicitudes_permisos: [],
    // Override de clasificacion por carpeta (ruta dentro del sitio) editado por
    // admins desde el dashboard. Cada entrada: { nivel, modificadoPor, ...,
    // historial[] } (evidencia A.5.12/A.5.13). nivel null = "sin clasificar"
    // (se quito el override; vuelve a la semilla del repo).
    clasificaciones: {}
  }
}

function normalize(raw) {
  const s = raw && typeof raw === 'object' ? raw : {}
  return {
    version: s.version || '1.0',
    fecha_inicial: s.fecha_inicial || new Date().toISOString(),
    nodos: s.nodos && typeof s.nodos === 'object' ? s.nodos : {},
    pendientes: Array.isArray(s.pendientes) ? s.pendientes : [],
    fases_por_sitio: s.fases_por_sitio && typeof s.fases_por_sitio === 'object' ? s.fases_por_sitio : {},
    migracion_por_sitio: s.migracion_por_sitio && typeof s.migracion_por_sitio === 'object' ? s.migracion_por_sitio : {},
    cambios_estructura: Array.isArray(s.cambios_estructura) ? s.cambios_estructura : [],
    solicitudes_permisos: Array.isArray(s.solicitudes_permisos) ? s.solicitudes_permisos : [],
    clasificaciones: s.clasificaciones && typeof s.clasificaciones === 'object' ? s.clasificaciones : {}
  }
}

// Extrae de un seg (p. ej. el legado del hub) solo la porcion de un slug.
function scopeSeg(s, slug, hubSlug) {
  const out = emptySeg()
  if (!s) return out
  for (const [k, v] of Object.entries(s.nodos || {})) if (k.startsWith(`${slug}::`)) out.nodos[k] = v
  const incluyeSinSitio = slug === hubSlug
  out.pendientes = (s.pendientes || []).filter((p) => (p.sitio || '') === slug || (incluyeSinSitio && !(p.sitio || '')))
  if (s.fases_por_sitio?.[slug]) out.fases_por_sitio[slug] = s.fases_por_sitio[slug]
  if (s.migracion_por_sitio?.[slug]) out.migracion_por_sitio[slug] = s.migracion_por_sitio[slug]
  out.cambios_estructura = (s.cambios_estructura || []).filter((c) => c.slug === slug)
  out.solicitudes_permisos = (s.solicitudes_permisos || []).filter((x) => x.slug === slug)
  return out
}

function segDe(slug) {
  if (!segPorSitio.has(slug)) segPorSitio.set(slug, emptySeg())
  return segPorSitio.get(slug)
}

async function ensureSiteId(slug) {
  if (siteIdPorSlug.has(slug)) return siteIdPorSlug.get(slug)
  let id = null
  try {
    id = await resolveSiteId(getGraphClient(), slug)
  } catch {
    id = null
  }
  siteIdPorSlug.set(slug, id)
  return id
}

// Une en `base` (copia fresca del servidor) lo que solo existe localmente, por
// id/clave. En conflicto manda el servidor: las mutaciones se aplican DESPUES
// sobre la copia fusionada, asi que lo recien editado localmente siempre gana.
function fusionarConLocal(base, local) {
  const unionPorId = (a, b) => {
    const ids = new Set(a.map((x) => x.id))
    for (const x of b) if (!ids.has(x.id)) a.push(x)
  }
  unionPorId(base.pendientes, local.pendientes)
  unionPorId(base.cambios_estructura, local.cambios_estructura)
  unionPorId(base.solicitudes_permisos, local.solicitudes_permisos)
  for (const [k, v] of Object.entries(local.nodos)) if (!base.nodos[k]) base.nodos[k] = v
  for (const [k, v] of Object.entries(local.fases_por_sitio)) if (!(k in base.fases_por_sitio)) base.fases_por_sitio[k] = v
  for (const [k, v] of Object.entries(local.migracion_por_sitio)) if (!(k in base.migracion_por_sitio)) base.migracion_por_sitio[k] = v
  for (const [k, v] of Object.entries(local.clasificaciones)) if (!(k in base.clasificaciones)) base.clasificaciones[k] = v
  return base
}

// Re-descarga el seguimiento de UN sitio y lo funde con lo local (sin escribir).
// Para que las vistas vean solicitudes/aprobaciones hechas por otras sesiones.
export async function refreshSeguimientoSitio(structure, slug) {
  if (!cargado) {
    await loadSeguimiento(structure)
    return
  }
  const siteId = await ensureSiteId(slug)
  if (!siteId) return
  let remoto = null
  try {
    remoto = await downloadSeguimiento(siteId)
  } catch {
    remoto = null
  }
  if (remoto) segPorSitio.set(slug, fusionarConLocal(normalize(remoto), segDe(slug)))
}

// Escritura por sitio: SECUENCIAL (cola por slug) y con releido previo. El PUT
// reemplaza el archivo completo del sitio; sin re-descargar antes de mutar, una
// sesion con copia vieja borraba lo escrito por otras sesiones (p. ej. la
// subcarpeta propuesta dentro de una carpeta virtual desaparecia cuando el
// admin aprobaba el padre desde su copia cargada antes).
const colaPorSitio = new Map()
function escribirSitio(slug, mutar) {
  const previa = colaPorSitio.get(slug) || Promise.resolve()
  const turno = previa.catch(() => {}).then(async () => {
    const siteId = await ensureSiteId(slug)
    if (!siteId) throw new Error(`No tienes acceso al sitio "${slug}" o aun no existe; no se pudo guardar.`)
    let remoto = null
    try {
      remoto = await downloadSeguimiento(siteId)
    } catch {
      remoto = null
    }
    if (remoto) segPorSitio.set(slug, fusionarConLocal(normalize(remoto), segDe(slug)))
    const seg = segDe(slug)
    const out = mutar(seg)
    await uploadSeguimiento(siteId, seg)
    return out
  })
  colaPorSitio.set(slug, turno)
  return turno
}

// Carga el seguimiento de TODOS los sitios accesibles (cada uno de su sitio).
// Siembra desde el legado del hub los sitios sin archivo propio. Sitios sin
// acceso quedan vacios sin romper.
//
// SERIALIZADA: dos vistas montando a la vez (p. ej. navegar a Aprobaciones
// mientras "Mi trabajo" aun carga) disparaban dos recorridos simultaneos que
// reasignaban los mapas del modulo a mitad del otro, y una vista podia
// renderizar con datos parciales o vacios (carrera detectada con el E2E movil).
// Ahora una carga en curso se espera antes de iniciar otra, y el estado se
// publica ATOMICO (mapas locales que se asignan completos al final).
let cargaEnCurso = null

export async function loadSeguimiento(structure, { force = false } = {}) {
  while (cargaEnCurso) {
    await cargaEnCurso.catch(() => {})
  }
  if (cargado && !force) return getSeguimiento()
  cargaEnCurso = cargarSeguimiento(structure)
  try {
    return await cargaEnCurso
  } finally {
    cargaEnCurso = null
  }
}

async function cargarSeguimiento(structure) {
  const client = getGraphClient()
  const nuevosSeg = new Map()
  const nuevosIds = new Map()

  const cargarSitio = async (slug) => {
    let siteId = null
    try {
      siteId = await resolveSiteId(client, slug)
    } catch {
      siteId = null
    }
    let archivo = null
    if (siteId) {
      try {
        archivo = await downloadSeguimiento(siteId)
      } catch {
        archivo = null
      }
    }
    return { siteId, archivo }
  }

  // El hub va PRIMERO (su archivo legado es la semilla de los sitios sin
  // archivo propio); el resto en paralelo (antes era secuencial: 12 sitios x
  // 2 viajes = la mayor parte de la espera de las vistas).
  const hub = await cargarSitio(structure.hubSlug)
  const hubLegacy = hub.archivo ? normalize(hub.archivo) : null
  nuevosIds.set(structure.hubSlug, hub.siteId)
  nuevosSeg.set(structure.hubSlug, hubLegacy || emptySeg())

  const otros = structure.sitios.map((s) => s.slug).filter((s) => s !== structure.hubSlug)
  const resultados = await enParalelo(otros, 6, cargarSitio)
  otros.forEach((slug, i) => {
    const { siteId, archivo } = resultados[i]
    nuevosIds.set(slug, siteId)
    if (archivo) {
      nuevosSeg.set(slug, normalize(archivo))
    } else {
      // Semilla no destructiva desde el legado del hub (persiste a su sitio al escribir).
      nuevosSeg.set(slug, scopeSeg(hubLegacy, slug, structure.hubSlug))
    }
  })

  // Publicacion atomica: las vistas nunca ven un estado a medio poblar.
  segPorSitio = nuevosSeg
  siteIdPorSlug = nuevosIds
  hubSlugActual = structure.hubSlug
  cargado = true
  return getSeguimiento()
}

// Vista agregada (scope por slug, sin duplicar) para el export y EvidenciaView.
// Las solicitudes de permisos son la excepcion al scope: pueden vivir en un
// archivo DISTINTO a su sitio destino (el solicitante escribe donde tiene
// permiso; pedir acceso a un area ajena implica no poder escribir en ella).
// Se unen por id, prefiriendo la copia del archivo de su propio sitio.
export function getSeguimiento() {
  const agg = emptySeg()
  const solicitudes = new Map() // id -> item
  for (const [slug, s] of segPorSitio) {
    const part = scopeSeg(s, slug, hubSlugActual)
    Object.assign(agg.nodos, part.nodos)
    agg.pendientes.push(...part.pendientes)
    Object.assign(agg.fases_por_sitio, part.fases_por_sitio)
    Object.assign(agg.migracion_por_sitio, part.migracion_por_sitio)
    agg.cambios_estructura.push(...part.cambios_estructura)
    // Clasificaciones: cada sitio las guarda por ruta; se reexponen con clave
    // global `${slug}::${ruta}` (solo las que tienen nivel; null = sin override).
    for (const [ruta, e] of Object.entries(s.clasificaciones || {})) {
      const nivel = e && typeof e === 'object' ? e.nivel : e
      if (nivel) agg.clasificaciones[`${slug}::${ruta}`] = nivel
    }
    for (const x of s.solicitudes_permisos || []) {
      if (!solicitudes.has(x.id) || x.slug === slug) solicitudes.set(x.id, x)
    }
  }
  agg.solicitudes_permisos = [...solicitudes.values()]
  return agg
}

function slugDeKey(key) {
  return key.split('::')[0]
}

export function getOverride(key) {
  return segDe(slugDeKey(key)).nodos[key] || null
}

export function estadoEfectivo(existe, override) {
  if (override?.estado) return { estado: override.estado, fuente: 'manual' }
  return { estado: existe ? 'Creada' : 'Pendiente', fuente: 'auto' }
}

export function quienMigra(key) {
  const ov = segDe(slugDeKey(key)).nodos[key]
  return (ov?.quienMigra || ov?.responsable || '').trim()
}

// Override de clasificacion de una carpeta (nivel) o null si no hay. La
// clasificacion EFECTIVA = este override ?? semilla del repo ?? "sin clasificar"
// (la semilla la resuelve quien llama, con clasificacionSemilla del structure).
export function getClasifOverride(slug, ruta) {
  const e = segDe(slug).clasificaciones?.[ruta]
  const nivel = e && typeof e === 'object' ? e.nivel : e
  return nivel || null
}

// Asigna/quita el override de clasificacion de una carpeta. Solo admin (SGSI).
// nivel vacio => se quita el override (vuelve a la semilla), conservando la
// evidencia del cambio en `historial` (A.5.12/A.5.13/A.5.15).
export async function setClasificacion(structure, slug, ruta, nivel) {
  if (!cargado) await loadSeguimiento(structure)
  if (!esAdmin(currentUser().email)) {
    throw new Error('Solo un administrador (SGSI) puede cambiar la clasificacion.')
  }
  const niveles = Object.keys((structure && structure.clasificaciones) || {})
  const val = (nivel || '').trim()
  if (val && niveles.length && !niveles.includes(val)) {
    throw new Error(`Clasificacion no valida: "${val}". Debe ser una de: ${niveles.join(', ')}.`)
  }
  const user = currentUser()
  return escribirSitio(slug, (seg) => {
    const ahora = new Date().toISOString()
    const prev = seg.clasificaciones[ruta] || null
    const anterior = (prev && typeof prev === 'object' ? prev.nivel : prev) || null
    const historial = Array.isArray(prev?.historial) ? [...prev.historial] : []
    historial.push({
      fecha: ahora,
      nivel_anterior: anterior,
      nivel_nuevo: val || null,
      modificadoPor: user.name,
      modificadoPorEmail: user.email
    })
    const entry = {
      nivel: val || null,
      modificadoPor: user.name,
      modificadoPorEmail: user.email,
      ultimaModificacion: ahora,
      historial
    }
    seg.clasificaciones[ruta] = entry
    return entry
  })
}

export function migracionDeNodo(key) {
  return segDe(slugDeKey(key)).nodos[key]?.migracionEstado || 'Sin empezar'
}

// Cambios a un nodo. Verificacion controlada: "Verificada" solo Apoyo o Franco.
export async function updateNodo(
  structure,
  { key, tipo = 'carpeta', estado, migracionEstado, notas, quienMigra: quien, nota }
) {
  if (!cargado) await loadSeguimiento(structure)
  if (migracionEstado === 'Verificada' && !puedeVerificar()) {
    throw new Error('Solo el Apoyo SGSI o Franco pueden marcar "Verificada".')
  }
  if (quien !== undefined && !esAdmin(currentUser().email)) {
    throw new Error('Solo un administrador (SGSI) puede asignar "quien migra".')
  }
  const slug = slugDeKey(key)
  const user = currentUser()
  return escribirSitio(slug, (seg) => {
    const ahora = new Date().toISOString()
    const prev = seg.nodos[key] || null

    const estadoNuevo = estado ?? prev?.estado ?? null
    const migNuevo = migracionEstado !== undefined ? migracionEstado : prev?.migracionEstado ?? null
    const quienNuevo = quien !== undefined ? quien : prev?.quienMigra ?? prev?.responsable ?? ''

    const entry = {
      tipo: prev?.tipo || tipo,
      estado: estadoNuevo,
      migracionEstado: migNuevo,
      quienMigra: quienNuevo,
      notas: notas !== undefined ? notas : prev?.notas ?? '',
      ultimaModificacion: ahora,
      modificadoPor: user.name,
      modificadoPorEmail: user.email,
      historial: Array.isArray(prev?.historial) ? [...prev.historial] : []
    }
    entry.historial.push({
      fecha: ahora,
      estado_anterior: prev?.estado ?? null,
      estado_nuevo: estadoNuevo,
      migracion_anterior: prev?.migracionEstado ?? null,
      migracion_nuevo: migNuevo,
      quienMigra: quienNuevo,
      nota: nota || '',
      modificadoPor: user.name,
      modificadoPorEmail: user.email
    })

    seg.nodos[key] = entry
    return entry
  })
}

// ---- Migracion derivada ----

export function statsMigracionSitio(sitio) {
  const seg = segDe(sitio.slug)
  let migradas = 0
  let ultima = null
  for (const n of sitio.nodos) {
    const ov = seg.nodos[n.key]
    if (MIGRADAS.has(ov?.migracionEstado || 'Sin empezar')) migradas++
    if (ov?.ultimaModificacion && (!ultima || ov.ultimaModificacion > ultima)) ultima = ov.ultimaModificacion
  }
  const total = sitio.nodos.length
  return { migradas, total, pct: total ? Math.round((migradas / total) * 100) : 0, ultima }
}

export function statsMigracionGlobal(structure) {
  let migradas = 0
  let total = 0
  for (const sitio of structure.sitios) {
    const s = statsMigracionSitio(sitio)
    migradas += s.migradas
    total += s.total
  }
  return { migradas, total, pct: total ? Math.round((migradas / total) * 100) : 0 }
}

export function statsMigracionPorPersona(structure) {
  const mapa = new Map()
  const get = (nombre) => {
    if (!mapa.has(nombre)) {
      mapa.set(nombre, { nombre, upn: ROSTER_UPN[nombre] || null, carpetas: [], migradas: 0, total: 0, ultima: null, pendientes: 0 })
    }
    return mapa.get(nombre)
  }
  for (const sitio of structure.sitios) {
    const seg = segDe(sitio.slug)
    for (const n of sitio.nodos) {
      const quien = quienMigra(n.key)
      if (!quien) continue
      const ov = seg.nodos[n.key]
      const estado = ov?.migracionEstado || 'Sin empezar'
      const p = get(quien)
      p.total++
      if (MIGRADAS.has(estado)) p.migradas++
      if (ov?.ultimaModificacion && (!p.ultima || ov.ultimaModificacion > p.ultima)) p.ultima = ov.ultimaModificacion
      p.carpetas.push({ key: n.key, slug: sitio.slug, sitioNombre: sitio.nombre, ruta: n.ruta, nombre: n.nombre, estado })
    }
  }
  for (const pend of getPendientes()) {
    if (!pend.completado && pend.responsable && pend.responsable.trim()) get(pend.responsable.trim()).pendientes++
  }
  return [...mapa.values()]
    .map((p) => ({ ...p, pct: p.total ? Math.round((p.migradas / p.total) * 100) : 0 }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
}

export function misCarpetas(structure, user) {
  const nombre = nombreDesdeUsuario(user)
  const personas = statsMigracionPorPersona(structure)
  return { nombre, persona: personas.find((p) => p.nombre === nombre) || null }
}

// Sitios "de" un usuario: donde es propietario/acceso del maestro o tiene
// carpetas asignadas como quien migra. Para "Mi trabajo".
export function misSitios(structure, user) {
  const nombre = nombreDesdeUsuario(user)
  const slugs = new Set()
  for (const sitio of structure.sitios) {
    if (nombre && esMiembroMaestro(nombre, sitio)) slugs.add(sitio.slug)
    for (const n of sitio.nodos) {
      if (nombre && quienMigra(n.key) === nombre) slugs.add(sitio.slug)
    }
  }
  return structure.sitios.filter((s) => slugs.has(s.slug))
}

export function actividadReciente(structure, limite = 40) {
  const sitioPorSlug = new Map(structure.sitios.map((s) => [s.slug, s.nombre]))
  const agg = getSeguimiento()
  const eventos = []
  for (const [key, ov] of Object.entries(agg.nodos)) {
    const [slug, ruta] = key.split('::')
    for (const h of ov.historial || []) {
      eventos.push({
        fecha: h.fecha,
        sitio: sitioPorSlug.get(slug) || slug,
        slug,
        ruta: ruta || key,
        migracion: h.migracion_nuevo || null,
        quien: h.quienMigra || '',
        por: h.modificadoPor || '',
        nota: h.nota || ''
      })
    }
  }
  return eventos.sort((a, b) => (a.fecha < b.fecha ? 1 : -1)).slice(0, limite)
}

export function requiereAtencion(structure, migState) {
  const ahora = Date.now()
  const DIA = 86400000
  const migByKey = new Map()
  for (const s of migState?.sitios || []) for (const n of s.nodos) migByKey.set(n.key, n)

  const sinQuien = []
  const restringidasVacias = []
  const bloqueadas = []
  for (const sitio of structure.sitios) {
    const seg = segDe(sitio.slug)
    for (const n of sitio.nodos) {
      const ov = seg.nodos[n.key]
      const mn = migByKey.get(n.key)
      const estadoMig = ov?.migracionEstado || 'Sin empezar'
      if (!quienMigra(n.key) && !MIGRADAS.has(estadoMig)) sinQuien.push({ slug: sitio.slug, sitio: sitio.nombre, ruta: n.ruta })
      if (n.clasificacion === 'Restringida' && !MIGRADAS.has(estadoMig)) {
        restringidasVacias.push({ slug: sitio.slug, sitio: sitio.nombre, ruta: n.ruta, archivos: mn?.archivos })
      }
      if (ov?.estado === 'Bloqueada') bloqueadas.push({ slug: sitio.slug, sitio: sitio.nombre, ruta: n.ruta, motivo: ov?.notas || '' })
    }
  }

  const sitiosEstancados = []
  for (const sitio of structure.sitios) {
    const s = statsMigracionSitio(sitio)
    if (s.pct >= 100) continue
    if (s.ultima && ahora - new Date(s.ultima).getTime() > 7 * DIA) {
      sitiosEstancados.push({ slug: sitio.slug, sitio: sitio.nombre, pct: s.pct, ultima: s.ultima })
    }
  }
  return { sinQuien, restringidasVacias, bloqueadas, sitiosEstancados }
}

// ---- Apoyo SGSI por sitio ----

export function getApoyoSitio(slug) {
  return segDe(slug).migracion_por_sitio?.[slug]?.apoyo || ''
}

export async function setApoyoSitio(structure, slug, apoyo) {
  if (!cargado) await loadSeguimiento(structure)
  const val = EQUIPO_APOYO.includes(apoyo) ? apoyo : ''
  return escribirSitio(slug, (seg) => {
    seg.migracion_por_sitio[slug] = { ...(seg.migracion_por_sitio[slug] || {}), apoyo: val }
    return val
  })
}

export function statsMigracionPorApoyo(structure) {
  const out = EQUIPO_APOYO.map((nombre) => ({ nombre, sitios: [], migradas: 0, total: 0 }))
  const byName = new Map(out.map((o) => [o.nombre, o]))
  for (const sitio of structure.sitios) {
    const apoyo = getApoyoSitio(sitio.slug)
    if (!apoyo || !byName.has(apoyo)) continue
    const s = statsMigracionSitio(sitio)
    const o = byName.get(apoyo)
    o.sitios.push({ slug: sitio.slug, nombre: sitio.nombre, ...s })
    o.migradas += s.migradas
    o.total += s.total
  }
  return out.map((o) => ({ ...o, pct: o.total ? Math.round((o.migradas / o.total) * 100) : 0 }))
}

// ---- Pendientes ----

export function getPendientes() {
  return getSeguimiento().pendientes
}

function nuevoId(p) {
  return `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// Localiza el seg que contiene un item por id en un arreglo dado; devuelve {slug,item}.
function localizar(arrayName, id) {
  for (const [slug, s] of segPorSitio) {
    const item = (s[arrayName] || []).find((x) => x.id === id)
    if (item) return { slug, item }
  }
  return null
}

export async function addPendiente(structure, { descripcion, sitio, responsable, fechaObjetivo, prioridad }) {
  if (!cargado) await loadSeguimiento(structure)
  const slug = sitio || structure.hubSlug
  const item = {
    id: nuevoId('pend'),
    descripcion: (descripcion || '').slice(0, 200),
    sitio: sitio || '',
    responsable: responsable || '',
    fechaObjetivo: fechaObjetivo || '',
    prioridad: PRIORIDADES.includes(prioridad) ? prioridad : 'media',
    creado: new Date().toISOString(),
    creadoPor: currentUser().name,
    completado: false,
    completadoEn: null
  }
  return escribirSitio(slug, (seg) => {
    seg.pendientes.push(item)
    return item
  })
}

export async function updatePendiente(structure, id, patch) {
  if (!cargado) await loadSeguimiento(structure)
  const found = localizar('pendientes', id)
  if (!found) throw new Error('Pendiente no encontrado')
  return escribirSitio(found.slug, (seg) => {
    const item = seg.pendientes.find((x) => x.id === id)
    if (!item) throw new Error('Pendiente no encontrado')
    if (patch.descripcion !== undefined) item.descripcion = patch.descripcion.slice(0, 200)
    if (patch.responsable !== undefined) item.responsable = patch.responsable
    if (patch.fechaObjetivo !== undefined) item.fechaObjetivo = patch.fechaObjetivo
    if (patch.prioridad !== undefined && PRIORIDADES.includes(patch.prioridad)) item.prioridad = patch.prioridad
    return item
  })
}

export async function setPendienteCompletado(structure, id, completado) {
  if (!cargado) await loadSeguimiento(structure)
  const found = localizar('pendientes', id)
  if (!found) throw new Error('Pendiente no encontrado')
  return escribirSitio(found.slug, (seg) => {
    const item = seg.pendientes.find((x) => x.id === id)
    if (!item) throw new Error('Pendiente no encontrado')
    item.completado = !!completado
    item.completadoEn = completado ? new Date().toISOString() : null
    return item
  })
}

// ---- Fases por sitio ----

export function getFases(slug) {
  return { ...fasesVacias(), ...(segDe(slug).fases_por_sitio?.[slug] || {}) }
}

export async function setFase(structure, slug, key, value) {
  if (!cargado) await loadSeguimiento(structure)
  return escribirSitio(slug, (seg) => {
    const actual = { ...fasesVacias(), ...(seg.fases_por_sitio[slug] || {}) }
    actual[key] = !!value
    seg.fases_por_sitio[slug] = actual
    return actual
  })
}

// ---- Cambios de estructura ----

export function getCambiosEstructura(slug) {
  if (slug) return segDe(slug).cambios_estructura.filter((c) => c.slug === slug)
  return getSeguimiento().cambios_estructura
}

export async function addCambioEstructura(structure, { slug, tipo, ruta, clasificacion, responsable, notas }) {
  if (!cargado) await loadSeguimiento(structure)
  const tipoFinal = TIPOS_CAMBIO.includes(tipo) ? tipo : 'crear'
  const clasif = (clasificacion || '').trim()
  // La clasificacion es OBLIGATORIA al solicitar una carpeta nueva: es la base
  // del control de acceso y de los requisitos del SGSI (A.5.12, A.5.13, A.5.15).
  // No se permite registrar una carpeta a crear sin nivel de clasificacion.
  if (tipoFinal === 'crear') {
    const niveles = Object.keys((structure && structure.clasificaciones) || {})
    if (!clasif) {
      throw new Error('La clasificacion es obligatoria para crear una carpeta (Publica / Interna / Confidencial / Restringida).')
    }
    if (niveles.length && !niveles.includes(clasif)) {
      throw new Error(`Clasificacion no valida: "${clasif}". Debe ser una de: ${niveles.join(', ')}.`)
    }
  }
  const item = {
    id: nuevoId('cam'),
    slug: slug || '',
    tipo: tipoFinal,
    ruta: (ruta || '').trim(),
    clasificacion: clasif,
    responsable: responsable || '',
    notas: notas || '',
    estado: 'propuesto',
    creado: new Date().toISOString(),
    creadoPor: currentUser().name
  }
  return escribirSitio(slug, (seg) => {
    // Anti-duplicados (chequeo sobre la copia recien fundida con el servidor):
    // un doble clic o dos personas pidiendo la misma carpeta creaban dos
    // solicitudes con la misma ruta, y la carpeta virtual "no se podia quitar"
    // (quitar descartaba solo una). No se registra otra si ya hay una abierta.
    const dup = seg.cambios_estructura.find(
      (c) => c.tipo === item.tipo && c.ruta === item.ruta && (c.estado === 'propuesto' || c.estado === 'aprobado')
    )
    if (dup) {
      throw new Error(
        item.tipo === 'crear'
          ? `Ya hay una solicitud abierta para crear "${item.ruta}" (de ${dup.creadoPor || 'alguien del equipo'}). No se registra duplicada.`
          : `Ya hay una solicitud abierta para marcar "${item.ruta}" como sobrante. No se registra duplicada.`
      )
    }
    seg.cambios_estructura.push(item)
    return item
  })
}

// Aplica el cambio de estado + metadatos (nombre final acordado y comentario que
// se anotan al aprobar) y sella quien/cuando segun el destino. El paso a
// "aplicado" (Creada/Aplicada) es SIEMPRE manual desde Aprobaciones; no se
// autodetecta por nombre/ruta porque el nombre final puede diferir del solicitado.
function aplicarMetaEstado(item, estado, extra = {}) {
  const user = currentUser()
  const ahora = new Date().toISOString()
  if (extra.nombreFinal !== undefined) item.nombreFinal = (extra.nombreFinal || '').trim()
  if (extra.comentario !== undefined) item.comentario = (extra.comentario || '').trim()
  if (estado === 'aprobado') {
    item.aprobadoPor = user.name
    item.aprobadoPorEmail = user.email
    item.aprobadoEn = ahora
  } else if (estado === 'aplicado') {
    item.aplicadoPor = user.name
    item.aplicadoPorEmail = user.email
    item.aplicadoEn = ahora
  }
}

// Aprobar solo cambia el estado: el "nombre final" YA NO se exige aqui. El
// nombre canonico (numeral, acentos, mayusculas) lo fija Cowork al generar el
// PnP y actualizar el maestro; si se pasa en `extra` se conserva como dato
// opcional. La clasificacion sigue siendo obligatoria al SOLICITAR (addCambioEstructura).
export async function setCambioEstado(structure, id, estado, extra = {}) {
  if (!cargado) await loadSeguimiento(structure)
  const found = localizar('cambios_estructura', id)
  if (!found) throw new Error('Cambio no encontrado')
  return escribirSitio(found.item.slug || found.slug, (seg) => {
    const item = seg.cambios_estructura.find((x) => x.id === id)
    if (!item) throw new Error('Cambio no encontrado')
    if (ESTADOS_CAMBIO.includes(estado)) item.estado = estado
    aplicarMetaEstado(item, estado, extra)
    return item
  })
}

// ---- Solicitudes de permisos ----

export function getSolicitudesPermiso(slug) {
  // Siempre desde la vista agregada: una solicitud para `slug` puede vivir en
  // el archivo de otro sitio (el del solicitante).
  const todas = getSeguimiento().solicitudes_permisos
  return slug ? todas.filter((s) => s.slug === slug) : todas
}

// `ruta` (opcional) acota la solicitud a UNA carpeta del sitio: es la pieza
// para gestionar herencias finas via PnP (p. ej. "quitar a X de 04.4"). Vacia
// = solicitud a nivel sitio (comportamiento original).
export async function addSolicitudPermiso(structure, { slug, tipo, persona, rol, motivo, ruta }) {
  if (!cargado) await loadSeguimiento(structure)
  const item = {
    id: nuevoId('perm'),
    slug: slug || '',
    tipo: TIPOS_PERMISO.includes(tipo) ? tipo : 'agregar',
    persona: persona || '',
    rol: ROLES_PERMISO.includes(rol) ? rol : 'Integrante',
    motivo: motivo || '',
    ruta: (ruta || '').trim(),
    estado: 'propuesto',
    creado: new Date().toISOString(),
    creadoPor: currentUser().name
  }
  // La solicitud se guarda donde el SOLICITANTE pueda escribir: primero el
  // sitio destino (admins y miembros del area), si no su(s) propia(s) area(s),
  // si no el hub. Quien pide acceso a un area ajena NO puede escribir en ella
  // (es justo lo que esta pidiendo); antes esto fallaba para todo perfil
  // no-admin (QA #3, 2026-06-10). `item.slug` conserva el sitio DESTINO; la
  // agregacion une por id sin importar en que archivo quedo.
  const propios = misSitios(structure, currentUser()).map((s) => s.slug)
  const candidatos = [...new Set([slug, ...propios, structure.hubSlug].filter(Boolean))]
  let ultimoError = null
  for (const destino of candidatos) {
    try {
      return await escribirSitio(destino, (seg) => {
        seg.solicitudes_permisos.push(item)
        return item
      })
    } catch (e) {
      ultimoError = e
    }
  }
  throw new Error(
    `No se pudo registrar la solicitud en ningun sitio donde tengas escritura. Contacta al equipo SGSI. Detalle: ${ultimoError?.message || ultimoError}`
  )
}

// Copia "ganadora" de una solicitud: la del archivo de su propio sitio si
// existe (canonica); si no, la primera encontrada (p. ej. en el archivo del
// solicitante o en el legado del hub). Debe coincidir con la preferencia de
// la agregacion en getSeguimiento para actualizar la copia que se muestra.
function localizarSolicitud(id) {
  let primero = null
  for (const [slug, s] of segPorSitio) {
    const item = (s.solicitudes_permisos || []).find((x) => x.id === id)
    if (!item) continue
    if (!primero) primero = { slug, item }
    if (item.slug === slug) return { slug, item }
  }
  return primero
}

export async function setSolicitudPermisoEstado(structure, id, estado, extra = {}) {
  if (!cargado) await loadSeguimiento(structure)
  const found = localizarSolicitud(id)
  if (!found) throw new Error('Solicitud no encontrada')
  return escribirSitio(found.slug, (seg) => {
    const item = seg.solicitudes_permisos.find((x) => x.id === id)
    if (!item) throw new Error('Solicitud no encontrada')
    if (ESTADOS_CAMBIO.includes(estado)) item.estado = estado
    aplicarMetaEstado(item, estado, extra)
    return item
  })
}

// Solo lo APROBADO y aun no aplicado: lo unico que se exporta para PnP (spec §7).
export function solicitudesAprobadas() {
  const agg = getSeguimiento()
  return {
    cambios_estructura: agg.cambios_estructura.filter((c) => c.estado === 'aprobado'),
    solicitudes_permisos: agg.solicitudes_permisos.filter((p) => p.estado === 'aprobado')
  }
}
