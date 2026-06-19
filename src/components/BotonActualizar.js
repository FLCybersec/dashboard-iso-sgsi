import { html } from 'htm/preact'
import { useState } from 'preact/hooks'
import { loadStructure } from '../lib/structure-store.js'
import { loadMigrationState } from '../lib/migration-store.js'
import { loadSeguimiento } from '../lib/seguimiento-store.js'

// Boton "Actualizar" reutilizable. Por defecto fuerza la relectura del estado
// global (estructura + migracion de los 12 sitios + seguimiento) y entrega
// { st, mig } al padre. Si se pasa `refrescar` (p. ej. la vista de un sitio con
// arbol en vivo), ejecuta esa accion en su lugar (relectura acotada).
export function BotonActualizar({ onRefreshed, refrescar: refrescarProp = null }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  async function refrescar() {
    setBusy(true)
    setErr(null)
    try {
      if (refrescarProp) {
        await refrescarProp()
      } else {
        const st = await loadStructure()
        const mig = await loadMigrationState(st, { force: true })
        await loadSeguimiento(st, { force: true })
        await onRefreshed?.({ st, mig })
      }
    } catch (e) {
      setErr(e?.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  return html`
    <span class="boton-actualizar">
      <button class="btn secondary dark-on-light" onClick=${refrescar} disabled=${busy} data-testid="actualizar">
        ${busy ? 'Actualizando...' : 'Actualizar'}
      </button>
      ${err && html`<span class="nodo-status err">${err}</span>`}
    </span>
  `
}
