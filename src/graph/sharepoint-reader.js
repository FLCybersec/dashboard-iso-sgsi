// Lectura SharePoint via Graph: resuelve siteId, enumera bibliotecas (drives) y
// detecta existencia de carpetas. Solo lectura (Sites.Read.All).
//
// IMPORTANTE: los sitios son Communication Sites en espanol. Se usa SIEMPRE el
// drive (no se construyen rutas con "Shared Documents" / "Documentos
// compartidos"). El drive por defecto se obtiene con /sites/{id}/drive y las
// bibliotecas adicionales con /sites/{id}/drives (match por nombre).

import { encodePath, getAllPages } from './graph-client.js'
import { cacheGet, cacheSet } from '../lib/db.js'
import { enParalelo } from '../lib/concurrencia.js'

const TENANT_HOST = 'jmaseguridad.sharepoint.com'

// Cache de siteIds: son ESTABLES (no cambian una vez creado el sitio), asi que
// se guardan 24h en idb y se deduplican las resoluciones en vuelo (migracion y
// seguimiento piden los mismos slugs en paralelo). Un sitio inexistente (null)
// NO se cachea: puede crearse en cualquier momento.
const SITE_IDS_KEY = 'site-ids'
const SITE_IDS_TTL = 24 * 60 * 60 * 1000
let siteIdsMem = null
const enVuelo = new Map() // slug -> Promise<id|null>

async function siteIdsCache() {
  if (!siteIdsMem) siteIdsMem = (await cacheGet(SITE_IDS_KEY)) || { ids: {} }
  return siteIdsMem
}

// Resuelve el siteId a partir del slug. Devuelve null si el sitio no existe aun.
export async function resolveSiteId(client, slug) {
  const cache = await siteIdsCache()
  const hit = cache.ids[slug]
  if (hit && Date.now() - hit.t < SITE_IDS_TTL) return hit.id

  if (enVuelo.has(slug)) return enVuelo.get(slug)
  const p = (async () => {
    try {
      const site = await client
        .api(`/sites/${TENANT_HOST}:/sites/${slug}`)
        .select('id')
        .get()
      cache.ids[slug] = { id: site.id, t: Date.now() }
      cacheSet(SITE_IDS_KEY, cache).catch(() => {}) // best-effort, sin bloquear
      return site.id
    } catch (err) {
      if (err?.statusCode === 404 || err?.code === 'itemNotFound') return null
      throw err
    } finally {
      enVuelo.delete(slug)
    }
  })()
  enVuelo.set(slug, p)
  return p
}

// Id del drive por defecto del sitio (la biblioteca "Documentos compartidos").
export async function getDefaultDriveId(client, siteId) {
  const drive = await client.api(`/sites/${siteId}/drive`).select('id').get()
  return drive.id
}

// Lista las bibliotecas de documentos (drives) del sitio: [{ id, name }].
export async function listDrives(client, siteId) {
  return getAllPages(client, `/sites/${siteId}/drives`, (req) =>
    req.select('id,name')
  )
}

// Recorre recursivamente un drive y devuelve:
//   - folders: Set de rutas de carpeta existentes (minusculas, relativas a la raiz)
//   - files:   Map ruta-carpeta -> nº de archivos directos en esa carpeta
// Solo entra a carpetas que existen, asi que en sitios poco migrados el costo es
// bajo. El conteo de archivos es señal de avance de la migracion de contenido.
// Limite de llamadas Graph simultaneas por drive durante el recorrido. Con el
// lote 2026-06-12b (~500 carpetas nuevas) el Promise.all por nivel llegaba a
// cientos de llamadas a la vez y SharePoint respondia 429 hasta agotar los
// reintentos del SDK: el sitio entero quedaba "Pendiente".
const LIMITE_RECORRIDO = 8

export async function collectFolderPaths(client, driveId) {
  const folders = new Set()      // rutas en minusculas (match case-insensitive)
  const itemIds = new Set()      // itemId (driveItem) de cada carpeta: ancla estable
  const files = new Map()

  async function children(rel) {
    const base = rel
      ? `/drives/${driveId}/root:/${encodePath(rel)}:/children`
      : `/drives/${driveId}/root/children`
    return getAllPages(client, base, (req) => req.select('name,folder,file,id').top(999))
  }

  // BFS por niveles con concurrencia acotada: paralelo dentro del nivel (el
  // cuello sigue siendo O(profundidad) niveles) pero sin disparar el burst.
  let nivel = ['']
  while (nivel.length) {
    const porCarpeta = await enParalelo(nivel, LIMITE_RECORRIDO, (rel) => children(rel))
    const siguiente = []
    nivel.forEach((rel, i) => {
      let nArchivos = 0
      for (const it of porCarpeta[i]) {
        if (it.folder) {
          if (it.name === '_seguimiento') continue // carpeta de control del dashboard
          const childRel = rel ? `${rel}/${it.name}` : it.name
          folders.add(childRel.toLowerCase())
          if (it.id) itemIds.add(it.id)
          siguiente.push(childRel)
        } else {
          nArchivos++
        }
      }
      files.set(rel.toLowerCase(), nArchivos)
    })
    nivel = siguiente
  }
  return { folders, itemIds, files }
}
