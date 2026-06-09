import { html } from 'htm/preact'
import { useState } from 'preact/hooks'
import { UsuariosView } from './UsuariosView.js'
import { ApoyoView } from './ApoyoView.js'

// "Personas": combina Por usuario y Por apoyo en pestañas (no dos menus).
export function PersonasView() {
  const [tab, setTab] = useState('usuario')
  return html`
    <div class="view-head"><h1>Personas</h1></div>
    <div class="tabs">
      <button class=${`tab ${tab === 'usuario' ? 'on' : ''}`} onClick=${() => setTab('usuario')}>Por usuario</button>
      <button class=${`tab ${tab === 'apoyo' ? 'on' : ''}`} onClick=${() => setTab('apoyo')} data-testid="tab-apoyo">Por apoyo</button>
    </div>
    ${tab === 'usuario' ? html`<${UsuariosView} embedded=${true} />` : html`<${ApoyoView} embedded=${true} />`}
  `
}
