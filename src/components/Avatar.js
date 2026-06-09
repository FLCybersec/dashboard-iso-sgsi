import { html } from 'htm/preact'
import { useState, useEffect } from 'preact/hooks'
import { getFoto, fotoCacheada, getFotoMe, fotoMeCacheada, iniciales } from '../lib/fotos.js'

// Avatar con foto real de Graph o iniciales de fallback.
//   - me=true -> foto del usuario logueado (/me/photo).
//   - upn -> foto de un tercero (/users/{upn}/photo).
export function Avatar({ nombre, upn, me = false, size = 32 }) {
  const inicial = me ? fotoMeCacheada() : upn ? fotoCacheada(upn) : null
  const [url, setUrl] = useState(() => inicial ?? null)

  useEffect(() => {
    let vivo = true
    if (me) {
      if (fotoMeCacheada() === undefined) getFotoMe().then((u) => vivo && setUrl(u))
      else setUrl(fotoMeCacheada() ?? null)
    } else if (upn) {
      if (fotoCacheada(upn) === undefined) getFoto(upn).then((u) => vivo && setUrl(u))
      else setUrl(fotoCacheada(upn) ?? null)
    } else {
      setUrl(null)
    }
    return () => {
      vivo = false
    }
  }, [me, upn])

  const estilo = { width: `${size}px`, height: `${size}px` }
  if (url) return html`<img class="avatar" style=${estilo} src=${url} alt=${nombre || ''} title=${nombre || ''} />`
  return html`<span class="avatar avatar-ini" style=${estilo} title=${nombre || ''}>${iniciales(nombre)}</span>`
}
