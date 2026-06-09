// Cliente Microsoft Graph. Inyecta el access token via MSAL (auth-provider) y
// expone helpers de paginacion y codificacion de rutas.

import { Client } from '@microsoft/microsoft-graph-client'
import { acquireToken } from '../auth/auth-provider.js'

let client = null

export function getGraphClient() {
  if (client) return client
  client = Client.init({
    authProvider: async (done) => {
      try {
        done(null, await acquireToken())
      } catch (err) {
        done(err, null)
      }
    }
  })
  return client
}

// Codifica una ruta logica ("Carpeta A/Sub B") para usarla en el segmento
// `root:/{path}:` de Graph: encodeURIComponent por segmento, preservando las "/".
export function encodePath(ruta) {
  return (ruta || '')
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/')
}

// Sigue @odata.nextLink y devuelve todos los items de una coleccion.
// `build` recibe el request inicial para aplicar select/top antes de la 1a pagina.
export async function getAllPages(client, firstPath, build = (req) => req) {
  const out = []
  let res = await build(client.api(firstPath)).get()
  out.push(...(res.value || []))
  let next = res['@odata.nextLink']
  while (next) {
    res = await client.api(next).get()
    out.push(...(res.value || []))
    next = res['@odata.nextLink']
  }
  return out
}
