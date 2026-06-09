# Dashboard de Migracion ISO 27001 — SGSI JMA

SPA cliente-only que rastrea el avance de la migracion documental a SharePoint
para la certificacion ISO 27001. Login Microsoft (Entra) + lista blanca.
Vive en `https://iso.jmacybersec.com`.

Sigue el modelo canonico JMA (skill `jma-modelo-dashboard-cowork`): Vite +
Preact, sin backend, tokens delegados de Microsoft Graph.

## Stack

- Vite 5 + JavaScript ES2022, Preact + htm, CSS variables.
- `@azure/msal-browser` v3, `@microsoft/microsoft-graph-client`.
- `idb` (cache), `xlsx` (export), `chart.js` (graficos).
- Hosting Cloudflare Pages, DNS Namecheap, repo privado `FLCybersec`.

## Desarrollo local

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # genera dist/
npm run preview  # sirve dist/ localmente
```

## App Registration (Entra)

El App Registration "Dashboard JMA SGSI" ya esta creado y su Client ID
configurado en [`src/auth/msal-config.js`](src/auth/msal-config.js).

Referencia de los pasos en el portal de Entra (por si hay que recrearlo):

1. **Entra ID → App registrations → New registration**.
   - Nombre: `Dashboard JMA SGSI`
   - Supported account types: **Single tenant**.
   - Redirect URI: plataforma **Single-page application (SPA)** →
     `http://localhost:5173`.
2. En la app creada, **Authentication → Add a platform / Add URI**: agregar
   tambien `https://iso.jmacybersec.com` como SPA.
3. **API permissions → Add a permission → Microsoft Graph → Delegated**:
   `User.Read`, `User.ReadBasic.All` (fotos de personas), `Sites.Read.All`,
   `Files.ReadWrite.All`.
4. **Grant admin consent** para el tenant.
5. Copiar el **Application (client) ID** y pegarlo en `CLIENT_ID` dentro de
   `src/auth/msal-config.js`.

Datos del tenant (ya configurados):

- Tenant ID: `36ed694d-55ff-4bbf-9018-04037b362197`
- Authority: `https://login.microsoftonline.com/36ed694d-55ff-4bbf-9018-04037b362197`
- Host SharePoint: `jmaseguridad.sharepoint.com`

## Acceso y roles

El dashboard se abre a TODO el personal del tenant (single-tenant): cualquier
usuario autenticado entra. Roles en [`src/auth/allowed-users.js`](src/auth/allowed-users.js):

- **admin** (Franco, Carmen, Ezequiel, Chema, Jorge): ven todas las vistas globales.
- **usuario** (el resto): entran a "Mi trabajo" y solo ven/editan lo suyo. El
  alcance real lo impone SharePoint via Graph delegado (cada quien escribe en los
  sitios donde tiene permiso).

## Estructura de datos

- `public/estructura-maestra-sgsi.json` — fuente de verdad del "deber ser"
  (12 sitios, clasificaciones, propietarios). El dashboard la carga al inicio.
- `_seguimiento/seguimiento-migracion.json` en el sitio de CADA area — contrato
  escribible del estado/seguimiento (cada persona escribe donde tiene permiso).
  El dashboard agrega los sitios accesibles. El archivo legado del hub se lee
  como semilla/respaldo (migracion no destructiva).

## Despliegue

Cloudflare Pages: build `npm run build`, output `dist`, SPA fallback en
`public/_redirects`. Dominio `iso.jmacybersec.com` via CNAME en Namecheap.

## Estado del proyecto

Ver [`BITACORA-DASHBOARD-ISO.md`](BITACORA-DASHBOARD-ISO.md). Tandas 1-5
code-complete (1-3 validadas en vivo; 4-5 verificadas por build + tests E2E).
Pendiente solo la fase de despliegue guiado (GitHub + Cloudflare + DNS).

## Tests

```bash
npm run test:e2e   # Playwright: login, Resumen (Graph mockeado) y flujo de estado
```

Usan el modo de pruebas `?e2e=1` (sesion ficticia) + mock de Graph; no requieren
credenciales reales.
