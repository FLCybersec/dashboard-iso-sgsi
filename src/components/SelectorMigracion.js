import { html } from 'htm/preact'
import { ESTADOS_MIGRACION_CARPETA, puedeVerificar } from '../lib/seguimiento-store.js'

// Selector de estado de migracion. "Verificada" queda deshabilitada si el
// usuario actual no es Apoyo SGSI ni Franco (verificacion controlada).
export function SelectorMigracion({ valor, onCambio, disabled }) {
  const verificador = puedeVerificar()
  return html`
    <select
      class="sel-mig"
      value=${valor}
      disabled=${disabled}
      onChange=${(e) => onCambio(e.target.value)}
    >
      ${ESTADOS_MIGRACION_CARPETA.map(
        (op) => html`<option
          value=${op}
          selected=${op === valor}
          disabled=${op === 'Verificada' && !verificador}
        >${op}${op === 'Verificada' && !verificador ? ' (solo apoyo)' : ''}</option>`
      )}
    </select>
  `
}
