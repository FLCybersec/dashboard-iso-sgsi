// Proveedor de autenticacion: envuelve PublicClientApplication de MSAL y aplica
// la lista blanca. Expone helpers de alto nivel para el resto de la app.

import { PublicClientApplication, InteractionRequiredAuthError } from '@azure/msal-browser'
import { msalConfig, loginRequest } from './msal-config.js'
import { rolDe } from './allowed-users.js'

let msalInstance = null
let initialized = false

// Modo de pruebas E2E: se activa con ?e2e=1 en la URL. Evita el flujo
// interactivo de MSAL (popup de Microsoft, imposible de automatizar) usando una
// sesion ficticia autorizada. NO afecta el comportamiento normal de produccion.
const E2E =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('e2e') === '1'

// El correo del usuario E2E puede fijarse con ?as=correo (para probar roles).
const E2E_AS =
  typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('as') : null
const E2E_USER = {
  name: E2E_AS ? E2E_AS.split('@')[0] : 'E2E Tester',
  username: E2E_AS || 'flazzarini@jmacybersec.com'
}

// Inicializa MSAL y procesa la respuesta de redirect (si la hay).
// Debe llamarse una sola vez al arranque, antes de renderizar la app.
export async function initAuth() {
  if (initialized) return msalInstance
  if (E2E) {
    initialized = true
    return null
  }
  msalInstance = new PublicClientApplication(msalConfig)
  await msalInstance.initialize()
  await msalInstance.handleRedirectPromise()
  initialized = true
  return msalInstance
}

export function getMsal() {
  if (!msalInstance) throw new Error('MSAL no inicializado: llama initAuth() primero')
  return msalInstance
}

// Devuelve la cuenta activa (o la primera en cache), o null si no hay sesion.
export function getActiveAccount() {
  const msal = getMsal()
  let account = msal.getActiveAccount()
  if (!account) {
    const all = msal.getAllAccounts()
    account = all.length > 0 ? all[0] : null
    if (account) msal.setActiveAccount(account)
  }
  return account
}

// Email de la cuenta (username suele ser el UPN/correo).
export function accountEmail(account) {
  return account?.username || ''
}

// Usuario actual para registrar autoria (modificadoPor / modificadoPorEmail).
export function currentUser() {
  if (E2E) return { name: E2E_USER.name, email: E2E_USER.username }
  const account = getActiveAccount()
  return {
    name: account?.name || account?.username || '',
    email: account?.username || ''
  }
}

// Evalua la sesion. El dashboard se abre a todo el personal del tenant; cualquier
// usuario autenticado entra, con rol 'admin' o 'usuario'.
//   { status: 'none' }                              sin sesion
//   { status: 'ok', account, email, name, rol }     autenticado
export function evaluateSession() {
  if (E2E) {
    return { status: 'ok', account: E2E_USER, email: E2E_USER.username, name: E2E_USER.name, rol: rolDe(E2E_USER.username) }
  }
  const account = getActiveAccount()
  if (!account) return { status: 'none' }
  const email = accountEmail(account)
  return { status: 'ok', account, email, name: account.name || email, rol: rolDe(email) }
}

// Inicia login interactivo por popup. Devuelve el resultado de evaluateSession.
export async function login() {
  if (E2E) return evaluateSession()
  const msal = getMsal()
  const result = await msal.loginPopup(loginRequest)
  if (result?.account) msal.setActiveAccount(result.account)
  return evaluateSession()
}

// Logout LOCAL: limpia la cache del dashboard sin cerrar la sesion M365 global.
export async function logout() {
  if (E2E) return
  const msal = getMsal()
  await msal.clearCache()
  // Tras clearCache no queda cuenta activa; el llamador re-evalua y muestra login.
}

// Adquiere un token de acceso para Graph (silencioso, con fallback a popup).
// Se usara en tandas posteriores (lectura Graph / escritura seguimiento).
export async function acquireToken(scopes = loginRequest.scopes) {
  if (E2E) return 'e2e-token'
  const msal = getMsal()
  const account = getActiveAccount()
  if (!account) throw new Error('No hay cuenta activa para adquirir token')
  try {
    const res = await msal.acquireTokenSilent({ scopes, account })
    return res.accessToken
  } catch (err) {
    if (err instanceof InteractionRequiredAuthError) {
      const res = await msal.acquireTokenPopup({ scopes })
      return res.accessToken
    }
    throw err
  }
}
