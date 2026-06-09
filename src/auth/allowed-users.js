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
// invitado B2B (cuenta externa, no corporativa) basta su correo aqui; si Entra
// emite un UPN de invitado distinto (formato ...#EXT#@...onmicrosoft.com),
// agregarlo tambien.
export const OBSERVADORES = [
  'socorro.rojas@hotmail.com' // Socorro Rojas — consultora ISO (invitada externa)
]

const normalize = (email) => (email || '').trim().toLowerCase()
const ADMIN_SET = new Set(ADMINS.map(normalize))
const OBSERVADOR_SET = new Set(OBSERVADORES.map(normalize))

export function esAdmin(email) {
  return ADMIN_SET.has(normalize(email))
}

export function esObservador(email) {
  return OBSERVADOR_SET.has(normalize(email))
}

// Rol del usuario: 'admin' | 'observador' | 'usuario'.
export function rolDe(email) {
  if (esAdmin(email)) return 'admin'
  if (esObservador(email)) return 'observador'
  return 'usuario'
}
