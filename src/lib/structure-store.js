// Carga y normaliza la estructura maestra del SGSI (fuente de verdad).
// El JSON vive en /public y se sirve estatico. No inventamos estructura aqui:
// solo la leemos y la aplanamos a una lista de nodos con clave canonica.
//
// Clave canonica del nodo = `${slug}::${ruta}` (estable, NO depende de
// driveItemId). Esta es la clave de contrato del seguimiento-migracion.json
// que se usara en tandas posteriores.

const MASTER_URL = '/estructura-maestra-sgsi.json'

let cache = null

// Construye un nodo plano a partir de una carpeta del arbol.
//
// `ruta`        = ruta canonica para la clave del nodo (incluye, en sitios
//                 multi-biblioteca, el nombre de la biblioteca como 1er segmento).
// `rutaEnDrive` = ruta DENTRO del drive por defecto. Al aprovisionar, las
//                 "bibliotecas" del JSON se crearon como CARPETAS dentro de la
//                 biblioteca por defecto ("Documentos compartidos"), no como
//                 drives separados. Por eso la ruta en el drive es la ruta
//                 completa (con el nombre de la biblioteca como primera carpeta).
function nodo(slug, sitioNombre, segments, carpeta, biblioteca) {
  const ruta = segments.join('/')
  const rutaEnDrive = ruta
  return {
    key: `${slug}::${ruta}`,
    slug,
    sitioNombre,
    biblioteca: biblioteca || null,
    ruta,
    rutaEnDrive,
    nombre: carpeta.nombre,
    clasificacion: carpeta.clasificacion || null,
    profundidad: segments.length - 1,
    tipo: 'carpeta'
  }
}

// Recorre recursivamente carpetas e hijos, acumulando nodos planos.
function recorrer(slug, sitioNombre, prefijo, carpetas, biblioteca, acc) {
  for (const c of carpetas || []) {
    const segments = [...prefijo, c.nombre]
    acc.push(nodo(slug, sitioNombre, segments, c, biblioteca))
    if (Array.isArray(c.hijos) && c.hijos.length) {
      recorrer(slug, sitioNombre, segments, c.hijos, biblioteca, acc)
    }
  }
}

// Aplana un sitio a sus nodos de carpeta. Soporta los tres formatos del JSON:
//   - sitio.carpetas[]            (sitio de biblioteca unica "Documents")
//   - sitio.bibliotecas[].carpetas[]  (sitio multi-biblioteca; el nombre de la
//     biblioteca es el primer segmento de la ruta)
//   - sitio.carpetasComunes[]     (_Plantillas/_Migracion/_Archivo compartidas)
function aplanarSitio(sitio) {
  const acc = []
  const { slug, nombre } = sitio

  if (Array.isArray(sitio.carpetas)) {
    recorrer(slug, nombre, [], sitio.carpetas, null, acc)
  }

  if (Array.isArray(sitio.bibliotecas)) {
    for (const bib of sitio.bibliotecas) {
      recorrer(slug, nombre, [bib.nombre], bib.carpetas, bib.nombre, acc)
    }
  }

  if (Array.isArray(sitio.carpetasComunes)) {
    recorrer(slug, nombre, [], sitio.carpetasComunes, null, acc)
  }

  return acc
}

// Carga el JSON una vez y devuelve un modelo normalizado y cacheado.
export async function loadStructure() {
  if (cache) return cache

  const res = await fetch(MASTER_URL, { cache: 'no-cache' })
  if (!res.ok) {
    throw new Error(`No se pudo cargar la estructura maestra (HTTP ${res.status})`)
  }
  const raw = await res.json()

  const sitios = (raw.sitios || []).map((s) => {
    const nodos = aplanarSitio(s)
    return {
      slug: s.slug,
      nombre: s.nombre,
      tipo: s.tipo,
      piloto: !!s.piloto,
      propietario: s.propietario || null,
      acceso: s.acceso || [],
      nota: s.nota || null,
      nodos,
      totalCarpetas: nodos.length
    }
  })

  const todosLosNodos = sitios.flatMap((s) => s.nodos)

  // Mapa de clasificaciones -> color (definido en el JSON, no inventado).
  const clasificaciones = {}
  for (const c of raw.clasificaciones || []) {
    clasificaciones[c.nivel] = { color: c.color, retencion: c.retencion }
  }

  cache = {
    proyecto: raw.proyecto,
    version: raw.version,
    generado: raw.generado,
    tenantHost: raw.tenant_host,
    hubSlug: raw.hub_slug,
    reglas: raw.reglas || [],
    clasificaciones,
    sitios,
    nodos: todosLosNodos,
    totales: {
      sitios: sitios.length,
      carpetas: todosLosNodos.length
    }
  }
  return cache
}

// Color de una clasificacion segun el JSON (fallback gris si no se reconoce).
export function colorClasificacion(estructura, nivel) {
  return estructura?.clasificaciones?.[nivel]?.color || '#6b7280'
}
