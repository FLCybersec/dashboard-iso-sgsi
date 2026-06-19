// Arbol EN VIVO de carpetas reales de SharePoint (via Graph), con carga LAZY por
// nivel. Sustituye, para la vista de un sitio, al arbol derivado del maestro:
// con el equipo creando/renombrando/borrando carpetas directo, el maestro queda
// desfasado, asi que el arbol debe reflejar lo que EXISTE.
//
// Solo lectura (Sites.Read.All). Por nivel: GET /drives/{id}/root/children (raiz)
// o /drives/{id}/root:/{ruta}:/children (subcarpeta). Cada llamada devuelve los
// hijos inmediatos: las CARPETAS se vuelven nodos del arbol y los ARCHIVOS se
// cuentan para esa ruta. No se recorre todo el drive (~4214 carpetas): solo el
// nivel que el usuario expande.
//
// `itemId` de cada carpeta se conserva ya (es estable ante renombres dentro del
// mismo drive); la Tanda C lo usara para reconciliar el seguimiento al renombrar.

import { getGraphClient, encodePath, getAllPages } from '../graph/graph-client.js'
import { resolveSiteId, getDefaultDriveId } from '../graph/sharepoint-reader.js'
import { cacheGet, cacheSet } from './db.js'

const TTL_MS = 2 * 60 * 1000 // 2 minutos, igual que migration-store

// Cache en memoria por nivel: `${slug}::${ruta}` -> { fetchedAt, data }. Se
// respalda en idb (best-effort) para que un reload arranque tibio.
const memNivel = new Map()
// Drive por defecto por sitio: slug -> Promise<{ siteId, driveId } | null>.
// Un sitio inexistente resuelve null (no se reintenta en la sesion).
const memDrive = new Map()

function claveNivel(slug, ruta) {
  return `lt:${slug}::${ruta}`
}

async function ensureDrive(slug) {
  if (memDrive.has(slug)) return memDrive.get(slug)
  const p = (async () => {
    const client = getGraphClient()
    const siteId = await resolveSiteId(client, slug)
    if (!siteId) return null
    const driveId = await getDefaultDriveId(client, siteId)
    return { siteId, driveId }
  })()
  memDrive.set(slug, p)
  try {
    return await p
  } catch {
    memDrive.delete(slug) // error transitorio: permitir reintento
    return null
  }
}

async function fetchNivel(slug, ruta) {
  const drive = await ensureDrive(slug)
  if (!drive) return { existeSitio: false, folders: [], archivos: 0 }
  const client = getGraphClient()
  const base = ruta
    ? `/drives/${drive.driveId}/root:/${encodePath(ruta)}:/children`
    : `/drives/${drive.driveId}/root/children`
  const items = await getAllPages(client, base, (req) =>
    req.select('name,folder,file,id').top(999)
  )
  const folders = []
  let archivos = 0
  for (const it of items) {
    if (it.folder) {
      // Se omiten las carpetas de control del propio dashboard.
      if (it.name === '_seguimiento') continue
      folders.push({
        nombre: it.name,
        ruta: ruta ? `${ruta}/${it.name}` : it.name,
        itemId: it.id,
        childCount: typeof it.folder.childCount === 'number' ? it.folder.childCount : 0
      })
    } else if (it.file) {
      archivos++
    }
  }
  folders.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  return { existeSitio: true, folders, archivos }
}

// Hijos inmediatos de `ruta` en el sitio. Cache memoria + idb (TTL 2 min); `force`
// la salta y reescribe. Devuelve { existeSitio, folders:[{nombre,ruta,itemId,childCount}], archivos }.
export async function getChildren(slug, ruta = '', { force = false } = {}) {
  const key = claveNivel(slug, ruta)
  if (!force) {
    const m = memNivel.get(key)
    if (m && Date.now() - m.fetchedAt < TTL_MS) return m.data
    const c = await cacheGet(key)
    if (c && Date.now() - c.fetchedAt < TTL_MS) {
      memNivel.set(key, c)
      return c.data
    }
  }
  const data = await fetchNivel(slug, ruta)
  const entry = { fetchedAt: Date.now(), data }
  memNivel.set(key, entry)
  cacheSet(key, entry).catch(() => {}) // best-effort, sin bloquear
  return data
}

// Invalida la cache en memoria de TODOS los niveles de un sitio (el boton
// "Actualizar"). La copia en idb se sobreescribe en el proximo fetch forzado.
export function invalidateSitio(slug) {
  const prefijo = `lt:${slug}::`
  for (const k of [...memNivel.keys()]) {
    if (k.startsWith(prefijo)) memNivel.delete(k)
  }
}
