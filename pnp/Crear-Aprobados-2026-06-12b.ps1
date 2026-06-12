# Crear aprobados (Finanzas 06.1 facturacion + 06.2 EGRESOS + RH) - 2026-06-12b.
# No destructivo. Nombres en MAYUSCULAS, sin acentos, sin numeral (instancias).
# Credenciales desde _secrets.ps1 (gitignored).
$ErrorActionPreference = "Continue"
. "$PSScriptRoot\_secrets.ps1"
$pw = if ($PnPCertPassword -is [System.Security.SecureString]) { $PnPCertPassword } else { ConvertTo-SecureString $PnPCertPassword -AsPlainText -Force }
$base = "https://jmaseguridad.sharepoint.com/sites"
$lib  = "Documentos compartidos"

$ok = 0; $err = 0
function Crear($ruta) {
  try { Resolve-PnPFolder -SiteRelativePath $ruta -ErrorAction Stop | Out-Null; $script:ok++ }
  catch { $script:err++; Write-Host "  ERR $ruta -> $($_.Exception.Message)" -ForegroundColor Red }
}

# ===================== FINANZAS =====================
Write-Host "== Finanzas ==" -ForegroundColor Cyan
Connect-PnPOnline -Url "$base/SGSI-Finanzas" -ClientId $PnPClientId -Tenant $PnPTenant -CertificatePath $PnPCertPath -CertificatePassword $pw

# 06.1 Facturacion: division / anio / mes / cliente
$f061  = "$lib/06.1 Facturacion (Emitidas-Recibidas)"
$meses = @("ENERO","FEBRERO","MARZO","ABRIL","MAYO","JUNIO","JULIO","AGOSTO","SEPTIEMBRE","OCTUBRE","NOVIEMBRE","DICIEMBRE")
$div = [ordered]@{
  "SEGURIDAD"      = @{ anios = @("2022","2023","2024","2025","2026"); clientes = @("DKM","HOSPITAL","ASCENSO","MOLOAKAN VALLE","TP&OIL DE MEXICO","BONATTI","BF-MOTORS") }
  "K9"             = @{ anios = @("2022","2023","2024","2025","2026"); clientes = @("TRABLISA") }
  "CIBERSEGURIDAD" = @{ anios = @("2026");                              clientes = @() }
}
foreach ($d in $div.Keys) {
  $ok = 0; $err = 0
  foreach ($a in $div[$d].anios) {
    foreach ($m in $meses) {
      if ($div[$d].clientes.Count -eq 0) { Crear "$f061/$d/$a/$m" }
      else { foreach ($c in $div[$d].clientes) { Crear "$f061/$d/$a/$m/$c" } }
    }
  }
  Write-Host ("  06.1/{0}: {1} creadas, {2} errores" -f $d, $ok, $err) -ForegroundColor Green
}

# 06.2 Movimientos Bancarios / EGRESOS / SEGURIDAD PRIVADA
$ok = 0; $err = 0
Crear "$lib/06.2 Movimientos Bancarios/EGRESOS/SEGURIDAD PRIVADA"
Write-Host ("  06.2/EGRESOS: {0} creadas, {1} errores" -f $ok, $err) -ForegroundColor Green

# ===================== RECURSOS HUMANOS =====================
Write-Host "== Recursos Humanos ==" -ForegroundColor Cyan
Connect-PnPOnline -Url "$base/SGSI-RecursosHumanos" -ClientId $PnPClientId -Tenant $PnPTenant -CertificatePath $PnPCertPath -CertificatePassword $pw
$ok = 0; $err = 0
Crear "$lib/04.2 Expedientes de Personal/JMA SEGURIDAD/TIJUANA"
Crear "$lib/04.2 Expedientes de Personal/JMA SEGURIDAD/ENSENADA"
Crear "$lib/04.2 Expedientes de Personal/JMA SEGURIDAD/K9"
Crear "$lib/04.1 Ano 2026/04.1.6 Finiquitos pagados 2026/FINIQUITOS RESPALDOS"
Write-Host ("  RH: {0} creadas, {1} errores" -f $ok, $err) -ForegroundColor Green

Write-Host "== TERMINADO ==" -ForegroundColor Cyan
