# Inventario READ-ONLY de carpetas reales en SharePoint (todos los sitios).
# No modifica nada. Escribe pnp/inventario.txt para que Cowork lo revise.
# Credenciales desde _secrets.ps1 (gitignored).
$ErrorActionPreference = "Continue"
. "$PSScriptRoot\_secrets.ps1"
$pw = if ($PnPCertPassword -is [System.Security.SecureString]) { $PnPCertPassword } else { ConvertTo-SecureString $PnPCertPassword -AsPlainText -Force }
$base = "https://jmaseguridad.sharepoint.com/sites"
$lib  = "Documentos compartidos"
$out  = "$PSScriptRoot\inventario.txt"

$slugs = @(
  "SGSI-Concentrador","SGSI-DireccionGobierno","SGSI-RecursosHumanos","SGSI-Juridico",
  "SGSI-Finanzas","SGSI-Administracion","SGSI-SP-Tijuana","SGSI-SP-Ensenada",
  "SGSI-CyberSec","SGSI-K9","SGSI-Marketing","SGSI-TI"
)

"INVENTARIO DE CARPETAS - $(Get-Date -Format s)" | Out-File $out
foreach ($s in $slugs) {
  try {
    Connect-PnPOnline -Url "$base/$s" -ClientId $PnPClientId -Tenant $PnPTenant -CertificatePath $PnPCertPath -CertificatePassword $pw
    "" | Out-File $out -Append
    "===== $s =====" | Out-File $out -Append
    $items = Get-PnPListItem -List $lib -PageSize 500 -Fields FileRef,FSObjType
    $prefijo = "/sites/$s/$lib/"
    $folders = $items |
      Where-Object { $_.FieldValues.FSObjType -eq 1 } |
      ForEach-Object { $_.FieldValues.FileRef } |
      Where-Object { $_ -like "$prefijo*" -and $_ -notlike "*/_seguimiento*" -and $_ -notlike "*/Forms*" } |
      ForEach-Object { $_.Substring($prefijo.Length) } |
      Sort-Object
    if ($folders) { $folders | Out-File $out -Append } else { "(sin carpetas)" | Out-File $out -Append }
    Write-Host "  $s : $($folders.Count) carpetas" -ForegroundColor Green
  } catch { Write-Host "  ERROR $s -> $($_.Exception.Message)" -ForegroundColor Red }
}
Write-Host "Inventario escrito en $out" -ForegroundColor Cyan
