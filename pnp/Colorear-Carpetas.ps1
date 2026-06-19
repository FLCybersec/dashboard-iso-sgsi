# Colorea carpetas de SharePoint segun la convencion JMA. 2026-06-19. No destructivo.
#   - RAIZ de cada sitio (biblioteca "Documentos compartidos") -> MORADO (6), para
#     distinguir la carpeta principal al agregar acceso directo a OneDrive.
#   - Carpetas INTERNAS -> color por CLASIFICACION, leido de pnp/colores-carpetas.json
#     (Publica=3 verde, Interna=5 azul, Confidencial=2 naranja, Restringida=1 rojo).
# Metodo: Set-PnPPropertyBagValue sobre la propiedad interna vti_colorhex (0-15).
# Credenciales desde _secrets.ps1. Las rutas que ya no existan (nombres viejos del
# maestro renombrados por el equipo) daran "ERROR ... no encontrado": es esperado e inofensivo.
$ErrorActionPreference = "Continue"
. "$PSScriptRoot\_secrets.ps1"
$pw = if ($PnPCertPassword -is [System.Security.SecureString]) { $PnPCertPassword } else { ConvertTo-SecureString $PnPCertPassword -AsPlainText -Force }
$base    = "https://jmaseguridad.sharepoint.com/sites"
$lib     = "Documentos compartidos"
$MORADO  = 6

# Mapa slug::ruta -> colorHex (lo mantiene Cowork)
$data  = Get-Content "$PSScriptRoot\colores-carpetas.json" -Raw | ConvertFrom-Json
$bySlug = @{}
foreach ($p in $data.color.PSObject.Properties) {
  $parts = $p.Name -split "::", 2
  if ($parts.Count -ne 2) { continue }
  $slug = $parts[0]; $ruta = $parts[1]
  if (-not $bySlug.ContainsKey($slug)) { $bySlug[$slug] = @() }
  $bySlug[$slug] += [pscustomobject]@{ ruta = $ruta; color = [int]$p.Value }
}

foreach ($slug in ($bySlug.Keys | Sort-Object)) {
  try {
    Connect-PnPOnline -Url "$base/$slug" -ClientId $PnPClientId -Tenant $PnPTenant -CertificatePath $PnPCertPath -CertificatePassword $pw
    # Raiz -> morado (especial). Puede que OneDrive no lo refleje en el acceso directo; se intenta.
    try { Set-PnPPropertyBagValue -Folder $lib -Key "vti_colorhex" -Value $MORADO -ErrorAction Stop; Write-Host "  [$slug] raiz -> morado" -ForegroundColor Magenta }
    catch { Write-Host "  [$slug] raiz: no se pudo ($($_.Exception.Message))" -ForegroundColor Yellow }
    # Internas -> color por clasificacion
    $ok = 0; $err = 0
    foreach ($e in $bySlug[$slug]) {
      try { Set-PnPPropertyBagValue -Folder "$lib/$($e.ruta)" -Key "vti_colorhex" -Value $e.color -ErrorAction Stop; $ok++ }
      catch { $err++; Write-Host "    ERROR $slug/$($e.ruta): $($_.Exception.Message)" -ForegroundColor DarkYellow }
    }
    Write-Host "  [$slug] internas coloreadas: $ok (errores/no-existe: $err)" -ForegroundColor Green
  } catch { Write-Host "  ERROR sitio $slug -> $($_.Exception.Message)" -ForegroundColor Red }
}
Write-Host "== TERMINADO ==" -ForegroundColor Cyan
