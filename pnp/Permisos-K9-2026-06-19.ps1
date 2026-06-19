# Permisos K9 (peticion de Jose Arley) - 2026-06-19. App-only. Autorizado por Franco.
#   A) Jorge y Jose Maria -> PROPIETARIO de K9 (control total).
#   B) Crear carpeta del centro TOLUCA (no existia).
#   C) Centro TIJUANA (10.11 CENTROS ENTRENAMIENTO/TIJUANA): Dumar y Samuel con
#      "Editar" (rompe herencia; acceso solo a su centro).
#   D) Bajar a Samuel: quitarlo del acceso TOTAL del sitio (queda solo en TIJUANA por C).
# Director Operativo K9 = Jose Arley (ya es propietario; no se agrega a nadie).
# Centros CHIHUAHUA/CRIANZA/TOLUCA: responsables "quien determine JMA" -> pendientes.
$ErrorActionPreference = "Continue"
. "$PSScriptRoot\_secrets.ps1"
$pw = if ($PnPCertPassword -is [System.Security.SecureString]) { $PnPCertPassword } else { ConvertTo-SecureString $PnPCertPassword -AsPlainText -Force }
$base = "https://jmaseguridad.sharepoint.com/sites"
$lib  = "Documentos compartidos"
$k9   = "$base/SGSI-K9"

$jorge   = "jalvarez@jmaseguridad.com"
$josemar = "jmgonzalez@jmaseguridad.com"
$dumar   = "dlopez@jmaseguridad.com"
$samuel  = "scuevas@jmaseguridad.com"
$centroTijuana = "$lib/10.11 CENTROS ENTRENAMIENTO/TIJUANA"

Connect-PnPOnline -Url $k9 -ClientId $PnPClientId -Tenant $PnPTenant -CertificatePath $PnPCertPath -CertificatePassword $pw

# A) Jorge y Jose Maria -> Propietario
Write-Host "== A) Propietarios K9 ==" -ForegroundColor Cyan
$owners = Get-PnPGroup -AssociatedOwnerGroup
foreach ($u in @($jorge, $josemar)) {
  try { Add-PnPGroupMember -Group $owners -LoginName $u -ErrorAction Stop; Write-Host "  + Propietario: $u" -ForegroundColor Green }
  catch { Write-Host "  (omitido/ya estaba) $u -> $($_.Exception.Message)" -ForegroundColor Yellow }
}

# B) Crear carpeta TOLUCA
Write-Host "== B) Crear centro TOLUCA ==" -ForegroundColor Cyan
try { Resolve-PnPFolder -SiteRelativePath "$lib/10.11 CENTROS ENTRENAMIENTO/TOLUCA" -ErrorAction Stop | Out-Null; Write-Host "  OK: TOLUCA" -ForegroundColor Green }
catch { Write-Host "  ERROR TOLUCA -> $($_.Exception.Message)" -ForegroundColor Red }

# C) TIJUANA -> Dumar y Samuel con Editar (rompe herencia, acceso individual al centro)
Write-Host "== C) Centro TIJUANA: Dumar y Samuel (Editar) ==" -ForegroundColor Cyan
foreach ($u in @($dumar, $samuel)) {
  try { Set-PnPFolderPermission -List $lib -Identity $centroTijuana -User $u -AddRole "Editar" -ErrorAction Stop; Write-Host "  + Editar TIJUANA: $u" -ForegroundColor Green }
  catch { Write-Host "  ERROR $u en TIJUANA -> $($_.Exception.Message)" -ForegroundColor Red }
}

# D) Bajar a Samuel: quitarlo del acceso TOTAL del sitio (Integrantes y/o Propietarios)
Write-Host "== D) Quitar a Samuel del acceso total del sitio ==" -ForegroundColor Cyan
$members = Get-PnPGroup -AssociatedMemberGroup
foreach ($g in @($members, $owners)) {
  try { Remove-PnPGroupMember -Group $g -LoginName $samuel -ErrorAction Stop; Write-Host "  - Samuel quitado de: $($g.Title)" -ForegroundColor Green }
  catch { Write-Host "  (Samuel no estaba en $($g.Title))" -ForegroundColor DarkGray }
}

Write-Host "== TERMINADO ==" -ForegroundColor Cyan
Write-Host "Pendiente: responsables de CHIHUAHUA/CRIANZA/TOLUCA (quien determine JMA) y 'personal que dispongan' Jorge/JM." -ForegroundColor Cyan
