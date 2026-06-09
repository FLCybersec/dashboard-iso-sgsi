import { render } from 'preact'
import { html } from 'htm/preact'
import { initAuth } from './auth/auth-provider.js'
import { App } from './app.js'

const root = document.getElementById('app')

const splash = (inner) => html`
  <div class="splash">
    <img
      class="splash-logo"
      src="/logos/logo_jma_cybersec_horizontal_color.png"
      alt="JMA CyberSec"
    />
    ${inner}
  </div>
`

render(
  splash(html`
    <div class="splash-spin"></div>
    <div class="splash-text">Inicializando el dashboard...</div>
  `),
  root
)

initAuth()
  .then(() => {
    render(html`<${App} />`, root)
  })
  .catch((err) => {
    render(
      splash(html`<div class="splash-error">
        No se pudo inicializar la autenticacion: ${err.message || String(err)}
      </div>`),
      root
    )
  })
