// Mock de Microsoft Graph para los tests E2E. Intercepta todas las llamadas a
// graph.microsoft.com y responde de forma determinista. Por defecto: los sitios
// existen, las bibliotecas no tienen carpetas (todo "Pendiente") y el archivo de
// seguimiento aun no existe (404) pero su escritura (POST carpeta + PUT) responde
// OK, para poder probar el flujo de cambio de estado.
//
// `foldersByDrive[driveId]` = lista de RUTAS COMPLETAS de carpeta existentes en
// ese drive (p. ej. ['Consejo', 'Consejo/01.1 Actas de Sesion']). El mock deriva
// los hijos inmediatos por nivel, asi soporta deteccion anidada y multi-
// biblioteca (carpetas dentro del drive por defecto).

function json(route, body, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body)
  })
}

// Ruta del padre cuyos hijos se piden, a partir de la URL de children.
function parentRel(url) {
  const m = url.match(/\/root:\/(.*?):\/children/)
  if (!m) return '' // /root/children -> raiz
  return m[1].split('/').map(decodeURIComponent).join('/')
}

export async function mockGraph(page, opts = {}) {
  const { foldersByDrive = {}, seguimientoSeed = null } = opts
  const puts = []
  // Como SharePoint real: el GET del seguimiento devuelve lo ULTIMO escrito con
  // PUT en ese sitio (y la semilla/404 mientras no se haya escrito).
  const putsPorSitio = new Map()
  const siteIdDe = (url) => (url.match(/\/sites\/([^/]+)\//) || [])[1] || ''

  await page.route(/graph\.microsoft\.com/, async (route) => {
    const req = route.request()
    const url = req.url()
    const method = req.method()

    // Fotos (propia y de terceros): sin foto -> 404 (la UI cae a iniciales).
    if (/\/(users\/[^/]+|me)\/photo\/\$value/.test(url)) {
      return route.fulfill({ status: 404, body: '' })
    }

    // Escritura del seguimiento (PUT .../content)
    if (method === 'PUT' && /seguimiento-migracion\.json:\/content/.test(url)) {
      let bodyObj = null
      try {
        bodyObj = JSON.parse(req.postData() || '{}')
      } catch {
        bodyObj = null
      }
      puts.push(bodyObj)
      putsPorSitio.set(siteIdDe(url), bodyObj)
      return json(route, { id: 'file-seg', name: 'seguimiento-migracion.json' })
    }

    // Lectura del seguimiento (GET .../content): lo ultimo escrito en ese sitio,
    // o la semilla opcional, o 404.
    if (method === 'GET' && /seguimiento-migracion\.json:\/content/.test(url)) {
      const escrito = putsPorSitio.get(siteIdDe(url))
      if (escrito) return json(route, escrito)
      if (seguimientoSeed) return json(route, seguimientoSeed)
      return json(route, { error: { code: 'itemNotFound' } }, 404)
    }

    // Crear carpeta de control (POST root/children)
    if (method === 'POST' && /\/drive\/root\/children/.test(url)) {
      return json(route, { id: 'folder-seg', name: '_seguimiento' })
    }

    // Probe de la carpeta _seguimiento (GET root:/_seguimiento, sin children/content)
    if (
      method === 'GET' &&
      /root:\/_seguimiento$/.test(url.replace(/\?.*$/, ''))
    ) {
      return json(route, { error: { code: 'itemNotFound' } }, 404)
    }

    // Resolver siteId (GET /sites/{host}:/sites/{slug})
    if (method === 'GET' && /\/sites\/[^/]+:\/sites\//.test(url)) {
      const slug = decodeURIComponent(url.split(':/sites/')[1].split(/[?]/)[0])
      return json(route, { id: `site-${slug}` })
    }

    // Lista de bibliotecas (GET /sites/{id}/drives)
    if (method === 'GET' && /\/sites\/[^/]+\/drives(\?|$)/.test(url)) {
      return json(route, {
        value: [
          { id: 'drive-default', name: 'Documentos compartidos' },
          { id: 'drive-consejo', name: 'Consejo' },
          { id: 'drive-direccion', name: 'Direccion General' },
          { id: 'drive-gerencia', name: 'Gerencia General' }
        ]
      })
    }

    // Drive por defecto (GET /sites/{id}/drive)
    if (method === 'GET' && /\/sites\/[^/]+\/drive(\?|$)/.test(url)) {
      return json(route, { id: 'drive-default' })
    }

    // Children de un drive a cualquier nivel (raiz o subcarpeta). Devuelve los
    // hijos inmediatos derivados de las rutas completas configuradas.
    if (method === 'GET' && /\/root(\/children|:\/.*:\/children)/.test(url)) {
      const driveId = (url.match(/\/drives\/([^/]+)\//) || [])[1] || 'drive-default'
      const rel = parentRel(url)
      const prefix = rel ? `${rel}/` : ''
      const seen = new Set()
      for (const full of foldersByDrive[driveId] || []) {
        if (!full.startsWith(prefix)) continue
        const rest = full.slice(prefix.length)
        if (!rest) continue
        const seg = rest.split('/')[0]
        if (seg) seen.add(seg)
      }
      const value = [...seen].map((name) => ({ name, folder: { childCount: 0 } }))
      return json(route, { value })
    }

    // Cualquier otra cosa
    return json(route, {})
  })

  return { puts }
}
