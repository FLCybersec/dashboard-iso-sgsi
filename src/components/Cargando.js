import { html } from 'htm/preact'

// Estado de carga reutilizable: perro rastreador K9 olfateando + mensaje.
// Sustituye al spinner generico de `.loading`. El titulo/detalle son
// configurables por vista; los defaults describen la lectura del estado
// real en SharePoint.
export function Cargando({
  titulo = 'Rastreando en SharePoint…',
  detalle = 'Leyendo el estado real de la migracion. Esto puede tardar unos segundos.'
}) {
  return html`
    <div class="cargando-k9">
      <svg viewBox="0 0 260 150" width="280" role="img" aria-label="Perro rastreador olfateando mientras carga">
        <line x1="22" y1="124" x2="238" y2="124" stroke="var(--jma-gris-borde)" stroke-width="2" stroke-linecap="round" />
        <g class="dog-bob">
          <g stroke="#a06a38" stroke-width="8" stroke-linecap="round">
            <line class="leg l1" x1="84" y1="96" x2="84" y2="118" />
            <line class="leg l2" x1="104" y1="96" x2="104" y2="118" />
            <line class="leg l3" x1="150" y1="98" x2="150" y2="118" />
            <line class="leg l4" x1="168" y1="98" x2="168" y2="118" />
          </g>
          <ellipse cx="120" cy="84" rx="52" ry="27" fill="#a06a38" />
          <path class="tail" d="M70,76 Q50,62 56,44" fill="none" stroke="#a06a38" stroke-width="9" stroke-linecap="round" />
          <g class="head">
            <ellipse cx="152" cy="76" rx="8" ry="15" fill="#6e4423" />
            <circle cx="164" cy="92" r="20" fill="#a06a38" />
            <path d="M178,90 Q198,98 198,110 L184,113 Q173,105 169,98 Z" fill="#a06a38" />
            <circle cx="197" cy="111" r="4" fill="#3a2412" />
            <circle cx="168" cy="88" r="2.4" fill="#3a2412" />
          </g>
        </g>
        <g class="sniff" fill="var(--jma-gris-suave)">
          <circle class="s1" cx="208" cy="106" r="2.6" />
          <circle class="s2" cx="208" cy="106" r="2" />
          <circle class="s3" cx="208" cy="106" r="1.6" />
        </g>
      </svg>
      <div class="cargando-k9-txt">
        <strong>${titulo}</strong>
        <span>${detalle}</span>
      </div>
    </div>
  `
}
