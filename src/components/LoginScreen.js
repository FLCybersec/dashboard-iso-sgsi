import { html } from 'htm/preact'

// Pantalla de login. Muestra:
//  - aviso si el Client ID aun no esta configurado (placeholder),
//  - mensaje de acceso denegado si el usuario no esta en la lista blanca,
//  - errores de login.
export function LoginScreen({ session, onLogin, busy, error, configured }) {
  return html`
    <div class="login-wrap">
      <div class="login-card">
        <img
          class="login-logo"
          src="/logos/logo_jma_cybersec_horizontal_color.png"
          alt="JMA CyberSec"
        />
        <div class="kicker">SGSI · ISO 27001</div>
        <h1>Dashboard de Migracion</h1>
        <p class="sub">Seguimiento de la arquitectura documental en SharePoint</p>

        ${!configured &&
        html`<div class="alert warn">
          El App Registration aun no esta configurado
          (<code>CLIENT_ID_PENDIENTE</code>). El login estara disponible cuando
          se cargue el Client ID en <code>src/auth/msal-config.js</code>.
        </div>`}

        ${session.status === 'denied' &&
        html`<div class="alert error">
          La cuenta <strong>${session.email}</strong> no esta autorizada para
          este dashboard. Solicita acceso al administrador.
        </div>`}

        ${error &&
        html`<div class="alert error">No se pudo iniciar sesion: ${error}</div>`}

        <button class="btn" onClick=${onLogin} disabled=${busy || !configured}>
          ${busy ? 'Conectando...' : 'Iniciar sesion con Microsoft'}
        </button>

        <div class="login-foot">
          Acceso restringido. Autenticacion Microsoft Entra (single sign-on) +
          lista blanca.
        </div>
      </div>
    </div>
  `
}
