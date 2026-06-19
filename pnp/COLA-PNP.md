# Cola operativa PnP — SGSI

Coordinacion Cowork <-> Code <-> Franco. Cowork escribe las operaciones; Code/Franco
las ejecutan y actualizan el estado. Detalle narrativo en `../BITACORA-DASHBOARD-ISO.md`.

**Reglas**
- Cowork no ejecuta PnP (sin acceso al tenant): solo escribe scripts y documenta.
- No destructivo (crear carpetas) -> lo corre Code directo.
- Destructivo (borrar/sobrante) y permisos -> los corre Code, pero SOLO tras
  autorizacion explicita de Franco en el chat (dry-run previo recomendado).
- Los `.ps1` NO deben contener la contrasena del cert: leerla de `pnp/_secrets.ps1` (gitignored).

**Estados:** Pendiente correr · Corrido · Verificado · Descartado

| Fecha | Script | Que hace | Destructivo | Estado | Quien corrio |
|---|---|---|---|---|---|
| 2026-06-12 | Aplicar-Aprobaciones-2026-06-12.ps1 | Bancos 06.2 (Banorte/Santander por nombre + anos, borrar Bancomer) + permisos SP-Tijuana | Si (borrar) | Verificado | Franco |
| 2026-06-12 | Crear-Pasantia-2026-06-12.ps1 | 20 carpetas CyberSec/Pasantia | No | Verificado | Franco |
| 2026-06-12 | Mover-Nomina-Finiquitos-Vacaciones-a-Finanzas.ps1 | Mover 3 carpetas a Finanzas 06.8-06.10 | Si (borrar origen) | Verificado | Franco |
| 2026-06-12 | Quitar-Acentos-Carpetas.ps1 | Renombrar 11 carpetas sin acentos + Cybersec->CyberSec | No (rename) | Verificado | Franco |
| 2026-06-12 | Permisos-Finanzas-en-RH.ps1 | Martha sitio RH; Daniela/Joel por carpeta (herencia rota) | Si (permisos) | Verificado | Franco |
| 2026-06-12 | pnp/Acceso-Total-RH.ps1 | Acceso nivel SITIO a RH (Integrante) para Jorge, Rita, Miguel, Nabiki, Joel, Daniela, Martha | Si (permisos, AUTORIZADO por Franco) | Corrido | Code |
| 2026-06-12b | pnp/Crear-Aprobados-2026-06-12b.ps1 | Finanzas 06.1 (SEGURIDAD/K9/CIBERSEGURIDAD x anio x 12 meses x clientes) + 06.2 EGRESOS/SEGURIDAD PRIVADA + RH (JMA SEGURIDAD/{TIJUANA,ENSENADA,K9}, FINIQUITOS RESPALDOS). ~490 carpetas, MAYUSCULAS sin numeral | No | Corrido (497 creadas, 0 errores) | Code |
| 2026-06-12b | pnp/Borrar-Aprobados-2026-06-12b.ps1 | Borrar 06.5 Egresos por Cliente (Finanzas) y 04.1.4 Documentos generales... (RH) | Si (borrar, AUTORIZADO por Franco en chat) | Corrido (2 vacias a papelera, 0 errores) | Code |
| 2026-06-12 | pnp/Acceso-Martha-SP-Ensenada.ps1 | Martha (malvarez) Integrante nivel sitio en SP-Ensenada (cubre todas las carpetas; 0 herencias rotas verificado) | Si (permisos, AUTORIZADO por Franco en chat) | Corrido y verificado (en grupo Integrantes) | Code |

| 2026-06-12c | pnp/Inventario-Estructura.ps1 | READ-ONLY: dump de todas las carpetas reales de los 12 sitios -> pnp/inventario.txt (revision Cowork del flujo inverso) | No (lectura) | Corrido (12/12 sitios, 0 errores, 4214 carpetas) | Code |
| 2026-06-19 | pnp/Renombrar-Estructura-2026-06-19.ps1 | RENAME en sitio (conserva contenido): RH 8 carpetas -> numeral 04.6/04.8-04.14 (typo Jiro->GIRO); K9 1-13 -> 10.1-10.13 + `1 Curso Mayo 2024`->`CURSO MAYO 2024`; Admin 2 carpetas -> 07.7/07.8 sin "NABIKI" | No (rename) | Corrido (24/24 OK, 0 errores) | Code |
| 2026-06-19 | pnp/Colorear-Principales-Morado.ps1 | Fija vti_colorhex=6 (morado) en las carpetas top-level de los 12 sitios (destacar en OneDrive). Escrito por Cowork; correr al cerrar la optimizacion (sugerido: probar 1 sitio primero) | No (propiedad) | Corrido (12/12, 0 err); SUPERSEDIDO por Colorear-Carpetas.ps1 (principal = RAIZ, no top-level) | Code |
| 2026-06-19 | pnp/Colorear-Carpetas.ps1 | RAIZ de cada sitio -> morado (6) + carpetas internas -> color por CLASIFICACION (mapa pnp/colores-carpetas.json de Cowork). Set-PnPPropertyBagValue (vti_colorhex) | No (propiedad) | Corrido y RE-CORRIDO tras fix de Cowork (12/12 raices morado; 141 internas coloreadas; DireccionGobierno ya 21/22; ~15 "no-existe" esperados por rutas renombradas) | Code |
| 2026-06-19 | pnp/Permisos-K9-2026-06-19.ps1 | K9: Jorge+Jose Maria -> Propietario; crear 10.11 CENTROS ENTRENAMIENTO/TOLUCA; TIJUANA -> Dumar+Samuel "Editar" (rompe herencia); quitar a Samuel del acceso total del sitio | Si (permisos+carpeta, AUTORIZADO por Franco) | Corrido (A/B/C/D OK; Samuel quitado de Integrantes; no estaba en Propietarios) | Code |

> Nota: los `.ps1` arriba viven hoy en la carpeta de trabajo de Franco (OneDrive
> "Migracion ISO"). Migrarlos a `pnp/` (sin credenciales) esta pendiente de la
> decision de flujo (ver bitacora, entrada "Propuesta de flujo").
