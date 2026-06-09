import { html } from 'htm/preact'

// Estado de carga reutilizable: escena K9-aeropuerto. Perro rastreador con
// chaleco JMA olfateando, aviones de fondo. Sustituye al spinner generico de
// `.loading`. Animaciones SVG/SMIL (no requieren JS). El titulo/detalle son
// configurables por vista; los defaults describen la lectura del estado real
// en SharePoint.
export function Cargando({
  titulo = 'Rastreando en SharePoint…',
  detalle = 'Leyendo el estado real de la migracion. Esto puede tardar unos segundos.'
}) {
  return html`
    <div class="cargando-k9">
      <svg viewBox="0 0 260 150" width="300" role="img" aria-label="Perro K9 con chaleco JMA olfateando con aviones de fondo">
        <g fill="#9aa3ad">
          <g>
            <g transform="scale(0.9)">
              <path d="M1,7 Q1,5 5,5 L16,5 L24,7 Q26,7.5 24,8 L16,9 Q5,9 1,7 Z" />
              <path d="M8,8 L3,13 L7,13 L13,8 Z" />
              <path d="M4,5.5 L1,1 L4,1 L8,5.5 Z" />
            </g>
            <animateTransform attributeName="transform" type="translate" from="-50 20" to="300 20" dur="2s" repeatCount="indefinite" />
          </g>
          <g opacity="0.7">
            <g transform="scale(0.7)">
              <path d="M1,7 Q1,5 5,5 L16,5 L24,7 Q26,7.5 24,8 L16,9 Q5,9 1,7 Z" />
              <path d="M8,8 L3,13 L7,13 L13,8 Z" />
              <path d="M4,5.5 L1,1 L4,1 L8,5.5 Z" />
            </g>
            <animateTransform attributeName="transform" type="translate" from="-50 40" to="300 40" dur="2.7s" begin="0.9s" repeatCount="indefinite" />
          </g>
          <g opacity="0.85">
            <g transform="scale(0.8)">
              <path d="M1,7 Q1,5 5,5 L16,5 L24,7 Q26,7.5 24,8 L16,9 Q5,9 1,7 Z" />
              <path d="M8,8 L3,13 L7,13 L13,8 Z" />
              <path d="M4,5.5 L1,1 L4,1 L8,5.5 Z" />
            </g>
            <animateTransform attributeName="transform" type="translate" from="-50 12" to="300 12" dur="1.7s" begin="1.5s" repeatCount="indefinite" />
          </g>
        </g>
        <line x1="22" y1="124" x2="238" y2="124" stroke="var(--jma-gris-borde)" stroke-width="2" stroke-linecap="round" />
        <g>
          <animateTransform attributeName="transform" type="translate" values="0 0;0 -2;0 0" dur="1.2s" repeatCount="indefinite" />
          <g stroke="#a06a38" stroke-width="8" stroke-linecap="round">
            <line x1="84" y1="96" x2="84" y2="118">
              <animateTransform attributeName="transform" type="rotate" values="-9 84 96;9 84 96;-9 84 96" dur="0.7s" repeatCount="indefinite" />
            </line>
            <line x1="104" y1="96" x2="104" y2="118">
              <animateTransform attributeName="transform" type="rotate" values="9 104 96;-9 104 96;9 104 96" dur="0.7s" repeatCount="indefinite" />
            </line>
            <line x1="150" y1="98" x2="150" y2="118">
              <animateTransform attributeName="transform" type="rotate" values="9 150 98;-9 150 98;9 150 98" dur="0.7s" repeatCount="indefinite" />
            </line>
            <line x1="168" y1="98" x2="168" y2="118">
              <animateTransform attributeName="transform" type="rotate" values="-9 168 98;9 168 98;-9 168 98" dur="0.7s" repeatCount="indefinite" />
            </line>
          </g>
          <ellipse cx="120" cy="84" rx="52" ry="27" fill="#a06a38" />
          <path d="M70,76 Q50,62 56,44" fill="none" stroke="#a06a38" stroke-width="9" stroke-linecap="round">
            <animateTransform attributeName="transform" type="rotate" values="-16 70 76;16 70 76;-16 70 76" dur="0.45s" repeatCount="indefinite" />
          </path>
          <path d="M90,57 Q84,82 90,104" fill="none" stroke="#1c2530" stroke-width="7" stroke-linecap="round" />
          <path d="M143,57 Q151,82 144,105" fill="none" stroke="#1c2530" stroke-width="8" stroke-linecap="round" />
          <path d="M82,96 Q76,84 80,68 Q84,60 100,58 L146,60 Q154,64 154,76 L152,92 Q150,98 142,99 L92,99 Q84,99 82,96 Z" fill="#2f3640" />
          <path d="M85,96 Q120,103 150,93" fill="none" stroke="#49525d" stroke-width="1.6" />
          <rect x="102" y="76" width="34" height="16" rx="2.5" fill="#eef2f6" />
          <text x="119" y="88" font-size="11" font-weight="700" text-anchor="middle" fill="#1f3a5f" font-family="Arial, sans-serif">JMA</text>
          <g>
            <animateTransform attributeName="transform" type="rotate" values="-3 152 86;2 152 86;-3 152 86" dur="0.9s" repeatCount="indefinite" />
            <ellipse cx="152" cy="76" rx="8" ry="15" fill="#6e4423" />
            <circle cx="164" cy="92" r="20" fill="#a06a38" />
            <path d="M178,90 Q198,98 198,110 L184,113 Q173,105 169,98 Z" fill="#a06a38" />
            <circle cx="197" cy="111" r="4" fill="#3a2412" />
            <circle cx="168" cy="88" r="2.4" fill="#3a2412" />
          </g>
        </g>
        <g fill="var(--jma-gris-suave)">
          <circle cx="208" cy="106" r="2.6">
            <animate attributeName="opacity" values="0;1;0" dur="1.5s" repeatCount="indefinite" />
            <animateTransform attributeName="transform" type="translate" values="0 0;7 -10" dur="1.5s" repeatCount="indefinite" />
          </circle>
          <circle cx="208" cy="106" r="2">
            <animate attributeName="opacity" values="0;1;0" dur="1.5s" begin="0.5s" repeatCount="indefinite" />
            <animateTransform attributeName="transform" type="translate" values="0 0;12 -5" dur="1.5s" begin="0.5s" repeatCount="indefinite" />
          </circle>
          <circle cx="208" cy="106" r="1.6">
            <animate attributeName="opacity" values="0;1;0" dur="1.5s" begin="0.9s" repeatCount="indefinite" />
            <animateTransform attributeName="transform" type="translate" values="0 0;5 -12" dur="1.5s" begin="0.9s" repeatCount="indefinite" />
          </circle>
        </g>
      </svg>
      <div class="cargando-k9-txt">
        <strong>${titulo}</strong>
        <span>${detalle}</span>
      </div>
    </div>
  `
}
