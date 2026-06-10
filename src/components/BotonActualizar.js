import { html } from 'htm/preact'
import { useState } from 'preact/hooks'
import { loadStructure } from '../lib/structure-store.js'
import { loadMigrationState } from '../lib/migration-store.js'
import { loadSeguimiento } from '../lib/seguimiento-store.js'

// Boton "Actualizar" reutilizable: fuerza la relectura del estado real en
// SharePoint (Graph) y del seguimiento de todos los sitios, y entrega
// { st, mig } al padre para que re-renderice con datos frescos.
export function BotonActualizar({ onRefreshed }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  async function refrescar() {
    setBusy(true)
    setErr(null)
    try {
      const st = await loadStructure()
      const mig = await loadMigrationState(st, { force: true })
      await loadSeguimiento(st, { force: true })
      await onRefreshed?.({ st, mig })
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
