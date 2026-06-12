# Borrar aprobados (destructivo) - 2026-06-12b. GATE HUMANO (Franco).
#   Finanzas: 06.5 Egresos por Cliente
#   RH: 04.1 Ano 2026/04.1.4 Documentos generales del personal contratado
# Por defecto MODO REVISION: reporta contenido, NO borra. Pon $ConfirmarBorrado=$true
# tras revisar. Borrado a PAPELERA (-Recycle), recuperable.
$ErrorActionPreference = "Continue"
. "$PSScriptRoot\_secrets.ps1"
$pw = if ($PnPCertPassword -is [System.Security.SecureString]) { $PnPCertPassword } else { ConvertTo-SecureString $PnPCertPassword -AsPlainText -Force }
$base = "https://jmaseguridad.sharepoint.com/sites"
$lib  = "Documentos compartidos"

$ConfirmarBorrado = $false   # <-- $true SOLO tras revisar el reporte
# CORRIDO 2026-06-12 por Code con $ConfirmarBorrado=$true, autorizado por Franco en
# chat (borrar directo). Ambas carpetas estaban vacias; a papelera. RecycleBinItemId:
#   Finanzas 06.5: d6e6e6f9-5ac1-4461-81da-33b2035b3eeb
#   RH 04.1.4:     c89c5d46-90b0-4732-b3b9-b64d76d38996

function Borrar-CarpetaSegura($slug, $parent, $name) {
  $rel = "$parent/$name"
  try {
    $items = @(Get-PnPFolderItem -FolderSiteRelativeUrl $rel -ItemType All -ErrorAction Stop)
    if ($items.Count -gt 0) {
      Write-Host "  CONTENIDO ($($items.Count)) en [$slug] $rel" -ForegroundColor Yellow
      if (-not $ConfirmarBorrado) { Write-Host '    -> NO se borra (salvaguarda). Mueve el contenido o pon $ConfirmarBorrado=$true.' -ForegroundColor Yellow; return }
    } else { Write-Host "  VACIA: [$slug] $rel" -ForegroundColor DarkGray }
    if ($ConfirmarBorrado -or $items.Count -eq 0) {
      Remove-PnPFolder -Name $name -Folder $parent -Recycle -Force -ErrorAction Stop
      Write-Host "  BORRADA (a papelera): [$slug] $rel" -ForegroundColor Green
    }
  } catch { Write-Host "  ERROR: [$slug] $rel -> $($_.Exception.Message)" -ForegroundColor Red }
}

if (-not $ConfirmarBorrado) { Write-Host "MODO REVISION: no se borra nada con contenido; solo se reporta." -ForegroundColor Yellow }

Write-Host "== Finanzas ==" -ForegroundColor Cyan
Connect-PnPOnline -Url "$base/SGSI-Finanzas" -ClientId $PnPClientId -Tenant $PnPTenant -CertificatePath $PnPCertPath -CertificatePassword $pw
Borrar-CarpetaSegura "Finanzas" $lib "06.5 Egresos por Cliente"

Write-Host "== Recursos Humanos ==" -ForegroundColor Cyan
Connect-PnPOnline -Url "$base/SGSI-RecursosHumanos" -ClientId $PnPClientId -Tenant $PnPTenant -CertificatePath $PnPCertPath -CertificatePassword $pw
Borrar-CarpetaSegura "RH" "$lib/04.1 Ano 2026" "04.1.4 Documentos generales del personal contratado"

Write-Host "== TERMINADO ==" -ForegroundColor Cyan
