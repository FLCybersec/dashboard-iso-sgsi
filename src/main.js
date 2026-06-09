import { render } from 'preact'
import { html } from 'htm/preact'
import { initAuth } from './auth/auth-provider.js'
import { App } from './app.js'

const root = document.getElementById('app')

render(html`<div class="loading">Inicializando...</div>`, root)

initAuth()
  .then(() => {
    render(html`<${App} />`, root)
  })
  .catch((err) => {
    render(
      html`<div class="loading">
        Error al inicializar la autenticacion: ${err.message || String(err)}
      </div>`,
      root
    )
  })
