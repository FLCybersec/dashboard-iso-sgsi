// Estado de migracion (estado real detectado via Graph) + cache idb.
//
// Por cada sitio del maestro: resuelve siteId, enumera sus drives y marca cada
// nodo como existente o pendiente. Si el sitio no existe, todos sus nodos
// quedan "Pendiente" sin romper. Tanda 2 solo detecta existencia; el override
// manual (seguimiento) llega en la Tanda 3.

import { getGraphClient } from '../graph/graph-client.js'
import {
  resolveSiteId,
  getDefaultDriveId,
  collectFolderPaths
} from '../graph/sharepoint-reader.js'
import { cacheGet, cacheSet, cacheDelete } from './db.js'

const CACHE_KEY = 'migration-state'
const TTL_MS = 2 * 60 * 1000 // 2 minutos

// Detecta el estado de un sitio. Nunca lanza por sitio inexistente; los errores
// de red/permisos se reportan en `warning` y dejan los nodos como pendientes.
async function detectSite(client, sitio) {
  const base = {
    slug: sitio.slug,
    nombre: sitio.nombre,
    tipo: sitio.tipo,
    piloto: sitio.piloto
  }

  let siteId = null
  try {
    siteId = await resolveSiteId(client, sitio.slug)
  } catch (err) {
    return finalizar(base, sitio, false, () => false, `Error al resolver el sitio: ${msg(err)}`)
  }

  if (!siteId) {
    // Sitio aun no creado: todo pendiente, sin warning (es estado esperado).
    return finalizar(base, sitio, false, () => false, null)
  }

  // Todo vive en el drive por defecto ("Documentos compartidos"). En sitios
  // multi-biblioteca, las "bibliotecas" del JSON se aprovisionaron como CARPETAS
  // dentro de ese drive, asi que no se buscan drives separados: se usa la ruta
  // completa (rutaEnDrive ya incluye el nombre de la biblioteca como 1a carpeta).
  let warning = null
  let data = EMPTY
  try {
    const defaultDriveId = await getDefaultDriveId(client, siteId)
    data = await collectFolderPaths(client, defaultDriveId)
  } catch (err) {
    warning = `Error al leer la biblioteca del sitio: ${msg(err)}`
  }

  const existe = (n) => data.folders.has(n.rutaEnDrive.toLowerCase())
  const archivosDe = (n) => data.files.get(n.rutaEnDrive.toLowerCase())

  return finalizar(base, sitio, true, existe, warning, archivosDe)
}

const EMPTY = { folders: new Set(), files: new Map() }

// Construye el resultado de un sitio aplicando el predicado de existencia.
function finalizar(base, sitio, existeSitio, existe, warning, archivosDe = null) {
  const nodos = sitio.nodos.map((n) => {
    const ex = existeSitio ? !!existe(n) : false
    const archivos = existeSitio && ex && archivosDe ? archivosDe(n) : undefined
    return {
      key: n.key,
      ruta: n.ruta,
      nombre: n.nombre,
      clasificacion: n.clasificacion,
      biblioteca: n.biblioteca,
      profundidad: n.profundidad,
      existe: ex,
      archivos: typeof archivos === 'number' ? archivos : undefined
    }
  })
  const total = nodos.length
  const creadas = nodos.reduce((a, n) => a + (n.existe ? 1 : 0), 0)
  const pct = total ? Math.round((creadas / total) * 100) : 0
  return { ...base, existeSitio, total, creadas, pendientes: total - creadas, pct, warning, nodos }
}

function msg(err) {
  return err?.message || err?.code || String(err)
}

function computeGlobal(sitios) {
  const total = sitios.reduce((a, s) => a + s.total, 0)
  const creadas = sitios.reduce((a, s) => a + s.creadas, 0)
  return {
    totalCarpetas: total,
    carpetasCreadas: creadas,
    carpetasPendientes: total - creadas,
    pctGlobal: total ? Math.round((creadas / total) * 100) : 0,
    sitiosCreados: sitios.filter((s) => s.existeSitio).length,
    totalSitios: sitios.length
  }
}

// Carga el estado de migracion. Usa cache idb (TTL 2 min) salvo `force`.
export async function loadMigrationState(structure, { force = false } = {}) {
  if (!force) {
    const cached = await cacheGet(CACHE_KEY)
    if (cached && Date.now() - cached.fetchedAt < TTL_MS) {
      return { ...cached, fromCache: true }
    }
  }

  const client = getGraphClient()
  const sitios = []
  // Secuencial para no saturar Graph; el volumen (12 sitios) lo permite.
  for (const s of structure.sitios) {
    sitios.push(await detectSite(client, s))
  }

  const result = { fetchedAt: Date.now(), sitios, ...computeGlobal(sitios), fromCache: false }
  await cacheSet(CACHE_KEY, result)
  return result
}

export async function clearMigrationCache() {
  return cacheDelete(CACHE_KEY)
}
