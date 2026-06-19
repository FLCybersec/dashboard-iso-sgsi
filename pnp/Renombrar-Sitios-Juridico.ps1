# Intercambiar TITULOS de dos sitios (NO cambia URLs/slugs; reversible) - 2026-06-19.
#   - Sitio existente con titulo "JMA Juridico" (de Jorge) -> "Juridico Jorge"
#   - Nuestro SGSI-Juridico (titulo "Juridico") -> "JMA Juridico"
# App-only admin. Autorizado por Franco. Lee credenciales de _secrets.ps1.
$ErrorActionPreference = "Continue"
. "$PSScriptRoot\_secrets.ps1"
$pw = if ($PnPCertPassword -is [System.Security.SecureString]) { $PnPCertPassword } else { ConvertTo-SecureString $PnPCertPassword -AsPlainText -Force }
$admin = "https://jmaseguridad-admin.sharepoint.com"
$base  = "https://jmaseguridad.sharepoint.com/sites"

# Conectar al admin para localizar el sitio existente por titulo
Connect-PnPOnline -Url $admin -ClientId $PnPClientId -Tenant $PnPTenant -CertificatePath $PnPCertPath -CertificatePassword $pw

# 1) Localizar el "JMA Juridico" existente (de Jorge) por su titulo
$existing = @(Get-PnPTenantSite | Where-Object { $_.Title -eq "JMA Juridico" -and $_.Url -ne "$base/SGSI-Juridico" })
if ($existing.Count -eq 0) { Write-Host "  No se encontro ningun sitio con titulo 'JMA Juridico' (ademas del SGSI). Revisa el nombre exacto." -ForegroundColor Yellow }
elseif ($existing.Count -gt 1) { Write-Host "  OJO: hay $($existing.Count) sitios con titulo 'JMA Juridico'. No se toca nada; revisa cual es:" -ForegroundColor Yellow; $existing | ForEach-Object { Write-Host "    $($_.Url)" } }
else {
  $url = $existing[0].Url
  try { Set-PnPTenantSite -Identity $url -Title "Juridico Jorge" -ErrorAction Stop; Write-Host "  Titulo (coleccion) -> 'Juridico Jorge' en $url" -ForegroundColor Green } catch { Write-Host "  ERROR titulo coleccion $url -> $($_.Exception.Message)" -ForegroundColor Red }
  try {
    Connect-PnPOnline -Url $url -ClientId $PnPClientId -Tenant $PnPTenant -CertificatePath $PnPCertPath -CertificatePassword $pw
    Set-PnPWeb -Title "Juridico Jorge" -ErrorAction Stop; Write-Host "  Titulo (web) -> 'Juridico Jorge'" -ForegroundColor Green
  } catch { Write-Host "  ERROR titulo web (existente) -> $($_.Exception.Message)" -ForegroundColor Red }
}

# 2) SGSI-Juridico -> "JMA Juridico"
$sgsi = "$base/SGSI-Juridico"
Connect-PnPOnline -Url $admin -ClientId $PnPClientId -Tenant $PnPTenant -CertificatePath $PnPCertPath -CertificatePassword $pw
try { Set-PnPTenantSite -Identity $sgsi -Title "JMA Juridico" -ErrorAction Stop; Write-Host "  Titulo (coleccion) -> 'JMA Juridico' en $sgsi" -ForegroundColor Green } catch { Write-Host "  ERROR titulo coleccion SGSI -> $($_.Exception.Message)" -ForegroundColor Red }
try {
  Connect-PnPOnline -Url $sgsi -ClientId $PnPClientId -Tenant $PnPTenant -CertificatePath $PnPCertPath -CertificatePassword $pw
  Set-PnPWeb -Title "JMA Juridico" -ErrorAction Stop; Write-Host "  Titulo (web) SGSI-Juridico -> 'JMA Juridico'" -ForegroundColor Green
} catch { Write-Host "  ERROR titulo web SGSI -> $($_.Exception.Message)" -ForegroundColor Red }

Write-Host "== TERMINADO == (URLs/slugs sin cambios; solo titulos)" -ForegroundColor Cyan
