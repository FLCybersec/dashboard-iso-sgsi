// Configuracion MSAL para el Dashboard SGSI (ISO 27001).
// Tenant JMA Seguridad (single-tenant). Patron SPA con PKCE, sin client secret.
//
// El Client ID corresponde al App Registration "Dashboard JMA SGSI" en Entra.
// TODO(Franco): crear el App Registration y reemplazar el placeholder de abajo.
// Pasos documentados en README.md, seccion "App Registration".
//
// App Registration esperado:
//   Nombre:        Dashboard JMA SGSI
//   Plataforma:    Single-page application (SPA, PKCE)
//   Redirect URIs: https://iso.jmacybersec.com  y  http://localhost:5173
//   Cuenta:        Single tenant
//   Permisos:      User.Read, Sites.Read.All, Files.ReadWrite.All (delegados)
//   Admin consent: requerido (lo concede Franco)

export const CLIENT_ID = '223da0ce-cb19-461d-b9c2-e8d8ecb87e1e'

export const TENANT_ID = '36ed694d-55ff-4bbf-9018-04037b362197'

export const msalConfig = {
  auth: {
    clientId: CLIENT_ID,
    authority: `https://login.microsoftonline.com/${TENANT_ID}`,
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false
  }
}

// Scopes delegados de Graph. Lectura de estructura (Sites.Read.All) y la unica
// escritura sera el seguimiento-migracion.json (Files.ReadWrite.All), en tandas
// posteriores. User.Read para el perfil del usuario que inicia sesion.
export const loginRequest = {
  scopes: ['User.Read', 'User.ReadBasic.All', 'Sites.Read.All', 'Files.ReadWrite.All'],
  prompt: 'select_account'
}

// True cuando el Client ID todavia no se ha configurado. La UI lo usa para
// mostrar un aviso claro en vez de fallar de forma cripatica al intentar login.
export const isClientIdConfigured = () =>
  CLIENT_ID && CLIENT_ID !== 'CLIENT_ID_PENDIENTE'
