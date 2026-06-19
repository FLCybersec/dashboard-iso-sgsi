# Colorea de MORADO las carpetas PRINCIPALES (top-level) de cada sitio, para que
# destaquen al agregar acceso directo a OneDrive. 2026-06-19.
#
# Metodo: SharePoint guarda el color de carpeta en la propiedad vti_colorhex
# (numero 0-15). Se fija con Set-PnPPropertyBagValue apuntando a la carpeta por su
# ruta de sitio. La clave 'vti_colorhex' es interna/fija (no se traduce); el valor
# es un numero. Biblioteca en espanol = "Documentos compartidos".
#   Tabla de color: 0 amarillo (def), 1 rojo, 2 naranja, 3 verde, 4 teal, 5 azul,
#   6 MORADO, 7 rosa (oscuros); 8 gris; 9-15 versiones claras.
# No destructivo (solo fija una propiedad de la carpeta). Lee credenciales de _secrets.ps1.
#
# SUGERENCIA: probar primero en UN sitio (deja solo "SGSI-K9" en $slugs) y validar
# visualmente antes de correr los 12.
$ErrorActionPreference = "Continue"
. "$PSScriptRoot\_secrets.ps1"
$pw = if ($PnPCertPassword -is [System.Security.SecureString]) { $PnPCertPassword } else { ConvertTo-SecureString $PnPCertPassword -AsPlainText -Force }
$base   = "https://jmaseguridad.sharepoint.com/sites"
$lib    = "Documentos compartidos"
$MORADO = 6   # morado oscuro

$slugs = @(
  "SGSI-Concentrador","SGSI-DireccionGobierno","SGSI-RecursosHumanos","SGSI-Juridico",
  "SGSI-Finanzas","SGSI-Administracion","SGSI-SP-Tijuana","SGSI-SP-Ensenada",
  "SGSI-CyberSec","SGSI-K9","SGSI-Marketing","SGSI-TI"
)

foreach ($s in $slugs) {
  try {
    Connect-PnPOnline -Url "$base/$s" -ClientId $PnPClientId -Tenant $PnPTenant -CertificatePath $PnPCertPath -CertificatePassword $pw
    $tops = Get-PnPFolderItem -FolderSiteRelativeUrl $lib -ItemType Folder | Where-Object { $_.Name -ne "Forms" }
    $n = 0
    foreach ($t in $tops) {
      try {
        Set-PnPPropertyBagValue -Folder "$lib/$($t.Name)" -Key "vti_colorhex" -Value $MORADO -ErrorAction Stop
        $n++
      } catch { Write-Host "  ERROR $s/$($t.Name) -> $($_.Exception.Message)" -ForegroundColor Red }
    }
    Write-Host "  $s : $n principales -> morado" -ForegroundColor Green
  } catch { Write-Host "  ERROR sitio $s -> $($_.Exception.Message)" -ForegroundColor Red }
}
Write-Host "== TERMINADO ==" -ForegroundColor Cyan
