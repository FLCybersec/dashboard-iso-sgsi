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

const normalize = (email) => (email || '').trim().toLowerCase()
const ADMIN_SET = new Set(ADMINS.map(normalize))

export function esAdmin(email) {
  return ADMIN_SET.has(normalize(email))
}

// Rol del usuario: 'admin' | 'usuario'.
export function rolDe(email) {
  return esAdmin(email) ? 'admin' : 'usuario'
}
