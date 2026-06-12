# Cola operativa PnP — SGSI

Coordinacion Cowork <-> Code <-> Franco. Cowork escribe las operaciones; Code/Franco
las ejecutan y actualizan el estado. Detalle narrativo en `../BITACORA-DASHBOARD-ISO.md`.

**Reglas**
- Cowork no ejecuta PnP (sin acceso al tenant): solo escribe scripts y documenta.
- No destructivo (crear carpetas) -> lo puede correr Code (si tiene PS7+cert).
- Destructivo (borrar/sobrante) y permisos -> requieren visto bueno de Franco.
- Los `.ps1` NO deben contener la contrasena del cert: leerla de `pnp/_secrets.ps1` (gitignored).

**Estados:** Pendiente correr · Corrido · Verificado · Descartado

| Fecha | Script | Que hace | Destructivo | Estado | Quien corrio |
|---|---|---|---|---|---|
| 2026-06-12 | Aplicar-Aprobaciones-2026-06-12.ps1 | Bancos 06.2 (Banorte/Santander por nombre + anos, borrar Bancomer) + permisos SP-Tijuana | Si (borrar) | Verificado | Franco |
| 2026-06-12 | Crear-Pasantia-2026-06-12.ps1 | 20 carpetas CyberSec/Pasantia | No | Verificado | Franco |
| 2026-06-12 | Mover-Nomina-Finiquitos-Vacaciones-a-Finanzas.ps1 | Mover 3 carpetas a Finanzas 06.8-06.10 | Si (borrar origen) | Verificado | Franco |
| 2026-06-12 | Quitar-Acentos-Carpetas.ps1 | Renombrar 11 carpetas sin acentos + Cybersec->CyberSec | No (rename) | Verificado | Franco |
| 2026-06-12 | Permisos-Finanzas-en-RH.ps1 | Martha sitio RH; Daniela/Joel por carpeta (herencia rota) | Si (permisos) | Verificado | Franco |

> Nota: los `.ps1` arriba viven hoy en la carpeta de trabajo de Franco (OneDrive
> "Migracion ISO"). Migrarlos a `pnp/` (sin credenciales) esta pendiente de la
> decision de flujo (ver bitacora, entrada "Propuesta de flujo").
