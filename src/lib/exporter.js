// Export de evidencia a Excel (exceljs). Genera un libro con el estado completo
// para auditoria: Resumen, Carpetas (estado efectivo), Historial, Pendientes y
// Fases. Cliente-only: arma el buffer y dispara la descarga.

import {
  estadoEfectivo,
  statsMigracionSitio,
  statsMigracionGlobal,
  statsMigracionPorPersona,
  quienMigra,
  getApoyoSitio,
  solicitudesAprobadas
} from './seguimiento-store.js'

// exceljs es pesado y solo se usa al exportar: se carga de forma diferida para
// mantenerlo fuera del bundle principal.
let ExcelJSPromise = null
function loadExcelJS() {
  if (!ExcelJSPromise) ExcelJSPromise = import('exceljs').then((m) => m.default || m)
  return ExcelJSPromise
}

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF142840' } }
const HEADER_FONT = { color: { argb: 'FFFFFFFF' }, bold: true }

function addHeader(sheet, columns) {
  sheet.columns = columns
  const row = sheet.getRow(1)
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL
    cell.font = HEADER_FONT
  })
  row.commit()
  sheet.views = [{ state: 'frozen', ySplit: 1 }]
}

function fechaArchivo(d) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`
}

export async function buildEvidenciaWorkbook({ structure, mig, seg }) {
  const ExcelJS = await loadExcelJS()
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Dashboard SGSI JMA'
  wb.created = new Date()

  // Indice rapido de existencia por clave de nodo (Graph).
  const existePorKey = new Map()
  for (const s of mig?.sitios || []) {
    for (const n of s.nodos) existePorKey.set(n.key, n.existe)
  }

  // ---- Resumen ----
  // Lidera con la MIGRACION de contenido (el eje del seguimiento); la estructura
  // (carpetas creadas via Graph) queda como dato secundario, etiquetada aparte
  // para no confundir un % con el otro.
  const rRes = wb.addWorksheet('Resumen')
  addHeader(rRes, [
    { header: 'Sitio', key: 'nombre', width: 34 },
    { header: 'Slug', key: 'slug', width: 24 },
    { header: 'Apoyo SGSI', key: 'apoyo', width: 16 },
    { header: 'Sitio creado', key: 'existe', width: 14 },
    { header: '% migracion contenido', key: 'pctMig', width: 20 },
    { header: 'Carpetas migradas', key: 'migradas', width: 18 },
    { header: 'Carpetas (total)', key: 'totalMig', width: 16 },
    { header: '% estructura (carpetas creadas)', key: 'pctEstr', width: 28 },
    { header: 'Carpetas creadas', key: 'creadas', width: 16 },
    { header: 'Ultima actualizacion', key: 'ultima', width: 22 }
  ])
  const estructuraPorSlug = new Map((mig?.sitios || []).map((s) => [s.slug, s]))
  for (const sitio of structure.sitios) {
    const m = statsMigracionSitio(sitio)
    const e = estructuraPorSlug.get(sitio.slug)
    rRes.addRow({
      nombre: sitio.nombre,
      slug: sitio.slug,
      apoyo: getApoyoSitio(sitio.slug) || '',
      existe: e?.existeSitio ? 'Si' : 'No',
      pctMig: m.pct / 100,
      migradas: m.migradas,
      totalMig: m.total,
      pctEstr: (e?.pct ?? 0) / 100,
      creadas: e?.creadas ?? 0,
      ultima: m.ultima || ''
    })
  }
  // Fila de total global (migracion de contenido).
  const g = statsMigracionGlobal(structure)
  const fila = rRes.addRow({
    nombre: 'TOTAL',
    pctMig: g.pct / 100,
    migradas: g.migradas,
    totalMig: g.total
  })
  fila.font = { bold: true }
  rRes.getColumn('pctMig').numFmt = '0%'
  rRes.getColumn('pctEstr').numFmt = '0%'

  // ---- Carpetas (migracion + estructura) ----
  const rCar = wb.addWorksheet('Carpetas')
  addHeader(rCar, [
    { header: 'Sitio', key: 'sitio', width: 22 },
    { header: 'Ruta', key: 'ruta', width: 46 },
    { header: 'Carpeta', key: 'nombre', width: 30 },
    { header: 'Clasificacion', key: 'clasificacion', width: 14 },
    { header: 'Migracion', key: 'migracion', width: 14 },
    { header: 'Quien migra', key: 'responsable', width: 22 },
    { header: 'Existe (Graph)', key: 'existe', width: 14 },
    { header: 'Estructura', key: 'estado', width: 16 },
    { header: 'Notas', key: 'notas', width: 40 },
    { header: 'Ultima modif.', key: 'ultima', width: 20 },
    { header: 'Modificado por', key: 'por', width: 22 }
  ])
  for (const sitio of structure.sitios) {
    for (const n of sitio.nodos) {
      const existe = existePorKey.get(n.key) || false
      const ov = seg?.nodos?.[n.key] || null
      const ef = estadoEfectivo(existe, ov)
      rCar.addRow({
        sitio: sitio.nombre,
        ruta: n.ruta,
        nombre: n.nombre,
        clasificacion: n.clasificacion || '',
        migracion: ov?.migracionEstado || 'Sin empezar',
        responsable: quienMigra(n.key),
        existe: existe ? 'Si' : 'No',
        estado: ef.estado,
        notas: ov?.notas || '',
        ultima: ov?.ultimaModificacion || '',
        por: ov?.modificadoPor || ''
      })
    }
  }

  // ---- Historial ----
  const rHis = wb.addWorksheet('Historial')
  addHeader(rHis, [
    { header: 'Nodo (clave)', key: 'key', width: 50 },
    { header: 'Fecha', key: 'fecha', width: 22 },
    { header: 'Migracion antes', key: 'migAntes', width: 16 },
    { header: 'Migracion nuevo', key: 'migNuevo', width: 16 },
    { header: 'Estructura antes', key: 'antes', width: 16 },
    { header: 'Estructura nuevo', key: 'nuevo', width: 16 },
    { header: 'Nota', key: 'nota', width: 40 },
    { header: 'Modificado por', key: 'por', width: 22 },
    { header: 'Email', key: 'email', width: 26 }
  ])
  for (const [key, ov] of Object.entries(seg?.nodos || {})) {
    for (const h of ov.historial || []) {
      rHis.addRow({
        key,
        fecha: h.fecha,
        migAntes: h.migracion_anterior ?? '',
        migNuevo: h.migracion_nuevo ?? '',
        antes: h.estado_anterior ?? '',
        nuevo: h.estado_nuevo ?? '',
        nota: h.nota || '',
        por: h.modificadoPor || '',
        email: h.modificadoPorEmail || ''
      })
    }
  }

  // ---- Pendientes ----
  const rPen = wb.addWorksheet('Pendientes')
  addHeader(rPen, [
    { header: 'Descripcion', key: 'descripcion', width: 50 },
    { header: 'Sitio', key: 'sitio', width: 24 },
    { header: 'Responsable', key: 'responsable', width: 20 },
    { header: 'Fecha objetivo', key: 'fechaObjetivo', width: 16 },
    { header: 'Prioridad', key: 'prioridad', width: 12 },
    { header: 'Completado', key: 'completado', width: 12 },
    { header: 'Creado', key: 'creado', width: 22 },
    { header: 'Creado por', key: 'creadoPor', width: 22 }
  ])
  for (const p of seg?.pendientes || []) {
    rPen.addRow({
      descripcion: p.descripcion,
      sitio: p.sitio || '',
      responsable: p.responsable || '',
      fechaObjetivo: p.fechaObjetivo || '',
      prioridad: p.prioridad,
      completado: p.completado ? 'Si' : 'No',
      creado: p.creado || '',
      creadoPor: p.creadoPor || ''
    })
  }

  // ---- Migracion por persona (derivada) ----
  const rPer = wb.addWorksheet('Migracion por persona')
  addHeader(rPer, [
    { header: 'Responsable', key: 'nombre', width: 28 },
    { header: 'Migradas', key: 'migradas', width: 12 },
    { header: 'Total', key: 'total', width: 10 },
    { header: '% migracion', key: 'pct', width: 12 },
    { header: 'Pendientes', key: 'pendientes', width: 12 },
    { header: 'Ultima actualizacion', key: 'ultima', width: 22 }
  ])
  for (const p of statsMigracionPorPersona(structure)) {
    rPer.addRow({
      nombre: p.nombre,
      migradas: p.migradas,
      total: p.total,
      pct: p.pct / 100,
      pendientes: p.pendientes,
      ultima: p.ultima || ''
    })
  }
  rPer.getColumn('pct').numFmt = '0%'

  // ---- Cambios de estructura (para PnP) ----
  const rCam = wb.addWorksheet('Cambios estructura')
  addHeader(rCam, [
    { header: 'Sitio', key: 'slug', width: 24 },
    { header: 'Tipo', key: 'tipo', width: 12 },
    { header: 'Ruta solicitada', key: 'ruta', width: 40 },
    { header: 'Nombre final acordado', key: 'nombreFinal', width: 40 },
    { header: 'Clasificacion', key: 'clasificacion', width: 14 },
    { header: 'Estado', key: 'estado', width: 14 },
    { header: 'Comentario', key: 'comentario', width: 40 },
    { header: 'Responsable', key: 'responsable', width: 20 },
    { header: 'Notas', key: 'notas', width: 40 },
    { header: 'Creado por', key: 'creadoPor', width: 22 }
  ])
  for (const c of seg?.cambios_estructura || []) {
    rCam.addRow({
      slug: c.slug || '',
      tipo: c.tipo,
      ruta: c.ruta,
      nombreFinal: c.nombreFinal || '',
      clasificacion: c.clasificacion || '',
      estado: c.estado,
      comentario: c.comentario || '',
      responsable: c.responsable || '',
      notas: c.notas || '',
      creadoPor: c.creadoPor || ''
    })
  }

  // ---- Indicadores por sitio (solo lectura) ----
  const rInd = wb.addWorksheet('Indicadores')
  addHeader(rInd, [
    { header: 'Sitio', key: 'sitio', width: 34 },
    { header: 'Slug', key: 'slug', width: 24 },
    { header: 'Sitio creado', key: 'creado', width: 14 },
    { header: 'Control de versiones', key: 'versiones', width: 24 }
  ])
  const existePorSlug = new Map((mig?.sitios || []).map((s) => [s.slug, s.existeSitio]))
  for (const sitio of structure.sitios) {
    rInd.addRow({
      sitio: sitio.nombre,
      slug: sitio.slug,
      creado: existePorSlug.get(sitio.slug) ? 'Si' : 'No',
      versiones: 'Informativo (no verificable via Graph)'
    })
  }

  return wb
}

// Genera el archivo y dispara la descarga en el navegador.
export async function exportEvidencia(data) {
  const wb = await buildEvidenciaWorkbook(data)
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  })
  const nombre = `Evidencia-SGSI-${fechaArchivo(new Date())}.xlsx`
  descargar(blob, nombre)
  return nombre
}

function descargar(blob, nombre) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function csvCampo(v) {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// Export de solicitudes APROBADAS (no aplicadas): cambios de estructura +
// solicitudes de permisos, en CSV y JSON para PnP. Solo se exporta lo aprobado.
export function exportSolicitudesAprobadas() {
  const pend = solicitudesAprobadas()
  const total = pend.cambios_estructura.length + pend.solicitudes_permisos.length

  // Sin solicitudes aprobadas no hay nada que exportar: no generamos archivos
  // vacios (solo encabezado), que confunden al revisarlos.
  if (total === 0) return { total: 0 }

  const fecha = fechaArchivo(new Date())

  // CSV unificado.
  const cab = ['Categoria', 'Sitio', 'Tipo/Accion', 'Ruta/Persona', 'Nombre final', 'Detalle', 'Estado', 'Solicitante']
  const lineas = [cab.join(',')]
  for (const c of pend.cambios_estructura) {
    const detalle = [c.clasificacion || c.notas || '', c.comentario].filter(Boolean).join(' — ')
    lineas.push(['estructura', c.slug, c.tipo, c.ruta, c.nombreFinal || '', detalle, c.estado, c.creadoPor || ''].map(csvCampo).join(','))
  }
  for (const p of pend.solicitudes_permisos) {
    const detalle = [`${p.rol}${p.motivo ? ' — ' + p.motivo : ''}`, p.ruta ? `carpeta: ${p.ruta}` : '', p.comentario]
      .filter(Boolean)
      .join(' — ')
    // `Ruta/Persona` lleva persona; si la solicitud es POR CARPETA (gestion de
    // herencias) la ruta va en el detalle y en el JSON (campo `ruta`).
    lineas.push(['permiso', p.slug, p.tipo, p.persona, '', detalle, p.estado, p.creadoPor || ''].map(csvCampo).join(','))
  }
  const csv = new Blob(['﻿' + lineas.join('\r\n')], { type: 'text/csv;charset=utf-8' })
  descargar(csv, `SolicitudesAprobadas-PnP-${fecha}.csv`)

  // JSON estructurado (directo para generar scripts PnP).
  const json = new Blob([JSON.stringify({ generado: new Date().toISOString(), ...pend }, null, 2)], {
    type: 'application/json'
  })
  descargar(json, `SolicitudesAprobadas-PnP-${fecha}.json`)

  return { total }
}

// Export de cambios de estructura a CSV plano (lista de trabajo para PnP).
// `tipoFiltro` opcional ('crear' | 'sobrante') para acotar.
export function exportCambiosCSV({ seg }, tipoFiltro = null) {
  const cols = ['slug', 'tipo', 'ruta', 'clasificacion', 'estado', 'responsable', 'notas', 'creadoPor']
  const cabecera = ['Sitio', 'Tipo', 'Ruta', 'Clasificacion', 'Estado', 'Responsable', 'Notas', 'CreadoPor']
  const items = (seg?.cambios_estructura || []).filter((c) => (tipoFiltro ? c.tipo === tipoFiltro : true))
  if (items.length === 0) return { nombre: null, total: 0 }
  const lineas = [cabecera.join(',')]
  for (const c of items) lineas.push(cols.map((k) => csvCampo(c[k])).join(','))
  const blob = new Blob(['﻿' + lineas.join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const nombre = `CambiosEstructura-PnP-${fechaArchivo(new Date())}.csv`
  descargar(blob, nombre)
  return { nombre, total: items.length }
}
