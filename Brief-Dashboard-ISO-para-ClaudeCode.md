# Brief de construcción — Dashboard de Migración ISO 27001

Documento de especificación para **Claude Code**. Proyecto JMA · SGSI / ISO 27001.
Acompaña al archivo de datos `estructura-maestra-sgsi.json` (fuente de verdad de la estructura).

---

## 1. Objetivo

Construir un dashboard web que **rastree el avance de la migración documental a SharePoint** para la certificación ISO 27001. Debe permitir:

- Ver, por sitio y global, qué carpetas/sitios están **creados o pendientes** (detección automática vía Graph + estado manual).
- Agregar **pendientes** y **carpetas por crear** ad hoc, con responsable y fecha objetivo.
- Llevar el **checklist de fases** de cada sitio (creado, asociado al hub, permisos, retención, versionado, sync).
- Registrar **quién y cuándo** cambió cada cosa (evidencia para ISO).
- Exportar el estado (CSV/Excel) como evidencia de auditoría.

Vive en `https://iso.jmacybersec.com`, con login Microsoft (Entra) y lista blanca de 5 usuarios.

> Diferencia clave con el dashboard AFAC: AFAC rastrea *documentos* (por `driveItemId`). Este rastrea *estructura y migración* (sitios y carpetas que aún pueden no existir), así que la clave es la **ruta canónica del nodo**, no el `driveItemId`.

---

## 2. Stack y patrón

Reutilizar el modelo canónico JMA (skill `jma-modelo-dashboard-cowork`): SPA cliente-only, sin backend.

- Vite 5 + JavaScript ES2022, Preact + htm, CSS variables (`tokens.css`), Chart.js v4.
- `@azure/msal-browser` v3 + `@microsoft/microsoft-graph-client`.
- `idb` para cache stale-while-revalidate; `xlsx` (SheetJS) para export.
- Hosting Cloudflare Pages; DNS Namecheap; repo privado en GitHub `FLCybersec`.
- Estructura de repo, skills `.claude/skills/` y coordinación por bitácora: idénticas al patrón AFAC.

---

## 3. Identidad y autenticación

Datos del tenant (skill `jma-microsoft-365-tenant`):

- Tenant ID: `36ed694d-55ff-4bbf-9018-04037b362197` (single-tenant)
- Authority: `https://login.microsoftonline.com/36ed694d-55ff-4bbf-9018-04037b362197`
- Host SharePoint: `jmaseguridad.sharepoint.com`

**App Registration nueva** (Entra) — patrón SPA:

- Nombre: `Dashboard JMA SGSI`
- Plataforma: Single-page application (SPA, PKCE)
- Redirect URIs: `https://iso.jmacybersec.com` y `http://localhost:5173`
- Cuenta: Single tenant
- Permisos delegados (Graph): `User.Read`, `Sites.Read.All`, `Files.ReadWrite.All`
- Admin consent: requerido (lo concede Franco)
- El Client ID se guarda en `src/auth/msal-config.js`

**Lista blanca** (`src/auth/allowed-users.js`):

```
flazzarini@jmacybersec.com   // Franco
etorres@jmacybersec.com      // Ezequiel
crodriguez@jmacybersec.com   // Carmen
cgonzalez@jmacybersec.com    // Chema
jalvarez@jmaseguridad.com    // Jorge
```

`loginRequest.prompt = 'select_account'`; cache en `sessionStorage`; logout local con `clearCache()`.

---

## 4. Modelo de datos

### 4.1 Estructura esperada (fuente de verdad)

Archivo `estructura-maestra-sgsi.json` (adjunto). Contiene 12 sitios (1 hub + 11), 171 carpetas, con `slug`, `nombre`, `propietario`, `acceso`, `clasificacion` por carpeta y árboles anidados (`hijos`). El dashboard lo carga al inicio como definición del "deber ser". Puede vivir en el repo (`public/estructura-maestra-sgsi.json`) o leerse del hub.

Niveles de clasificación y colores (ya en el JSON): Pública `#2e8b57`, Interna `#2563eb`, Confidencial `#d97706`, Restringida `#dc2626`.

### 4.2 Estado real (lectura en vivo por Graph)

Para cada sitio, resolver `siteId` y listar carpetas para detectar existencia:

```
GET /sites/jmaseguridad.sharepoint.com:/sites/{slug}            -> siteId
GET /sites/{siteId}/drive/root:/{rutaCarpeta}                   -> 200 existe / 404 no existe
GET /sites/{siteId}/drive/root:/{ruta}:/children                -> recorrido
```

Si el sitio no existe aún, marcar todas sus carpetas como "Pendiente" sin romper. Cachear con `idb` (TTL 10 min) + botón refresh.

### 4.3 Seguimiento (JSON escribible) — contrato de este proyecto

Archivo `seguimiento-migracion.json` en el hub:
`PUT /sites/{hubSiteId}/drive/root:/_seguimiento/seguimiento-migracion.json:/content`

