// Control de acceso por ROL. El dashboard se abre a TODO el personal del tenant
// (single-tenant): cualquier usuario autenticado entra. Los administradores ven
// todo; el resto entra a "Mi trabajo" y solo ve/edita lo suyo (el alcance real
// lo impone SharePoint via Graph delegado).

// Administradores (ven todas las vistas globales).
export const ADMINS = [
  'flazzarini@jmacybersec.com', // Franco
  'crodriguez@jmacybersec.com', // Carmen
  'etorres@jmacybersec.com', // Ezequiel
  'cgonzalez@jmacybersec.com', // Chema
  'jalvarez@jmaseguridad.com' // Jorge
]

// Observadores externos: solo lectura de TODAS las vistas globales (consultoria
// ISO, auditoria). No editan ni aprueban nada. El alcance real de datos lo impone
// igualmente SharePoint (necesitan acceso de lectura a los sitios). Para un
// invitado B2B (cuenta externa, no corporativa) basta su correo real aqui: el
// cotejo reconoce tambien el UPN de invitado que genera Entra.
export const OBSERVADORES = [
  'socorro.rojas@hotmail.com' // Socorro Rojas — consultora ISO (invitada externa)
]

const normalize = (email) => (email || '').trim().toLowerCase()
const ADMIN_SET = new Set(ADMINS.map(normalize))
const OBSERVADOR_SET = new Set(OBSERVADORES.map(normalize))

// Formas comparables de un correo. Para invitados B2B, Entra emite un UPN del
// tipo  usuario_dominio.com#EXT#@tenant.onmicrosoft.com  ; reconstruimos el
// correo original (el ultimo '_' del prefijo era la '@') para cotejarlo contra
// la lista blanca, que guarda el correo real del invitado.
function formasComparables(email) {
  const n = normalize(email)
  const formas = new Set([n])
  const i = n.indexOf('#ext#')
  if (i > 0) {
    const prefijo = n.slice(0, i) // usuario_dominio.com
    const j = prefijo.lastIndexOf('_')
    if (j > 0) formas.add(`${prefijo.slice(0, j)}@${prefijo.slice(j + 1)}`)
  }
  return [...formas]
}

const enLista = (email, set) => formasComparables(email).some((f) => set.has(f))

export function esAdmin(email) {
  return enLista(email, ADMIN_SET)
}

export function esObservador(email) {
  return enLista(email, OBSERVADOR_SET)
}

// Rol del usuario: 'admin' | 'observador' | 'usuario'.
export function rolDe(email) {
  if (esAdmin(email)) return 'admin'
  if (esObservador(email)) return 'observador'
  return 'usuario'
}
