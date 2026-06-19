# Renombrar estructura creada por el equipo (flujo inverso) - 2026-06-19.
# RENAME en sitio (conserva contenido). No destructivo. MAYUSCULAS, numeral donde toca.
# Credenciales desde _secrets.ps1 (gitignored).
$ErrorActionPreference = "Continue"
. "$PSScriptRoot\_secrets.ps1"
$pw = if ($PnPCertPassword -is [System.Security.SecureString]) { $PnPCertPassword } else { ConvertTo-SecureString $PnPCertPassword -AsPlainText -Force }
$base = "https://jmaseguridad.sharepoint.com/sites"
$lib  = "Documentos compartidos"

function Renombrar-Carpeta($actual, $nuevo) {
  try { Rename-PnPFolder -Folder "$lib/$actual" -TargetFolderName $nuevo -ErrorAction Stop | Out-Null; Write-Host "  OK: $actual -> $nuevo" -ForegroundColor Green }
  catch { Write-Host "  ERROR: $actual -> $($_.Exception.Message)" -ForegroundColor Red }
}

# ===================== RECURSOS HUMANOS =====================
Write-Host "== Recursos Humanos ==" -ForegroundColor Cyan
Connect-PnPOnline -Url "$base/SGSI-RecursosHumanos" -ClientId $PnPClientId -Tenant $PnPTenant -CertificatePath $PnPCertPath -CertificatePassword $pw
Renombrar-Carpeta "ALTAS IMSS ENSENADA"                   "04.6 ALTAS IMSS ENSENADA"
Renombrar-Carpeta "BAJAS TIJUANA"                          "04.8 BAJAS TIJUANA"
Renombrar-Carpeta "BAJAS ENSENADA"                         "04.9 BAJAS ENSENADA"
Renombrar-Carpeta "CONTRATOS LABORALES TIJUANA Y ENSENADA" "04.10 CONTRATOS LABORALES TIJUANA Y ENSENADA"
Renombrar-Carpeta "GAFETE FEDERAL (CIP)"                   "04.11 GAFETE FEDERAL (CIP)"
Renombrar-Carpeta "GAFETE SECRETARIA (CUIP)"              "04.12 GAFETE SECRETARIA (CUIP)"
Renombrar-Carpeta "Modalidad para Dar de Alta el Jiro Ciberseguridad" "04.13 MODALIDAD PARA DAR DE ALTA EL GIRO CIBERSEGURIDAD"
Renombrar-Carpeta "Relacion socios y apoderados"          "04.14 RELACION SOCIOS Y APODERADOS"

# ===================== K9 (1-13 -> 10.1-10.13) =====================
Write-Host "== K9 ==" -ForegroundColor Cyan
Connect-PnPOnline -Url "$base/SGSI-K9" -ClientId $PnPClientId -Tenant $PnPTenant -CertificatePath $PnPCertPath -CertificatePassword $pw
Renombrar-Carpeta "1 CANINOS"               "10.1 CANINOS"
Renombrar-Carpeta "2 RECURSO HUMANO"        "10.2 RECURSO HUMANO"
Renombrar-Carpeta "3 CERTIFICACIONES"       "10.3 CERTIFICACIONES"
Renombrar-Carpeta "4 CURSOS"                "10.4 CURSOS"
Renombrar-Carpeta "5 TRABLISA"              "10.5 TRABLISA"
Renombrar-Carpeta "6 AEROMEXICO"            "10.6 AEROMEXICO"
Renombrar-Carpeta "7 PERMISOS AUTORIZACIONES" "10.7 PERMISOS AUTORIZACIONES"
Renombrar-Carpeta "8 SANIDAD"               "10.8 SANIDAD"
Renombrar-Carpeta "9 SEUDOS"                "10.9 SEUDOS"
Renombrar-Carpeta "10 NORMATIVIDAD"         "10.10 NORMATIVIDAD"
Renombrar-Carpeta "11 CENTROS ENTRENAMIENTO" "10.11 CENTROS ENTRENAMIENTO"
Renombrar-Carpeta "12 FORMATOS"             "10.12 FORMATOS"
Renombrar-Carpeta "13 SOPORTE FILMICO"      "10.13 SOPORTE FILMICO"
Renombrar-Carpeta "1 Curso Mayo 2024"       "CURSO MAYO 2024"

# ===================== ADMINISTRACION =====================
Write-Host "== Administracion ==" -ForegroundColor Cyan
Connect-PnPOnline -Url "$base/SGSI-Administracion" -ClientId $PnPClientId -Tenant $PnPTenant -CertificatePath $PnPCertPath -CertificatePassword $pw
Renombrar-Carpeta "FORMATOS Y PLANTILLAS NABIKI" "07.7 FORMATOS Y PLANTILLAS"
Renombrar-Carpeta "JMA FEDERALES NABIKI"          "07.8 JMA FEDERALES"

Write-Host "== TERMINADO ==" -ForegroundColor Cyan