Schema (adaptado del `validacion.json` canónico):

```json
{
  "version": "1.0",
  "fecha_inicial": "ISO-8601",
  "nodos": {
    "{slug}::{rutaRelativa}": {
      "tipo": "sitio | carpeta",
      "estado": "Pendiente | En progreso | Creada | Verificada | Bloqueada | N/A",
      "notas": "string",
      "responsable": "string",
      "ultimaModificacion": "ISO-8601",
      "modificadoPor": "Nombre",
      "modificadoPorEmail": "user@dominio",
      "historial": [
        { "fecha":"ISO-8601","estado_anterior":"string|null","estado_nuevo":"string","nota":"string","modificadoPor":"Nombre","modificadoPorEmail":"email" }
      ]
    }
  },
  "pendientes": [
    { "id":"pend-{ts}-{rand}","descripcion":"string<=200","sitio":"{slug}","responsable":"string","fechaObjetivo":"YYYY-MM-DD","prioridad":"alta|media|baja","creado":"ISO-8601","creadoPor":"Nombre","completado":false,"completadoEn":"ISO-8601|null" }
  ],
  "fases_por_sitio": {
    "{slug}": { "sitio_creado":false,"asociado_hub":false,"carpetas_creadas":false,"permisos_aplicados":false,"retencion_aplicada":false,"versionado_activado":false,"sync_validado":false }
  }
}
```

Reglas: clave de nodo = `{slug}::{rutaRelativa}` (estable, no depende de driveItemId). Tolerar campos ausentes (backward compat). Toda escritura registra `modificadoPor`/`modificadoPorEmail` y agrega entrada a `historial`.

### 4.4 Estado efectivo (merge)

Por cada nodo del maestro: estado = lo detectado por Graph (existe → "Creada") salvo override manual en `seguimiento` (p. ej. "Verificada", "Bloqueada"). Así el avance automático y el control manual conviven.

---

## 5. Vistas (UI)

1. **Login** — pantalla MSAL + validación contra lista blanca.
2. **Resumen** — barra de progreso global (% carpetas creadas), tarjetas por sitio con % y semáforo, contador de pendientes abiertos, gráfico Chart.js de avance por sitio.
3. **Sitio** — árbol de carpetas del sitio (del maestro) con badge de clasificación y estado por carpeta; permite cambiar estado/nota/responsable (escribe a `seguimiento`). Muestra el checklist de fases del sitio.
4. **Pendientes** — lista de pendientes y carpetas por crear; alta/edición/cierre; filtro por sitio, responsable, prioridad.
5. **Evidencia/Export** — exportar a Excel/CSV el estado completo + historial (para el auditor).

Identidad visual JMA (tokens de marca), Arial, sin emojis, tono sobrio. Badges de clasificación con los colores del JSON.

---

## 6. Coordinación Cowork ↔ Claude Code

- `BITACORA-DASHBOARD-ISO.md` en la raíz del proyecto en SharePoint (no en el repo). Claude Code la actualiza al cerrar cada tanda (commits, archivos, decisiones, riesgos, próximos pasos). Cowork la lee cuando Franco avisa "ya actualizada".
- `CLAUDE.md` y `PROMPT-INICIAL.md` en el repo con el contexto operativo.

---

## 7. Despliegue

1. Repo privado GitHub `FLCybersec/dashboard-iso-sgsi`.
2. Cloudflare Pages: build `npm run build`, output `dist`, SPA fallback en `public/_redirects`.
3. Dominio `iso.jmacybersec.com`: CNAME en Namecheap → `<proyecto>.pages.dev`.
4. Push a `main` = deploy automático.

---

## 8. Seguridad y notas ISO 27001

- Solo lectura sobre la estructura (Sites.Read.All); la única escritura es el `seguimiento-migracion.json` (Files.ReadWrite.All). El dashboard **no crea sitios ni carpetas**: eso lo hace el aprovisionamiento por PnP, aparte.
- El historial con autor/fecha es evidencia de implementación controlada (A.5.15, A.8.15).
- Lista blanca en código + MFA/Conditional Access heredados del tenant.
- No exponer secretos; SPA con PKCE, sin client secret.

---

## 9. Plan de tandas sugerido

1. Bootstrap: Vite + MSAL + login + lista blanca + carga del maestro.
2. Lectura Graph: resolver siteId y detectar existencia de carpetas; vista Resumen con % automático.
3. Seguimiento: lectura/escritura de `seguimiento-migracion.json`; cambiar estados/notas; historial.
4. Pendientes y checklist de fases por sitio.
5. Export de evidencia + pulido visual + tests Playwright de login y flujo de estado.

---

## 10. Archivos que acompañan este brief

- `estructura-maestra-sgsi.json` — estructura esperada (12 sitios, 171 carpetas, clasificación, propietarios). Fuente de verdad del dashboard.
