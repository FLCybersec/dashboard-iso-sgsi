// Inventario EN VIVO de la estructura real por sitio (via Graph) + cache idb.
//
// Tras el flujo inverso (el equipo crea/renombra/borra carpetas directo), el
// dashboard ya NO compara contra el maestro: para las metricas GLOBALES recorre
// el drive de cada sitio y cuenta sus carpetas REALES (denominador de la
// migracion) y expone el conjunto de rutas/itemIds vivos (para detectar
// huerfanos del seguimiento). El arbol por sitio se lee aparte y de forma lazy
// (live-tree-store); aqui el recorrido completo solo lo piden las vistas
// globales (Resumen, Sitios, Evidencia), igual que antes.

import { getGraphClient } from '../graph/graph-client.js'
import {
  resolveSiteId,
  getDefaultDriveId,
  collectFolderPaths
} from '../graph/sharepoint-reader.js'
import { cacheGet, cacheSet, cacheDelete } from './db.js'
import { enParalelo } from './concurrencia.js'

const CACHE_KEY = 'migration-state'
// El inventario vivo (recorrido completo de ~4214 carpetas) es CARO: TTL largo
// para no repetirlo; "Actualizar" lo fuerza. NUNCA debe correr en el camino de
// render (ver peekMigrationState + carga en segundo plano en las vistas).
const TTL_MS = 15 * 60 * 1000 // 15 minutos

const EMPTY = { folders: new Set(), itemIds: new Set(), files: new Map() }

// Detecta el estado real de un sitio: existencia + nº de carpetas reales +
// conjuntos de rutas/itemIds vivos. Nunca lanza por sitio inexistente.
async function detectSite(client, sitio) {
  const base = { slug: sitio.slug, nombre: sitio.nombre, tipo: sitio.tipo, piloto: sitio.piloto }

  let siteId = null
  try {
    siteId = await resolveSiteId(client, sitio.slug)
  } catch (err) {
    return finalizar(base, false, EMPTY, `Error al resolver el sitio: ${msg(err)}`)
  }
  if (!siteId) return finalizar(base, false, EMPTY, null) // aun no creado (esperado)

  let warning = null
  let data = EMPTY
  try {
    const driveId = await getDefaultDriveId(client, siteId)
    data = await collectFolderPaths(client, driveId)
  } catch (err) {
    warning = `Error al leer la biblioteca del sitio: ${msg(err)}`
  }
  return finalizar(base, true, data, warning)
}

function finalizar(base, existeSitio, data, warning) {
  const folders = data.folders || new Set()
  return {
    ...base,
    existeSitio,
    totalCarpetas: folders.size,
    folders,
    itemIds: data.itemIds || new Set(),
    warning
  }
}

function msg(err) {
  return err?.message || err?.code || String(err)
}

function computeGlobal(sitios) {
  return {
    totalCarpetas: sitios.reduce((a, s) => a + (s.totalCarpetas || 0), 0),
    totalSitios: sitios.length,
    sitiosCreados: sitios.filter((s) => s.existeSitio).length
  }
}

// Lectura RAPIDA del inventario cacheado (idb), sin tocar Graph: devuelve lo que
// haya (aunque este vencido) o null. Para que las vistas globales pinten YA y
// disparen el recorrido vivo en segundo plano (stale-while-revalidate).
export async function peekMigrationState() {
  return (await cacheGet(CACHE_KEY)) || null
}

// Carga el inventario vivo de los 12 sitios. Usa cache idb (TTL) salvo `force`.
// OJO: si no hay cache fresca, recorre todo (caro, minutos). Las vistas NO deben
// awaitarla en el camino de render: peek + segundo plano.
export async function loadMigrationState(structure, { force = false } = {}) {
  if (!force) {
    const cached = await cacheGet(CACHE_KEY)
    if (cached && Date.now() - cached.fetchedAt < TTL_MS) {
      return { ...cached, fromCache: true }
    }
  }

  const client = getGraphClient()
  // Sitios en PARALELO (limite 4) para no provocar throttling de Graph.
  const sitios = await enParalelo(structure.sitios, 4, (s) => detectSite(client, s))

  const result = { fetchedAt: Date.now(), sitios, ...computeGlobal(sitios), fromCache: false }
  await cacheSet(CACHE_KEY, result)
  return result
}

// Re-detecta SOLO un sitio y actualiza la cache global. Devuelve el estado
// completo actualizado, o null si no hay cache previa.
export async function refreshMigrationSite(structure, slug) {
  const sitioDef = structure.sitios.find((s) => s.slug === slug)
  if (!sitioDef) return null
  const detectado = await detectSite(getGraphClient(), sitioDef)
  const cached = await cacheGet(CACHE_KEY)
  if (!cached) return null
  const sitios = cached.sitios.map((s) => (s.slug === slug ? detectado : s))
  const result = { ...cached, sitios, ...computeGlobal(sitios), fromCache: false }
  await cacheSet(CACHE_KEY, result)
  return result
}

export async function clearMigrationCache() {
  return cacheDelete(CACHE_KEY)
}
