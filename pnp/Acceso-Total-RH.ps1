# Acceso a TODO Recursos Humanos (nivel sitio, Integrante) - 2026-06-12.
# Jorge, Rita, Miguel, Nabiki, Joel, Daniela, Martha. (Herencias finas: despues.)
# PERMISOS: autorizado por Franco (2026-06-12). No destructivo (solo agrega).
# Credenciales desde _secrets.ps1 (gitignored).
$ErrorActionPreference = "Continue"
. "$PSScriptRoot\_secrets.ps1"
$pw = if ($PnPCertPassword -is [System.Security.SecureString]) { $PnPCertPassword } else { ConvertTo-SecureString $PnPCertPassword -AsPlainText -Force }
$base = "https://jmaseguridad.sharepoint.com/sites"

$personas = @(
  "jalvarez@jmaseguridad.com",    # Jorge
  "rmarquez@jmaseguridad.com",    # Rita
  "mplantillas@jmaseguridad.com", # Miguel
  "nprolon@jmaseguridad.com",     # Nabiki
  "jlara@jmaseguridad.com",       # Joel
  "dhurtado@jmaseguridad.com",    # Daniela
  "malvarez@jmaseguridad.com"     # Martha
)

Write-Host "== Acceso a RecursosHumanos (Integrantes) ==" -ForegroundColor Cyan
Connect-PnPOnline -Url "$base/SGSI-RecursosHumanos" -ClientId $PnPClientId -Tenant $PnPTenant -CertificatePath $PnPCertPath -CertificatePassword $pw
$members = Get-PnPGroup -AssociatedMemberGroup
foreach ($u in $personas) {
  try { Add-PnPGroupMember -Group $members -LoginName $u -ErrorAction Stop; Write-Host "  + Integrante: $u" -ForegroundColor Green }
  catch { Write-Host "  (omitido/ya estaba) $u -> $($_.Exception.Message)" -ForegroundColor Yellow }
}
Write-Host "== TERMINADO ==" -ForegroundColor Cyan
