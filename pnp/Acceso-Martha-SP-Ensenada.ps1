# Acceso de usuario (Integrante, nivel sitio) a Seguridad Privada - Ensenada
# para Martha (malvarez). Cubre TODAS las carpetas: se verifico antes (lectura
# PnP) que ninguna carpeta del sitio tiene herencia rota.
# PERMISOS: autorizado por Franco en chat (2026-06-12). No destructivo (solo agrega).
# Credenciales desde _secrets.ps1 (gitignored).
$ErrorActionPreference = "Continue"
. "$PSScriptRoot\_secrets.ps1"
$pw = if ($PnPCertPassword -is [System.Security.SecureString]) { $PnPCertPassword } else { ConvertTo-SecureString $PnPCertPassword -AsPlainText -Force }
$base = "https://jmaseguridad.sharepoint.com/sites"

$upn = "malvarez@jmaseguridad.com" # Martha

Write-Host "== Acceso a SP-Ensenada (Integrante) ==" -ForegroundColor Cyan
Connect-PnPOnline -Url "$base/SGSI-SP-Ensenada" -ClientId $PnPClientId -Tenant $PnPTenant -CertificatePath $PnPCertPath -CertificatePassword $pw
$members = Get-PnPGroup -AssociatedMemberGroup
try { Add-PnPGroupMember -Group $members -LoginName $upn -ErrorAction Stop; Write-Host "  + Integrante: $upn" -ForegroundColor Green }
catch { Write-Host "  (omitido/ya estaba) $upn -> $($_.Exception.Message)" -ForegroundColor Yellow }
Write-Host "== TERMINADO ==" -ForegroundColor Cyan
