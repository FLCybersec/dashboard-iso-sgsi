# CLAUDE.md — Contexto operativo

> **Fuente de verdad: [`ESPECIFICACION-Dashboard-SGSI.md`](ESPECIFICACION-Dashboard-SGSI.md)**.
> Reemplaza los prompts sueltos anteriores. Reconciliar contra ella; no avanzar
> por features sueltas. La bitacora registra el avance.

Dashboard de migracion documental ISO 27001 (SGSI JMA). SPA cliente-only que
rastrea estructura y migracion a SharePoint, NO documentos individuales.

## Diferencia clave con el dashboard AFAC

AFAC rastrea *documentos* por `driveItemId`. Este rastrea *estructura y
migracion* (sitios y carpetas que aun pueden no existir). Por eso la clave
canonica de cada nodo es la **ruta canonica** `${slug}::${rutaRelativa}`, no el
`driveItemId`.

## Fuente de verdad

`public/estructura-maestra-sgsi.json`. No inventar estructura: leerla del JSON.
Soporta tres formatos por sitio: `carpetas[]`, `bibliotecas[].carpetas[]`
(multi-biblioteca) y `carpetasComunes[]`, con `hijos[]` recursivos. Toda la
logica de aplanado vive en `src/lib/structure-store.js`.

## Reglas

- Identidad visual JMA: Arial, tono sobrio, sin emojis. Colores de clasificacion
  tomados del JSON (Publica `#2e8b57`, Interna `#2563eb`, Confidencial
  `#d97706`, Restringida `#dc2626`).
- Solo lectura sobre la estructura (`Sites.Read.All`); unica escritura =
  `seguimiento-migracion.json` (`Files.ReadWrite.All`). El dashboard NO crea
  sitios ni carpetas.
- Toda escritura registra `modificadoPor`/`modificadoPorEmail` + entrada de
  `historial` (evidencia ISO A.5.15, A.8.15).
- SPA con PKCE, sin client secret. Lista blanca en codigo.

## Lectura Graph (estado real) — IMPORTANTE

- Los sitios SharePoint estan en **espanol** y son **Communication Sites**. La
  biblioteca por defecto se llama "Documentos compartidos".
- Para leer carpetas usar SIEMPRE el drive por defecto via `/drive/root`, que es
  **independiente del idioma**. NO construir rutas con "Shared Documents" ni
  "Documentos compartidos".
  - Resolver siteId:   `GET /sites/jmaseguridad.sharepoint.com:/sites/{slug}`
  - Existencia carpeta: `GET /sites/{siteId}/drive/root:/{ruta}` (200 / 404)
  - Recorrido:          `GET /sites/{siteId}/drive/root:/{ruta}:/children`
- La `{ruta}` se codifica por segmento con `encodeURIComponent` (preservando las
  `/`), conservando tildes y espacios.

## Auth

Tenant JMA single-tenant (`36ed694d-...197`). App Registration
"Dashboard JMA SGSI" (SPA). Client ID en `src/auth/msal-config.js`.
Lista blanca en `src/auth/allowed-users.js`. Cache en `sessionStorage`,
logout local con `clearCache()`.

## Coordinacion

`BITACORA-DASHBOARD-ISO.md` se actualiza al cerrar cada tanda. No avanzar de
tanda sin validacion de Franco.

**Cowork coedita este repo en paralelo**: un chat de Cowork redacta las
instrucciones que Franco pega aqui y ademas edita archivos directamente
(sobre todo `estructura-maestra-sgsi.json`, raiz y `public/` en espejo), y
registra sus cambios en la bitacora. Protocolo para Claude Code:

- Leer la bitacora al iniciar cada tanda (puede haber contexto nuevo de Cowork).
- Antes de commitear, revisar `git status`: los archivos NO tocados en la
  sesion van en un commit separado (p. ej. "Maestro (via Cowork): ..."),
  nunca mezclados con los cambios propios.
- Antes de commitear el maestro, validarlo: JSON parsea, raiz == public, sin
  rutas duplicadas, clasificaciones validas y suite E2E en verde.

## Plan de tandas

1. **Bootstrap** — Vite + MSAL + login + lista blanca + carga del maestro. ← actual
2. Lectura Graph: resolver siteId, detectar existencia de carpetas, Resumen con % automatico.
3. Seguimiento: lectura/escritura de `seguimiento-migracion.json`, estados/notas, historial.
4. Pendientes y checklist de fases por sitio.
5. Export de evidencia + pulido + tests Playwright.
