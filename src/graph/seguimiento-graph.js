// Lectura/escritura del archivo de seguimiento en el hub via Graph.
// Se usa fetch directo (token MSAL) para controlar 404 y el cuerpo crudo JSON.
//
// Ruta: /sites/{hubSiteId}/drive/root:/_seguimiento/seguimiento-migracion.json
// Unica escritura del dashboard (Files.ReadWrite.All). El dashboard NO crea
// sitios ni carpetas de la estructura SGSI; la unica carpeta que crea es su
// propia carpeta de control "_seguimiento" si no existe (ver ensureFolder).

import { acquireToken } from '../auth/auth-provider.js'
import { encodePath } from './graph-client.js'

const GRAPH = 'https://graph.microsoft.com/v1.0'
const SEG_DIR = '_seguimiento'
const SEG_FILE = 'seguimiento-migracion.json'
const SEG_PATH = `${SEG_DIR}/${SEG_FILE}`

async function authHeaders(extra = {}) {
  const token = await acquireToken()
  return { Authorization: `Bearer ${token}`, ...extra }
}

// Descarga y parsea el seguimiento. Devuelve null si aun no existe (404).
export async function downloadSeguimiento(hubSiteId) {
  const url = `${GRAPH}/sites/${hubSiteId}/drive/root:/${encodePath(SEG_PATH)}:/content`
  const res = await fetch(url, { headers: await authHeaders() })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`No se pudo leer el seguimiento (HTTP ${res.status})`)
  return res.json()
}

// Crea la carpeta de control _seguimiento si no existe (idempotente).
async function ensureFolder(hubSiteId) {
  const probe = `${GRAPH}/sites/${hubSiteId}/drive/root:/${encodePath(SEG_DIR)}`
  const res = await fetch(probe, { headers: await authHeaders() })
  if (res.ok) return
  if (res.status !== 404) {
    throw new Error(`No se pudo verificar la carpeta _seguimiento (HTTP ${res.status})`)
  }
  const create = await fetch(`${GRAPH}/sites/${hubSiteId}/drive/root/children`, {
    method: 'POST',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      name: SEG_DIR,
      folder: {},
      '@microsoft.graph.conflictBehavior': 'fail'
    })
  })
  if (!create.ok && create.status !== 409) {
    throw new Error(`No se pudo crear la carpeta _seguimiento (HTTP ${create.status})`)
  }
}

// Sube (crea o reemplaza) el archivo de seguimiento con el objeto dado.
export async function uploadSeguimiento(hubSiteId, obj) {
  await ensureFolder(hubSiteId)
  const url = `${GRAPH}/sites/${hubSiteId}/drive/root:/${encodePath(SEG_PATH)}:/content`
  const res = await fetch(url, {
    method: 'PUT',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(obj, null, 2)
  })
  if (!res.ok) throw new Error(`No se pudo guardar el seguimiento (HTTP ${res.status})`)
  return res.json()
}
