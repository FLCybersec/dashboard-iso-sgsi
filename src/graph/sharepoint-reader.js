// Lectura SharePoint via Graph: resuelve siteId, enumera bibliotecas (drives) y
// detecta existencia de carpetas. Solo lectura (Sites.Read.All).
//
// IMPORTANTE: los sitios son Communication Sites en espanol. Se usa SIEMPRE el
// drive (no se construyen rutas con "Shared Documents" / "Documentos
// compartidos"). El drive por defecto se obtiene con /sites/{id}/drive y las
// bibliotecas adicionales con /sites/{id}/drives (match por nombre).

import { encodePath, getAllPages } from './graph-client.js'

const TENANT_HOST = 'jmaseguridad.sharepoint.com'

// Resuelve el siteId a partir del slug. Devuelve null si el sitio no existe aun.
export async function resolveSiteId(client, slug) {
  try {
    const site = await client
      .api(`/sites/${TENANT_HOST}:/sites/${slug}`)
      .select('id')
      .get()
    return site.id
  } catch (err) {
    if (err?.statusCode === 404 || err?.code === 'itemNotFound') return null
    throw err
  }
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
export async function collectFolderPaths(client, driveId) {
  const folders = new Set()
  const files = new Map()

  async function children(rel) {
    const base = rel
      ? `/drives/${driveId}/root:/${encodePath(rel)}:/children`
      : `/drives/${driveId}/root/children`
    return getAllPages(client, base, (req) => req.select('name,folder,file').top(999))
  }

  async function recurse(rel) {
    const items = await children(rel)
    let nArchivos = 0
    for (const it of items) {
      if (it.folder) {
        const childRel = rel ? `${rel}/${it.name}` : it.name
        folders.add(childRel.toLowerCase())
        await recurse(childRel)
      } else {
        nArchivos++
      }
    }
    files.set(rel.toLowerCase(), nArchivos)
  }

  await recurse('')
  return { folders, files }
}
