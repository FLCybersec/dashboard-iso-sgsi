// Fotos de usuario desde Microsoft Graph. Lee /users/{upn}/photo/$value como
// blob, lo convierte a objectURL y lo cachea por upn. Si no hay foto (404) o no
// se puede leer, devuelve null para que la UI use iniciales.

import { acquireToken } from '../auth/auth-provider.js'

const GRAPH = 'https://graph.microsoft.com/v1.0'
const cache = new Map() // upn -> objectURL | null (resuelto) ; o Promise (en curso)

export function fotoCacheada(upn) {
  const v = cache.get(upn)
  return typeof v === 'string' || v === null ? v : undefined
}

export async function getFoto(upn) {
  if (!upn) return null
  const existente = cache.get(upn)
  if (existente !== undefined) return existente instanceof Promise ? existente : existente

  const p = (async () => {
    try {
      const token = await acquireToken()
      const res = await fetch(`${GRAPH}/users/${encodeURIComponent(upn)}/photo/$value`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) {
        cache.set(upn, null)
        return null
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      cache.set(upn, url)
      return url
    } catch {
      cache.set(upn, null)
      return null
    }
  })()
  cache.set(upn, p)
  return p
}

// Foto del propio usuario logueado (/me/photo, cubierto por User.Read).
export async function getFotoMe() {
  const existente = cache.get('__me__')
  if (existente !== undefined) return existente instanceof Promise ? existente : existente
  const p = (async () => {
    try {
      const token = await acquireToken()
      const res = await fetch(`${GRAPH}/me/photo/$value`, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) {
        cache.set('__me__', null)
        return null
      }
      const url = URL.createObjectURL(await res.blob())
      cache.set('__me__', url)
      return url
    } catch {
      cache.set('__me__', null)
      return null
    }
  })()
  cache.set('__me__', p)
  return p
}

export function fotoMeCacheada() {
  const v = cache.get('__me__')
  return typeof v === 'string' || v === null ? v : undefined
}

export function iniciales(nombre) {
  const partes = (nombre || '').trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[1][0]).toUpperCase()
}
