# Bitacora — Dashboard de Migracion ISO 27001 (SGSI JMA)

Coordinacion Cowork <-> Claude Code. Se actualiza al cerrar cada tanda.
No se avanza de tanda sin validacion de Franco.

---

## Ajuste — Rol "observador" (consultoria ISO, solo lectura) (2026-06-09)

**Estado:** Code-complete. Build + 16/16 E2E.

**Necesidad:** dar acceso a la consultora ISO externa
(socorro.rojas@hotmail.com, NO corporativa) para que siga el avance "sin
interferir": ver todo en general, sin editar.

**Dos capas (importante):**
- **Microsoft 365 (accion de Franco en Entra, no codigo):** la app es
  single-tenant; una cuenta @hotmail no entra tal cual. Hay que (1) invitarla
  como **invitada B2B** en Entra ID y (2) darle **lectura** a los sitios de
  SharePoint (Visitante/solo lectura, idealmente via grupo); si no, el dashboard
  le mostraria todo vacio (lee con sus permisos delegados). SharePoint mismo le
  impide escribir aunque el token traiga Files.ReadWrite.All. No se vuelve la app
  multi-tenant (rompe el modelo single-tenant).
- **Dashboard (codigo):** nuevo rol `observador` ademas de admin/usuario.

**Arreglo (codigo):**
- `allowed-users.js`: lista `OBSERVADORES` + `esObservador`; `rolDe` ->
  'admin' | 'observador' | 'usuario'.
- `app.js`: el observador ve las vistas globales (Resumen, Personas, Sitios,
  detalle de Sitio, Evidencia, Ejecutivo) en **solo lectura** (`puedeEditar=false`);
  NO ve "Mi trabajo" ni "Aprobaciones"; aterriza en Resumen.
- `Sidebar.js`: entradas por rol; badge "consultor · solo lectura".
- `SitioView.js`: `puedeEditar` desactiva todas las escrituras (arbol, Apoyo SGSI,
  cola de cambios, solicitudes de permiso); se mantienen las tablas visibles.
- `tests/e2e/roles.spec.js`: caso observador (ve globales, no Mi trabajo ni
  Aprobaciones, badge solo lectura).

**Nota:** si Entra emite para la invitada un UPN distinto (formato
`...#EXT#@...onmicrosoft.com`), agregarlo tambien a `OBSERVADORES`.

```
src/auth/allowed-users.js
src/app.js
src/components/Sidebar.js
src/components/SitioView.js
tests/e2e/roles.spec.js
```

---

## Ajuste — Hoja Resumen del Excel lidera con migracion (2026-06-09)

**Estado:** Aplicado. Build verificado (225 modulos).

**Sintoma:** el exportador de evidencia a Excel no mostraba el avance de
MIGRACION; la primera hoja ("Resumen") seguia mostrando solo la creacion de
carpetas (estructura).

**Causa:** la hoja Resumen se armaba con `mig.sitios` (deteccion de estructura
via Graph) y su columna "% avance" era el % de carpetas creadas, no de migracion
de contenido. El avance real estaba relegado a una hoja posterior. La UI ya
lideraba con migracion desde la Tanda 7, pero el Excel no se habia actualizado.

**Arreglo:**
- `exporter.js`: la hoja **Resumen** ahora lidera con migracion de contenido
  (`statsMigracionSitio`): % migracion, carpetas migradas/total, Apoyo SGSI,
  ultima actualizacion, y una fila TOTAL global. La estructura (carpetas creadas)
  queda como columnas secundarias, con etiquetas explicitas ("% migracion
  contenido" vs "% estructura (carpetas creadas)").
- Se elimina la hoja redundante "Migracion por sitio" (su contenido quedo en
  Resumen). Se conserva "Migracion por persona".

```
src/lib/exporter.js
```

---

## Ajuste — Export no genera archivos vacios (2026-06-09)

**Estado:** Aplicado y pusheado (`3a5f98f`).

**Sintoma:** al exportar "Solicitudes aprobadas" sin nada aprobado, se descargaba
un CSV (y JSON) con solo el encabezado, que se interpretaba como export
defectuoso (todo en columna A al abrirlo en Excel espanol por el separador `;`).

**Causa:** `exportSolicitudesAprobadas` y `exportCambiosCSV` disparaban la
descarga aunque no hubiera filas. El CSV en si es correcto (coma estandar); el
problema era el archivo vacio + la visualizacion en Excel.

**Arreglo:**
- `exporter.js`: ambas funciones retornan `total: 0` sin descargar cuando no hay
  nada que exportar (sin CSV/JSON de puro encabezado).
- `EvidenciaView.js`: mensaje claro cuando no hay cambios de estructura.
- Delimitador: se mantiene la **coma** (es lo mas universal para que el proyecto
  de Claude/PnP ingiera el archivo). Para conocer los cambios, el artefacto
  recomendado es el **JSON** estructurado, no el CSV.

```
src/lib/exporter.js
src/components/EvidenciaView.js
```

---

## Tanda 14 — Lenguaje llano + descripcion de carpetas de control

**Fecha:** 2026-06-09
**Estado:** Code-complete. Build verificado. **15/15 tests E2E.**

- **Sin terminos tecnicos en la UI**: la unica etiqueta visible con jerga
  ("Nodos con override" en Evidencia) pasa a "Carpetas con estado puesto a mano".
  El resto de "override"/"nodo" son identificadores de codigo y clases CSS
  internas (no visibles), se mantienen.
- **Descripcion de carpetas de control** en el arbol (texto breve + tooltip):
  `_Plantillas` = "Plantillas reutilizables del area"; `_Migracion` = "Zona
  temporal de migracion"; `_Archivo` = "Documentos obsoletos que se conservan".

### Archivos tocados

```
src/components/EvidenciaView.js   (etiqueta en lenguaje llano)
src/components/ArbolCarpetas.js   (descCarpeta + descripcion/tooltip)
src/styles/components.css         (.carpeta-desc)
```

---

## Tanda 13 — Cierre del pase visual + Indicador del sitio (solo lectura)

**Fecha:** 2026-06-09
**Estado:** Code-complete. Build verificado. **15/15 tests E2E.**

- **Cuenta de la barra lateral** reorganizada (fix del apretado): avatar+nombre en
  una fila (nombre truncado), badge admin junto al correo, "Salir" a lo ancho.
- **"Informacion del sitio"**: se elimino el checklist manual de fases (permisos,
  retencion, sync, etc.). En su lugar, un **indicador de solo lectura**:
  - "Sitio creado" (Si/No) detectado real via Graph (`existeSitio`).
  - "Control de versiones": **informativo**. Los ajustes de versionado de la
    biblioteca NO se exponen por Graph con `Sites.Read.All` (no estan en el
    recurso `list`/`drive`), asi que se muestra como dato informativo sin inventar
    un valor. Nada se palomea a mano.
- **Export** actualizado: se quito la hoja "Fases" y la columna de fases del
  Resumen; nueva hoja **"Indicadores"** (Sitio creado + Control de versiones
  informativo). El campo `fases_por_sitio` se conserva en el schema por
  backward-compat (ya no se usa en UI).
- Pase visual §9 dado por cerrado (tipografia 400/500, color+icono+texto en
  estados, avatares, consistencia de tarjetas, sidebar, estados vacios guiados).

### Archivos tocados

```
src/components/Sidebar.js         (cuenta reorganizada)
src/components/SitioView.js       (FasesChecklist -> IndicadorSitio solo lectura)
src/lib/exporter.js               (hoja Indicadores en vez de Fases)
src/styles/components.css         (cuenta, indicadores, estr-tag.info)
```

---

## Tanda 12 — Limpieza, pase visual §9 y solicitudes 100% visuales

**Fecha:** 2026-06-09
**Estado:** Code-complete. Build verificado. **15/15 tests E2E.**

### Limpieza

- Borrados los archivos muertos: `Header.js`, `RequiereAtencionView.js`,
  `ActividadView.js`, `PendientesView.js`, `NodoRow.js` (verificado que nada los
  importaba).

### Solicitudes 100% visuales (spec §7, sin escribir rutas)

- Eliminado el formulario con campo "Ruta" a mano del panel de cambios de
  estructura. Ahora la **creacion** y el **sobrante** se registran SOLO desde el
  arbol:
  - Crear: pulsar "+ carpeta" en el nodo destino (o en la raiz) y escribir solo el
    nombre; la ruta se calcula del nodo seleccionado. Queda "pendiente de crear".
  - Sobrante: boton "sobrante" en la carpeta existente (con confirmacion si tiene
    archivos).
- El panel de estructura queda como **cola de gestion** (aprobar / aplicado /
  descartar) con estado vacio guiado. Acceso se pide por **select de area** (sin
  rutas). Ningun campo de ruta a mano en ninguna solicitud.

### Pase visual §9

- **Tipografia**: una fuente, dos pesos (400 normal / 500 enfasis). Headings,
  strong, .num, botones, tags y nav a `font-weight: 500` (antes 600/700).
- **Estados = color + icono + texto**: el arbol muestra glifos monocromos (sin
  emojis) por estado — estructura (✓ Creada / ○ Pendiente) y migracion
  (○ Sin empezar, ◑ En progreso, ✓ Migrada, ✓✓ Verificada) ademas del color.
- **Avatares** en header (barra lateral), Mi trabajo, Personas y tarjetas de
  persona (Resumen) — ya con foto real / iniciales.
- **Consistencia** de tarjetas (mismo radio/borde/sombra via `.card` y tokens),
  barra lateral, pestañas y grid de sitios homogeneos.
- Contraste de texto secundario en gris (`--jma-gris-suave`) >= 4.5:1.
- **Cuenta del usuario** (pie de la barra lateral) reorganizada: avatar+nombre
  en una fila (nombre truncado a una linea), badge admin junto al correo, y boton
  "Salir" a lo ancho debajo. Antes se veia apretado con nombres largos.

### Verificacion

- `npm run build` correcto. `npm run test:e2e` -> **15/15**.

### Archivos tocados

```
(borrados) src/components/{Header,RequiereAtencionView,ActividadView,
           PendientesView,NodoRow}.js
src/components/SitioView.js       (panel estructura = cola; sin campo ruta)
src/components/ArbolCarpetas.js   (glifos de estado color+icono+texto)
src/styles/base.css, components.css (pesos 400/500; .ico-estado)
ESPECIFICACION-Dashboard-SGSI.md  (§7 actualizada por Franco: solicitudes visuales)
```

### Pendientes / riesgos

- Validacion en vivo (cuentas admin/no-admin, fotos reales). Despliegue pendiente.

---

## Tanda 11 — Reconciliacion con la ESPECIFICACION (Delta §10)

**Fecha:** 2026-06-09
**Estado:** Code-complete. Build verificado. **15/15 tests E2E.**

`ESPECIFICACION-Dashboard-SGSI.md` es ahora la fuente de verdad (reemplaza los
prompts sueltos). Se reconcilio lo construido y se completo el Delta (§10) en una
tanda coherente.

### Que se hizo (Delta §10)

- **Navegacion concentrada a 5 entradas en BARRA LATERAL** (`Sidebar`): Mi trabajo,
  Resumen, Personas, Sitios, Evidencia. Se absorben los menus sueltos. El shell
  pasa a sidebar + contenido (se retira la barra superior; `Header.js` queda sin
  uso). Ruta activa resaltada (Router `onChange`).
- **Personas** (`PersonasView`): combina "Por usuario" y "Por apoyo" en pestañas
  (UsuariosView/ApoyoView ahora aceptan `embedded`).
- **Sitios** (`SitiosView`, admin): lista de sitios -> arbol de cada uno.
- **Resumen** absorbe "Requiere atencion" y "Actividad reciente" como paneles
  (ya no son menus); avance por persona con **foto** y barra; estructura
  secundaria. Estado vacio que guia.
- **Mi trabajo** (`MiTrabajoView`): arbol de MI(S) area(s) para marcar el estado
  de mis carpetas + acciones de solicitud (crear, sobrante, **solicitar acceso**).
  No asigna "quien migra".
- **Badge "temporal" corregido**: `accesoTemporalSitio(sitio)` -> solo el equipo
  de migracion que NO figura en propietario/acceso del maestro de ESE sitio. En
  su area propia es permanente, sin badge (Franco en hub/CyberSec ya no sale
  temporal). Se elimino `esAccesoTemporal`.
- **Roles aplicados a la UI**: solo admin asigna "quien migra" (gateado en UI y en
  `updateNodo`); el usuario normal solo marca el avance de lo suyo
  (`SelectorMigracion` deshabilitado salvo admin o quien-migra === yo) y registra
  solicitudes. Bloquear/desbloquear: solo admin.
- **Export solo lo APROBADO** (spec §7): `solicitudesAprobadas()` y
  `exportSolicitudesAprobadas()` (CSV+JSON) exportan unicamente `estado=aprobado`;
  EstructuraEvolutivaPanel tiene "Aprobar". Boton de resumen ejecutivo en Evidencia.
- **Identidad del usuario** por correo o por display name (`nombreDesdeUsuario`)
  para resolver "Mi trabajo" del personal sin UPN mapeado.
- Pase de diseño: tokens consistentes, avatares (header/Mi trabajo/Personas/
  tarjetas), estado = color+icono+texto (arbol), estados vacios guiados, sidebar.

### Verificacion

- `npm run build` correcto. `npm run test:e2e` -> **15/15** (nav lateral por rol,
  Personas con pestañas, Mi trabajo, sitio/arbol, asignacion solo-admin,
  verificacion, multi-biblioteca, etc.).

### Archivos tocados (resumen)

```
src/components/Sidebar.js, PersonasView.js, SitiosView.js   (nuevos)
src/components/MiTrabajoView.js   (arbol de mi area + solicitudes; fix loop efecto)
src/components/HomeView.js        (paneles atencion/actividad; fotos por persona)
src/components/SitioView.js       (badge temporal correcto; arbol admin)
src/components/ArbolCarpetas.js   (admin/miNombre: gating de asignacion y edicion)
src/components/EvidenciaView.js   (export aprobadas; enlace ejecutivo)
src/lib/seguimiento-store.js      (esMiembroMaestro/accesoTemporalSitio,
                                   nombreDesdeUsuario, misSitios, guard quien-migra,
                                   solicitudesAprobadas)
src/lib/exporter.js               (exportSolicitudesAprobadas; quien migra)
src/app.js                        (shell sidebar + rutas 5 + sitio/ejecutivo)
src/styles/components.css         (shell, sidebar, tabs, sitios, paneles)
tests/e2e/*                       (roles/usuarios/apoyo/mitrabajo a nav lateral)
CLAUDE.md, PROMPT-INICIAL.md      (apuntan a la ESPECIFICACION)
```

### Decisiones

- Migracion del hub no destructiva (ya en Tanda 10): el legado del hub se lee
  como semilla/respaldo.
- Menus "Pendientes/Atencion/Actividad/Por usuario/Por apoyo/Ejecutivo" como
  entradas sueltas: absorbidos (paneles/pestañas) o reachable por URL (ejecutivo).
  `Header.js`, `RequiereAtencionView.js`, `ActividadView.js`, `PendientesView.js`,
  `NodoRow.js` quedan sin uso (borrables en limpieza).

### Pendientes / riesgos

- Validar en vivo con cuentas admin y no-admin; fotos reales (re-login para tomar
  el scope) y mapeo de correos del roster para fotos de terceros.
- Despliegue pendiente (aparte y guiado).

---

## Tanda 10 — Acceso participativo (roles) + seguimiento por sitio + fotos + confirmacion

**Fecha:** 2026-06-09
**Estado:** Code-complete. Build verificado. **15/15 tests E2E.**

### Fotos en mas lugares

- Foto propia en el **header** (arriba-derecha) via `/me/photo` (sin scope extra,
  cubierto por User.Read); fallback a iniciales (`Avatar me`).
- Avatar en vistas de trabajo: "Mi trabajo" (cabecera) y "Por usuario" (tarjetas),
  con iniciales de fallback.

### 1. Acceso participativo con roles

- El dashboard se abre a TODO el personal del tenant (single-tenant): cualquier
  usuario autenticado entra. `allowed-users.js` -> `ADMINS` + `rolDe()`.
  `evaluateSession` ya no deniega; devuelve `rol` ('admin' | 'usuario').
- **admin** (Franco, Carmen, Ezequiel, Chema, Jorge): ven todas las vistas.
- **usuario**: solo "Mi trabajo" (nav y rutas gateadas por rol en app.js/Header).
  El alcance real de datos lo impone SharePoint via Graph delegado.

### 2. Seguimiento POR SITIO (no en el hub)

- `seguimiento-store.js` reescrito: almacenamiento por sitio
  (`_seguimiento/seguimiento-migracion.json` en cada area). Cada persona escribe
  donde ya tiene permiso. El dashboard agrega los sitios accesibles.
- **Migracion no destructiva** (decision de Franco): el archivo legado del hub se
  lee como semilla/respaldo; los sitios sin archivo propio se siembran en memoria
  desde el legado y persisten a su sitio en la primera escritura. El hub queda
  intacto. La agregacion scope-a cada sitio a su slug -> sin duplicar ni perder.
- Sitios sin acceso (403/404) quedan vacios sin romper. `getSeguimiento()` ahora
  devuelve una vista agregada (para export/Evidencia).

### 3. Seguridad al marcar sobrante / eliminar

- Al marcar "sobrante" una carpeta con archivos (nº via Graph), el arbol exige
  **confirmacion** mostrando el conteo; nunca se propone eliminar contenido sin
  confirmar. (El dashboard nunca borra en SharePoint; solo registra el cambio.)

### Verificacion

- `npm run build` correcto. `npm run test:e2e` -> **15/15** (incluye roles:
  admin ve todo, no-admin solo "Mi trabajo"; usuario E2E configurable con `?as=`).

### Archivos tocados (resumen)

```
src/auth/msal-config.js          (ya tenia User.ReadBasic.All)
src/auth/allowed-users.js        (ADMINS + rolDe)
src/auth/auth-provider.js        (rol en sesion; E2E ?as=; sin denegacion)
src/lib/seguimiento-store.js     (REESCRITO: almacenamiento por sitio + agregacion)
src/lib/fotos.js                 (+ getFotoMe /me/photo)
src/components/Avatar.js         (+ me)
src/components/Header.js         (foto propia; nav por rol)
src/components/MiTrabajoView.js  (avatar propio)
src/components/ArbolCarpetas.js  (confirmacion de sobrante con archivos)
src/app.js                       (rutas gateadas por rol)
src/styles/components.css        (arbol-confirm, rol-badge)
tests/e2e/roles.spec.js          (nuevo); mock: /me/photo 404, semilla seguimiento
```

### Decisiones

- **Migracion del hub no destructiva** (respaldo intacto; semilla + escritura por
  sitio). Ver pregunta resuelta con Franco.
- **Acceso abierto a todo el tenant**; el control fino lo da SharePoint (Graph
  delegado), no una lista blanca.
- **Fotos de terceros** siguen limitadas a los UPN conocidos (`ROSTER_UPN`); el
  resto usa iniciales. La foto propia funciona para cualquiera via `/me/photo`.

### Pendientes / riesgos

- Validar en vivo: escritura por-sitio con permisos reales, agregacion de sitios
  accesibles, fotos reales y el gateo por rol con cuentas no-admin.
- Coste: `loadSeguimiento` ahora resuelve+descarga por cada sitio (12);
  aceptable para el volumen, cacheado por sesion.
- `NodoRow.js` sigue sin uso (borrable). Despliegue pendiente (aparte y guiado).

---

## Tanda 9 — Reenfoque integral: la migracion la hace TODA la gente

**Fecha:** 2026-06-09
**Estado:** Code-complete. Build verificado. **13/13 tests E2E.**

Objetivo unico: seguir la MIGRACION de contenido de toda la plantilla hacia la
estructura nueva. La creacion de carpetas queda en segundo plano.

### Concepto: tres roles por carpeta/sitio

- **Propietario** (destino, informativo): del maestro.
- **Quien migra** (cualquiera del ROSTER, por carpeta): el sujeto del seguimiento.
  Ya NO se usa el propietario por defecto; si una carpeta no tiene quien migra,
  sale en "Requiere atencion".
- **Apoyo SGSI** (Carmen/Ezequiel/Chema), por sitio.

### Cambios principales

- **Roster** (20 personas, acento-libre como el maestro) en los desplegables de
  "quien migra"; `solicitudes_permisos` usa el mismo roster.
- **Fotos de usuario** (`fotos.js` + `Avatar.js`): `/users/{upn}/photo/$value` como
  blob -> objectURL con cache; fallback a iniciales si 404. Scope nuevo
  `User.ReadBasic.All` (ya concedido). UPN conocido solo para los 5 correos
  verificados (`ROSTER_UPN`); el resto cae a iniciales (ampliable).
- **Migracion por carpeta** con quien-migra; el % por persona y sitio se DERIVA.
- **Verificacion controlada**: "Verificada" solo la marca Apoyo SGSI o Franco
  (`puedeVerificar`), enforced en `updateNodo` y en el selector
  (`SelectorMigracion`). Queda en historial con autor/fecha.
- **Vistas nuevas/reordenadas**:
  - "Mi trabajo" (landing `/`): lo que ME toca migrar.
  - "Por usuario": todas las personas con tareas, con foto, avance, apoyo y ultima
    actualizacion; edicion inline.
  - "Por apoyo": cada uno de los 3 y su avance.
  - "Requiere atencion" (`/atencion`): sin quien migra, Restringidas sin migrar,
    bloqueadas (con motivo), sitios estancados 7+ dias.
  - "Actividad reciente" (`/actividad`): feed de cambios (quien/que/cuando).
  - "Resumen" (`/resumen`): encabeza migracion; estructura secundaria.
  - "Sitio": arbol visual (Tanda 8) + quien-migra por carpeta + bloquear/desbloquear.
  - "Ejecutivo" (`/ejecutivo`): resumen de 1 pagina imprimible (PDF via print).
- **Solicitudes exportables**:
  - `cambios_estructura` con ciclo propuesto/aprobado/aplicado/descartado.
  - `solicitudes_permisos[]` (agregar/quitar persona en sitio, con rol y motivo),
    mismo ciclo; panel en la vista Sitio.
  - Boton en Evidencia "Exportar solicitudes pendientes" -> CSV + JSON (todo lo
    propuesto/aprobado aun no aplicado) para PnP.
- **Identidad de personas**: `limpiarNombre()` quita anotaciones "(...)"; el
  maestro ya esta limpio (Franco propietario de Marketing/TI sin duplicar).
- **Diseno**: estado = color + icono + texto; estados vacios que guian; exceljs
  sigue lazy; responsive.

### Schema (backward-compat en normalize)

`nodos[key]`: `migracionEstado`, `quienMigra` (lee `responsable` antiguo como
fallback), `estado` (override/bloqueo). Nuevos `solicitudes_permisos[]`;
`migracion_por_sitio[slug].apoyo`. Todo tolerante a ausencia.

### Verificacion

- `npm run build` correcto. `npm run test:e2e` -> **13/13**: login, mi trabajo
  (landing + vacio guiado), resumen, migracion por carpeta, asignar quien migra
  (Daniela), verificar (Franco), marcar sobrante, agregar carpeta, multi-
  biblioteca, por usuario (vacio + con Daniela sembrada), por apoyo (lista 3 +
  asignar apoyo). Mock ampliado: fotos 404 y semilla de seguimiento.

### Archivos tocados (resumen)

```
src/auth/msal-config.js          (+ scope User.ReadBasic.All)
src/lib/seguimiento-store.js     (ROSTER, ROSTER_UPN, verificadores, quienMigra,
                                  verificacion en updateNodo, statsPorPersona por
                                  quienMigra, actividadReciente, requiereAtencion,
                                  solicitudes_permisos, solicitudesPendientes)
src/lib/fotos.js                 (nuevo)
src/components/Avatar.js, SelectorMigracion.js, MiTrabajoView.js,
  RequiereAtencionView.js, ActividadView.js, EjecutivoView.js  (nuevos)
src/components/ArbolCarpetas.js  (quien migra + bloquear)
src/components/SitioView.js      (acciones quien/bloqueo; panel permisos; aprobar)
src/components/UsuariosView.js   (fotos + apoyo + selector con verificacion)
src/lib/exporter.js              (Quien migra; export solicitudes pendientes)
src/components/EvidenciaView.js  (boton solicitudes; tarjeta migracion)
src/app.js, Header.js            (rutas/nav: mi trabajo, atencion, actividad,
                                  resumen, ejecutivo)
src/styles/components.css        (avatar, feed, atencion, ejecutivo, print)
tests/e2e/*                       (mitrabajo, asignacion nuevos; usuarios, resumen,
                                  estado-flow, mock actualizados)
```

### Decisiones

- **Sin default a propietario** para el sujeto de seguimiento; las carpetas sin
  quien migra se gestionan en "Requiere atencion".
- **Fotos de terceros**: solo hay UPN para los 5 correos verificados; el resto usa
  iniciales hasta ampliar `ROSTER_UPN`. (No se inventan correos.)
- **Ejecutivo via print** (sin libreria PDF extra) para mantener el bundle.
- **Bloqueada** se modela en el override de estructura del nodo (`estado`), con el
  motivo en `notas`; visible en el arbol y en "Requiere atencion".

### Pendientes / riesgos

- Validar en vivo: fotos reales (UPN), verificacion por rol, vistas nuevas.
- Ampliar `ROSTER_UPN` con los correos del resto del roster para sus fotos.
- `NodoRow.js` sigue sin uso (borrable).
- Despliegue pendiente (aparte y guiado).

---

## Tanda 8 — Rol "Apoyo SGSI" + arbol visual de carpetas

**Fecha:** 2026-06-09
**Estado:** Code-complete. Build verificado. **9/9 tests E2E.**

### A. Rol "Apoyo SGSI"

- Campo **Apoyo SGSI** por sitio, elegible SOLO entre **Carmen, Ezequiel,
  Chema** (Franco no es opcion). Persiste en `migracion_por_sitio[slug].apoyo`
  (backward-compat: `migracion_por_sitio` ya estaba en el schema). Store:
  `EQUIPO_APOYO`, `getApoyoSitio`, `setApoyoSitio`, `statsMigracionPorApoyo`.
- Se muestra en la **cabecera del sitio**, junto al responsable del area
  (propietario) y el acceso.
- Vista **"Por apoyo"** (`/apoyo`): por cada uno de los 3, los sitios que
  acompaña y el avance derivado de cada uno (X/Y, %). Nav: Por apoyo.
- Export: columna Apoyo SGSI en la hoja "Migracion por sitio".

### B. Arbol visual e interactivo de carpetas (`ArbolCarpetas.js`)

Sustituye la lista plana (`NodoRow`, ya sin uso) por un explorador anidado:
- Jerarquia reconstruida desde las rutas; **sintetiza nodos de biblioteca** en
  sitios multi-biblioteca; expandible/colapsable (Expandir/Colapsar todo).
- Por carpeta: nombre indentado por nivel + **icono de carpeta** (SVG, sin
  emojis), **badge de clasificacion** con su color, estado de **estructura**
  (Creada/Pendiente), estado de **migracion** (etiqueta/color) editable inline
  (auto-guarda), y **nº de archivos** como señal.
- Cabecera del sitio: propietario y acceso (con marca temporal).
- Acciones en el arbol:
  - **Agregar carpeta** en cualquier nodo (o raiz) -> registra `cambio_estructura`
    tipo crear (estado propuesto) y la muestra **punteada/gris "pendiente de
    crear"**, SIN crearla en SharePoint (eso lo hace PnP).
  - **Marcar sobrante** en una carpeta existente -> `cambio_estructura` sobrante
    (la fila se tacha).
  - Expandir/colapsar ramas; "quitar" una pendiente (descarta el cambio).
- Se mantienen fases y la tabla de Estructura evolutiva (gestion de cambios) y la
  exportacion CSV para PnP.

### Verificacion

- `npm run build` correcto. `npm run test:e2e` -> **9/9**: login, resumen,
  migracion por carpeta (arbol, auto-guarda), marcar sobrante, agregar carpeta
  (pendiente de crear), multi-biblioteca (Creada en el arbol), por usuario
  (fallback propietario), por apoyo (lista los 3) y asignar apoyo (persiste).

### Archivos tocados

```
src/lib/seguimiento-store.js   (EQUIPO_APOYO, getApoyoSitio, setApoyoSitio,
                                statsMigracionPorApoyo)
src/components/ArbolCarpetas.js (nuevo: arbol interactivo)
src/components/SitioView.js     (cabecera con propietario/apoyo/acceso; usa el
                                arbol; mantiene fases y estructura evolutiva)
src/components/ApoyoView.js     (nuevo: vista Por apoyo)
src/lib/exporter.js             (+ columna Apoyo)
src/components/Header.js, src/app.js (ruta/nav /apoyo)
src/styles/components.css       (arbol, cabecera, acciones)
tests/e2e/*                      (arbol.spec y apoyo.spec nuevos; migracion-flow,
                                estado-flow [sobrante], multibiblioteca al arbol)
NodoRow.js                       (queda sin uso; reemplazado por el arbol)
```

### Decisiones

- **Migracion auto-guarda** al cambiar el selector en el arbol (sin boton), mas
  agil para el responsable.
- **Carpetas "pendientes de crear"** se ven en el arbol pero NO se crean en
  SharePoint; salen en el CSV/PnP. Override de estructura manual (Verificada/
  Bloqueada) se retira de la UI del arbol; el campo `estado` se conserva en el
  schema/export por compatibilidad.

### Pendientes / riesgos

- Validar en vivo el arbol y el rol Apoyo con datos reales.
- `NodoRow.js` quedo sin uso (se puede borrar en una limpieza).
- Despliegue sigue pendiente (aparte y guiado).

---

## Tanda 7 — Reenfoque a MIGRACION por persona (a nivel de carpeta)

**Fecha:** 2026-06-09
**Estado:** Code-complete. Build verificado. **6/6 tests E2E.**

La creacion de carpetas (estructura) ya cumplio: pasa a vista secundaria. El eje
ahora es la MIGRACION de contenido, rastreada a nivel de CARPETA, con %s
DERIVADOS y "Por usuario" como vista principal.

### Que se hizo

1. **Migracion por CARPETA** (no por sitio): cada nodo tiene
   `migracionEstado` (Sin empezar / En progreso / Migrada / Verificada) que el
   responsable actualiza. `NodoRow` lo pone como control primario; el override de
   estructura queda secundario. Se muestra el nº de archivos por carpeta (Graph)
   como señal de apoyo.
2. **%s derivados**: `statsMigracionSitio`, `statsMigracionGlobal` y
   `statsMigracionPorPersona` calculan migradas/total (cuentan "Migrada" y
   "Verificada"). Se elimino el % a mano por sitio (`migracion_por_sitio` queda en
   el schema solo por backward-compat; ya no se escribe).
3. **"Por usuario" = vista principal**: por responsable, sus carpetas agrupadas
   por sitio, X/Y migradas, %, ultima actualizacion y pendientes; el estado de
   cada carpeta se edita inline (persiste en el nodo). Cabecera plegable.
4. **Resumen** encabeza con migracion (global + mini-barras por persona + tabla
   por sitio con migracion primero); "Estructura (carpetas creadas)" queda como
   bloque secundario mas pequeño (con detalle plegable y el grafico).
5. **Responsable por defecto = `propietario`** del maestro (no se persiste; solo
   para derivar/visualizar y que "Por usuario" no salga vacio). No pisa
   responsables puestos a mano.

- Se mantienen Permisos (acceso del maestro + temporal), Estructura evolutiva
  (cambios para PnP) y Evidencia.
- **Export** actualizado: hoja Carpetas lidera con Migracion + responsable
  efectivo; hojas "Migracion por sitio" y "Migracion por persona" derivadas;
  Historial incluye migracion antes/nuevo. CSV de PnP intacto.
- `updateNodo` ahora acepta `migracionEstado` y registra ambos cambios
  (migracion y estructura) en el historial.

### Verificacion

- `npm run build` correcto. `npm run test:e2e` -> **6/6** (login, resumen
  reenfocado, override de estructura, migracion por carpeta, multi-biblioteca,
  por usuario con fallback a propietario).

### Archivos tocados

```
src/lib/seguimiento-store.js   (ESTADOS_MIGRACION_CARPETA, migracionEstado en
                                updateNodo, migracionDeNodo, responsableEfectivo,
                                statsMigracionSitio/Global/PorPersona; se quitan
                                getMigracionSitio/updateMigracionSitio)
src/components/NodoRow.js       (migracion = control primario; estructura secundario)
src/components/SitioView.js     (avance derivado; quita MigracionPanel; paneles
                                como info secundaria)
src/components/UsuariosView.js  (vista principal: avance por persona + edicion inline)
src/components/HomeView.js      (Resumen: migracion primero, estructura secundaria)
src/components/EvidenciaView.js (tarjeta principal = migracion)
src/lib/exporter.js             (hojas derivadas + migracion en Carpetas/Historial)
src/components/Header.js        (nav: Por usuario tras Resumen)
src/styles/components.css       (destacados, mini-barras, secundarios, usuario)
tests/e2e/*                      (migracion-flow reescrito; usuarios.spec nuevo;
                                resumen/estado-flow/multibiblioteca actualizados)
```

### Decisiones

- **migracion_por_sitio deprecado** (no se borra del schema; se ignora). El %
  por sitio ahora es derivado.
- **Responsable por defecto = propietario** solo para derivar; no se persiste,
  asi no "ensucia" el seguimiento ni pisa asignaciones manuales.
- **"Migrada" y "Verificada" cuentan como migrado** para el %; "En progreso" y
  "Sin empezar" no.

### Pendientes / riesgos

- Validar en vivo el flujo por carpeta y los %s derivados con datos reales.
- Despliegue sigue pendiente (aparte y guiado).

---

## Ajuste — Deteccion en sitios multi-biblioteca (2026-06-09)

**Estado:** Aplicado. Build + 5/5 tests E2E.

**Sintoma:** Direccion y Gobierno mostraba ~11% de estructura aunque las carpetas
existen.

**Causa:** el sitio es multi-biblioteca en el JSON (Consejo, Direccion General,
Gerencia General), pero al aprovisionar esas "bibliotecas" se crearon como
CARPETAS dentro de la biblioteca por defecto ("Documentos compartidos"), no como
drives separados. La deteccion buscaba drives con esos nombres y no los hallaba.

**Arreglo:** la deteccion ya no busca drives separados. Para todos los sitios se
usa el drive por defecto y la **ruta completa** (en multi-biblioteca, el nombre
de la biblioteca es la primera carpeta: `/drive/root:/{biblioteca}/{ruta}`).
- `structure-store.js`: `rutaEnDrive = ruta` (ruta completa, ya no se quita el
  prefijo de biblioteca).
- `migration-store.js`: se elimina la resolucion de drives por nombre
  (`listDrives`); se lee solo el drive por defecto.
- Test nuevo `multibiblioteca.spec.js` (lock de regresion) + mock con rutas
  anidadas. Con esto Direccion y Gobierno refleja su % real.

---

## Tanda 6 — Ampliaciones: estructura vs migracion, usuarios, permisos, estructura evolutiva

**Fecha:** 2026-06-09
**Estado:** Code-complete. Build verificado. **4 tests E2E Playwright pasando.**

### Punto clave resuelto

Se separan DOS metricas distintas (antes "%" mezclaba ambas):
- **Estructura**: carpetas creadas, automatico via Graph (lo que ya existia).
- **Migracion de contenido**: avance manual de mover archivos a las carpetas.
Ya no se llama "migracion" a la creacion de carpetas.

### Que se hizo

1. **Dos metricas en el Resumen**: bloque "Estructura (carpetas creadas)" (auto)
   y bloque "Migracion de contenido" (manual, % promedio por sitio). Tabla por
   sitio con columnas separadas (Estructura % + Migracion estado/%).
2. **Migracion por sitio** (vista Sitio, panel editable): estado
   (Pendiente/En progreso/Completada/Verificada) + responsable + % + nota, con
   historial. Persiste en `migracion_por_sitio[slug]`. Ademas, **nº de archivos
   por carpeta** via Graph (señal de avance) mostrado en cada carpeta.
3. **Vista por usuario** (`/usuarios`): agrupa por responsable los sitios
   (migracion), carpetas (override) y pendientes asignados.
4. **Permisos por sitio** (solo lectura): muestra Propietario + acceso del
   maestro (`sitio.acceso`) con badge **temporal** para Franco/Carmen/Ezequiel/
   Chema. Decision de Franco: SIN scopes nuevos (no se agrega Group.Read.All); los
   admins de coleccion no se muestran (no leibles via Graph).
5. **Estructura evolutiva** (vista Sitio): registrar "carpeta a crear" o
   "sobrante" -> `cambios_estructura[]`, con estado propuesto/aplicado/descartado.
   Export **CSV para PnP** en la vista Evidencia. El dashboard NO crea ni borra
   carpetas reales.

- **Schema ampliado** (`seguimiento-migracion.json`) con `migracion_por_sitio` y
  `cambios_estructura`, con backward-compat en `normalize()` y `emptySeg()`.
- **Export** ampliado: hojas "Migracion" y "Cambios estructura" en el Excel +
  CSV dedicado de cambios para PnP.

### Verificacion

- `npm run build` correcto (bundle principal ~573 kB; exceljs sigue en chunk
  aparte y diferido).
- `npm run test:e2e` -> **4/4 passed** (login, Resumen 2 metricas, flujo de
  estado de carpeta, flujo de migracion por sitio). Los flujos de escritura
  nuevos quedan verificados contra mocks.

### Archivos tocados

```
src/lib/seguimiento-store.js   (+ migracion_por_sitio, cambios_estructura,
                                 ESTADOS_MIGRACION, TIPOS/ESTADOS_CAMBIO,
                                 EQUIPO_MIGRACION/esAccesoTemporal, CRUD)
src/graph/sharepoint-reader.js (collectFolderPaths -> {folders, files})
src/lib/migration-store.js     (archivos por nodo)
src/lib/exporter.js            (hojas Migracion y Cambios + exportCambiosCSV)
src/components/HomeView.js      (dos metricas + tabla)
src/components/SitioView.js     (+ MigracionPanel, PermisosPanel, EstructuraEvolutivaPanel)
src/components/NodoRow.js       (+ nº de archivos)
src/components/UsuariosView.js  (nuevo)
src/components/EvidenciaView.js (+ export CSV PnP)
src/components/Header.js, src/app.js   (+ ruta/nav /usuarios)
src/styles/components.css       (+ metricas, paneles, acceso, usuarios)
tests/e2e/migracion-flow.spec.js (nuevo); resumen.spec.js (etiquetas nuevas)
```

### Decisiones

- **Permisos sin scopes nuevos** (eleccion de Franco): acceso del maestro +
  temporal; sin Group.Read.All ni admin consent adicional.
- **% migracion global** = promedio simple del % por sitio (no ponderado por
  tamaño). Si se quiere ponderar por nº de carpetas/archivos, es ajuste menor.
- **Conteo de archivos** solo en carpetas existentes (señal, no metrica formal).

### Pendientes / riesgos

- Validar en vivo los nuevos paneles (migracion, estructura evolutiva) y el
  conteo de archivos en sitios reales.
- Preferencia del Header RESUELTA (2026-06-09): Franco eligio fondo claro con el
  logo color. Header cambiado a superficie clara, texto/nav/boton ajustados; el
  logo blanco queda disponible por si se necesita un fondo oscuro.
- Despliegue sigue pendiente (se hara aparte y guiado).

---

## Tanda 5 — Export de evidencia + pulido + tests Playwright

**Fecha:** 2026-06-09
**Estado:** Code-complete. Build verificado. **3 tests E2E Playwright pasando.**

### Que se hizo

- **Export de evidencia a Excel** (`src/lib/exporter.js`, `exceljs`):
  `EvidenciaView` (ruta `/evidencia`) genera un .xlsx con 5 hojas: Resumen por
  sitio (con % y fases X/7), Carpetas (estado efectivo, fuente, clasificacion,
  biblioteca, existe-Graph, responsable, notas, ultima modif.), Historial
  (todas las entradas de cambio con autor/fecha), Pendientes y Fases. Cabeceras
  con estilo de marca y fila congelada. Descarga como
  `Evidencia-SGSI-YYYYMMDD.xlsx`.
- **exceljs cargado de forma diferida** (`import()` dinamico): salio del bundle
  principal (vuelve a ~559 kB / 164 kB gzip) a un chunk propio (~939 kB) que solo
  se baja al exportar.
- **Tests E2E Playwright** (`tests/e2e/`): `login.spec` (pantalla de login con
  boton habilitado + logo), `resumen.spec` (Resumen con Graph mockeado muestra
  avance y sitios), `estado-flow.spec` (cambiar estado en la vista Sitio escribe
  el seguimiento via PUT y confirma en UI). Helper `_helpers/graph-mock.js`
  intercepta `graph.microsoft.com`. **`npm run test:e2e` -> 3 passed.**
- **Seam de pruebas E2E** en `auth-provider.js` (activado con `?e2e=1`): evita el
  login interactivo de Microsoft usando una sesion ficticia autorizada. No afecta
  el comportamiento de produccion.
- Nav del Header ampliado: Resumen / Pendientes / Evidencia.

### Verificacion

- `npm run build` correcto (216 modulos; exceljs en chunk aparte).
- `npm run test:e2e` -> 3/3 passed (chromium). Los tests ejercitan el codigo real
  (resolucion de sitio, drives, `collectFolderPaths`, merge, escritura del
  seguimiento con creacion de `_seguimiento` + PUT), validando contra mocks la
  logica de las Tandas 2-3.

### Archivos tocados

```
src/lib/exporter.js              (nuevo; exceljs lazy)
src/components/EvidenciaView.js  (nuevo)
src/auth/auth-provider.js        (+ seam E2E ?e2e=1)
src/app.js                       (+ ruta /evidencia)
src/components/Header.js         (+ nav Evidencia)
package.json                     (+ @playwright/test, script test:e2e)
playwright.config.js             (nuevo)
tests/e2e/{login,resumen,estado-flow}.spec.js   (nuevos)
tests/e2e/_helpers/graph-mock.js (nuevo)
```

### Decisiones

- **Export solo Excel** (no CSV aparte): el .xlsx multi-hoja cubre la evidencia
  de auditoria de forma mas completa y legible. Si se requiere CSV plano para el
  auditor, se agrega un export adicional de la hoja Carpetas.
- **Seam E2E por query param** en vez de mock de MSAL: minimo, contenido y sin
  riesgo en produccion (solo se activa con `?e2e=1`).

### Pendientes / riesgos

- Bundle principal aun ~559 kB: se podria diferir tambien Chart.js y el stack
  Graph; queda como optimizacion opcional.
- Confirmar preferencia del Header (logo color sobre fondo claro vs blanco sobre
  oscuro) — heredado de Tanda 4.
- Despliegue (GitHub `FLCybersec/dashboard-iso-sgsi` + Cloudflare Pages + DNS)
  NO realizado por instruccion de Franco; se hara aparte y guiado.

### Estado del proyecto

Tandas 1-5 code-complete. Tandas 1-3 validadas en vivo por Franco; 4-5
verificadas por build + E2E. Listo para la fase de despliegue guiado.

---

## Tanda 4 — Pendientes + checklist de fases por sitio

**Fecha:** 2026-06-09
**Estado:** Code-complete. Build verificado (210 modulos). Login y lectura en
vivo ya confirmados por Franco en la Tanda 3.

### Que se hizo

- **Logos JMA** integrados (public/logos): logo **blanco** en el Header (fondo
  oscuro), logo **color** en el Login (tarjeta clara), `color_small` como favicon.
  Alto fijo + ancho automatico (sin deformar), discretos. Ver decision abajo.
- **Pendientes** (`PendientesView.js` + store): alta (descripcion <=200, sitio,
  responsable, fecha objetivo, prioridad), edicion inline, cierre/reapertura
  (checkbox -> `completado`/`completadoEn`), filtros por sitio / responsable /
  prioridad y toggle "ver completados". Orden: abiertos primero, luego por
  prioridad y fecha objetivo. Persistencia a `seguimiento.pendientes[]`.
- **Checklist de fases por sitio** en la vista Sitio: las 7 fases del brief
  (`sitio_creado`, `asociado_hub`, `carpetas_creadas`, `permisos_aplicados`,
  `retencion_aplicada`, `versionado_activado`, `sync_validado`). Cada toggle
  persiste en `seguimiento.fases_por_sitio[slug]`. Contador X/7.
- **Navegacion**: ruta `/pendientes` y nav en el Header (Resumen / Pendientes);
  el brand sigue llevando al Resumen.

### Archivos tocados

```
src/lib/seguimiento-store.js   (+ PRIORIDADES, FASES, pendientes y fases CRUD)
src/components/PendientesView.js   (nuevo)
src/components/SitioView.js        (+ FasesChecklist)
src/components/Header.js           (+ logo blanco, + nav)
src/components/LoginScreen.js      (+ logo color)
src/app.js                         (+ ruta /pendientes)
index.html                         (+ favicon color_small)
src/styles/components.css          (+ nav, fases, pendientes, filtros, prioridad,
                                     logos)
```

### Decisiones

- **Logo del Header = variante blanca** (no color). El Header tiene fondo oscuro;
  por legibilidad se aplica el principio "blanco en fondos oscuros". Franco pidio
  literalmente "color en Header"; si lo quiere asi, basta volver el header a fondo
  claro y cambiar a la variante color (cambio menor). Pendiente de su preferencia.
- **Pendientes sin sitio** permitidos (campo sitio opcional) para tareas
  generales de migracion.
- **Cierre = `completado` + `completadoEn`** (no se borra el pendiente), para
  conservar evidencia. Hay edicion pero no borrado fisico.

### Pendientes / riesgos

- Igual que tandas previas: confirmar en vivo escritura de pendientes/fases.
- Confirmar preferencia del Header (logo color sobre fondo claro vs blanco sobre
  oscuro).

### Siguiente paso (Tanda 5)

- Export de evidencia con `exceljs` (estado efectivo + historial + pendientes +
  fases), pulido visual y tests Playwright (login y flujo de estado).

---

## Tanda 3 — Seguimiento (seguimiento-migracion.json): override manual + historial

**Fecha:** 2026-06-09
**Estado:** Code-complete. Build verificado. **Client ID ya configurado por
Franco**, asi que la validacion en vivo de las Tandas 2 y 3 queda desbloqueada
(el login interactivo no se puede ejecutar en el entorno de Claude Code).

### Que se hizo

- **Lectura/escritura de `seguimiento-migracion.json`** en el hub via Graph
  (`src/graph/seguimiento-graph.js`, fetch directo con token MSAL):
  - `downloadSeguimiento(hubSiteId)` -> objeto o null si aun no existe (404).
  - `uploadSeguimiento(hubSiteId, obj)` -> PUT a
    `/sites/{hub}/drive/root:/_seguimiento/seguimiento-migracion.json:/content`.
  - `ensureFolder`: crea la carpeta de control `_seguimiento` solo si no existe
    (idempotente). Es la UNICA carpeta que crea el dashboard.
- **Store de seguimiento** (`src/lib/seguimiento-store.js`): estado en memoria,
  `normalize()` con backward-compat (tolera campos/colecciones ausentes),
  `loadSeguimiento`, `getOverride(key)`, `updateNodo(...)` (aplica override,
  registra entrada de `historial` con autor/fecha/estado_anterior/estado_nuevo,
  sella `ultimaModificacion`/`modificadoPor`/`modificadoPorEmail` y persiste el
  archivo completo). Constante `ESTADOS` con los 6 estados del brief.
  - **Merge (brief 4.4):** `estadoEfectivo(existe, override)` -> el override
    manual gana; si no hay, deriva de Graph (existe -> "Creada", si no ->
    "Pendiente").
- **Autoria:** `currentUser()` en `auth-provider.js` (nombre + email de la cuenta
  MSAL activa) alimenta `modificadoPor`/`modificadoPorEmail`.
- **Routing** con `preact-router` en `app.js`: `/` (Resumen) y `/sitio/:slug`
  (Sitio). Brand del header y nombres de sitio en el Resumen navegan.
- **Vista Sitio** (`SitioView.js` + `NodoRow.js`): arbol de carpetas del maestro
  con indentacion por profundidad, badge de clasificacion (color del JSON),
  estado efectivo (manual/auto), y edicion por nodo de estado/responsable/notas +
  nota de cambio -> escribe al seguimiento. Muestra ultima modificacion y conteo
  de historial. Aviso cuando el sitio aun no existe (permite override igual).

### Verificacion

- `npm run build` correcto (209 modulos). Consola del navegador sin errores con
  los nuevos modulos (preact-router, stores de seguimiento).
- Flujo autenticado (escritura real del seguimiento, edicion en la vista Sitio)
  NO ejercitado aqui: requiere login interactivo de Microsoft. Pendiente de
  validacion en vivo de Franco (ya desbloqueada con el Client ID puesto).

### Archivos tocados

```
src/graph/seguimiento-graph.js       (nuevo)
src/lib/seguimiento-store.js         (nuevo)
src/components/SitioView.js          (nuevo)
src/components/NodoRow.js            (nuevo)
src/auth/auth-provider.js            (+ currentUser)
src/app.js                           (+ Router + ruta /sitio/:slug)
src/components/Header.js             (brand navega a /)
src/components/HomeView.js           (nombres de sitio enlazan a /sitio/:slug)
src/styles/components.css            (+ nodos, badge, estado-tag, enlaces)
```

### Decisiones

- **`_seguimiento` la crea el dashboard si falta.** El brief dice que el
  dashboard no crea carpetas de la estructura SGSI; se interpreta que su propia
  carpeta de control es la excepcion necesaria para poder escribir el contrato.
  Si Franco prefiere que la aprovisione PnP, se quita `ensureFolder` en un cambio
  menor.
- **Persistencia del archivo completo** en cada `updateNodo` (no PATCH parcial):
  simple y suficiente para 1-5 usuarios. Riesgo de clobber concurrente bajo.
- **`pendientes` y `fases_por_sitio`** se inicializan vacios en el schema pero su
  UI llega en la Tanda 4.

### Pendientes / riesgos

- Validacion en vivo de escritura (que el PUT cree el archivo y el historial sea
  correcto) pendiente de Franco.
- Confirmar en vivo el modelo de `carpetasComunes` en sitios multi-biblioteca
  (heredado de Tanda 2).
- Bundle ~541 kB (160 kB gzip): optimizacion futura (lazy-load Chart.js/Graph).

### Siguiente paso (Tanda 4 — al validar)

- Vista Pendientes: alta/edicion/cierre de pendientes y carpetas por crear
  (con responsable, fecha objetivo, prioridad), filtros por sitio/responsable/
  prioridad. Checklist de `fases_por_sitio` en la vista Sitio.

---

## Tanda 2 — Lectura Graph + Resumen con avance automatico

**Fecha:** 2026-06-09
**Estado:** Code-complete. Build verificado. Pendiente validacion en vivo de
Franco (requiere el Client ID configurado para ejercitar Graph).

### Que se hizo

- **Cambio de dependencia (a pedido de Franco):** se elimino `xlsx` (SheetJS)
  por su vulnerabilidad *high* conocida y se adopto **`exceljs`** para el export
  (se usara en la Tanda 5). `npm audit` ya no reporta *high*; quedan 4 *moderate*
  (esbuild/vite de dev y un `uuid` transitivo de exceljs, sin parche directo, sin
  impacto en runtime de produccion).
- **Lectura SharePoint via Graph** (solo lectura, `Sites.Read.All`):
  - `resolveSiteId(slug)` -> siteId o null si el sitio no existe aun.
  - `getDefaultDriveId` + `listDrives` para soportar sitios multi-biblioteca
    (Direccion y Gobierno: Consejo / Direccion General / Gerencia General).
  - `collectFolderPaths(driveId)`: recorrido recursivo que devuelve el Set de
    rutas de carpeta existentes (solo entra a carpetas que existen).
  - Uso SIEMPRE de `/drive` y `/drives` (independiente del idioma); NO se
    construyen rutas con "Shared Documents" ni "Documentos compartidos".
- **Deteccion de estado** (`migration-store.js`): por cada sitio resuelve siteId,
  agrupa nodos por su drive (biblioteca con nombre o drive por defecto) y marca
  cada nodo `existe`/pendiente comparando `rutaEnDrive` (minusculas) contra el Set
  del drive. Sitio inexistente => todos sus nodos pendientes, sin romper. Errores
  de red/permisos se reportan por sitio en `warning` sin tumbar el resto.
- **Cache idb** (`db.js`) stale-while-revalidate con **TTL 10 min** + boton
  **Actualizar** (force refresh) y sello de "Actualizado: ...".
- **Vista Resumen** reescrita: barra de avance global, tarjetas (sitios creados,
  carpetas creadas, pendientes, % global), **grafico Chart.js** de % por sitio
  (color por semaforo) y tabla por sitio con semaforo, barra y creadas/total.
- Se anadio `rutaEnDrive` a cada nodo en `structure-store.js` (ruta dentro del
  drive, sin el prefijo de biblioteca). La clave canonica `${slug}::${ruta}` no
  cambia.

### Verificacion

- `npm run build` correcto (204 modulos). Consola del navegador sin errores al
  cargar (imports de Graph y Chart.js no rompen). La pantalla de login no
  regresiona.
- La deteccion en vivo NO se pudo ejercitar: requiere el Client ID real para
  autenticar contra Graph. Queda como validacion pendiente de Franco.

### Archivos tocados

```
package.json                         (xlsx -> exceljs)
src/graph/graph-client.js            (nuevo)
src/graph/sharepoint-reader.js       (nuevo)
src/lib/db.js                        (nuevo)
src/lib/migration-store.js           (nuevo)
src/components/AvanceChart.js        (nuevo)
src/components/HomeView.js           (reescrito: Resumen con avance)
src/lib/structure-store.js           (+ rutaEnDrive por nodo)
src/styles/components.css            (+ barra, semaforo, grafico, view-head)
```

### Decisiones

- **Sitios multi-biblioteca:** cada biblioteca del JSON se trata como un drive
  distinto (match por nombre en `/drives`). Las `carpetasComunes`
  (_Plantillas/_Migracion/_Archivo) se buscan en el drive por defecto del sitio.
  A confirmar con datos reales en la validacion (puede ajustarse).
- **Deteccion por recorrido recursivo** (no 1 GET por carpeta): mas eficiente en
  sitios poco migrados y evita consultar hijos de padres inexistentes.
- **Estado Tanda 2 = solo existencia** (Creada/Pendiente). El override manual
  (Verificada/Bloqueada) y el merge con `seguimiento` llegan en la Tanda 3.

### Pendientes / riesgos

- **Validacion en vivo bloqueada** hasta configurar el Client ID (sigue
  `CLIENT_ID_PENDIENTE`).
- **Bundle ~528 kB** (155 kB gzip): aviso de Vite por >500 kB. Optimizacion
  futura: lazy-load de Chart.js y del stack Graph con `import()` dinamico.
- Confirmar en vivo el modelo de `carpetasComunes` en sitios multi-biblioteca.

### Siguiente paso (Tanda 3 — al validar)

- `seguimiento-migracion.json` en el hub: lectura/escritura via Graph PUT,
  override manual de estado/nota/responsable por nodo, `historial` con
  autor/fecha (evidencia ISO). Merge: Graph (existe->Creada) salvo override.

---

## Tanda 1 — Bootstrap (login + lista blanca + carga del maestro)

**Fecha:** 2026-06-09
**Estado:** Completada. Pendiente de validacion de Franco.

### Que se hizo

- Bootstrap del proyecto **Vite 5 + Preact + htm**, sin backend (modelo canonico
  `jma-modelo-dashboard-cowork`). Build de produccion verificado (151 modulos,
  sin errores; bundle ~287 kB / 74 kB gzip).
- **Autenticacion MSAL** (`@azure/msal-browser` v3) cableada de extremo a extremo:
  init con `handleRedirectPromise`, login por popup, logout local (`clearCache`),
  `acquireTokenSilent` con fallback a popup (listo para Graph en Tanda 2).
  Cache en `sessionStorage`, `prompt: 'select_account'`.
- **Lista blanca** en codigo (5 usuarios: Franco, Ezequiel, Carmen, Chema, Jorge),
  comparacion case-insensitive. La sesion se evalua a 3 estados: sin sesion /
  denegado (autenticado pero fuera de lista) / autorizado.
- **Carga de la estructura maestra** desde `public/estructura-maestra-sgsi.json`
  con aplanado a nodos de clave canonica `${slug}::${ruta}`. Soporta los tres
  formatos del JSON: `carpetas[]`, `bibliotecas[].carpetas[]` (multi-biblioteca)
  y `carpetasComunes[]`, con `hijos[]` recursivos.
- **UI**: pantalla de login (con avisos de Client ID pendiente / acceso denegado /
  error) y vista Resumen placeholder que confirma la carga del maestro (totales +
  tabla de 12 sitios con su numero de carpetas). Identidad JMA: Arial, sobrio,
  sin emojis; colores de clasificacion tomados del JSON.
- Documentacion: `README.md` (con pasos del App Registration), `CLAUDE.md`,
  `PROMPT-INICIAL.md`, `.gitignore`, `.claude/launch.json`.

### Verificacion

- `npm install` y `npm run build` correctos.
- Conteo del aplanador validado contra el brief: **12 sitios, 171 carpetas**
  (coincide exacto). Desglose por sitio: Concentrador 12, DireccionGobierno 26,
  RecursosHumanos 28, Juridico 9, Finanzas 15, Administracion 10, SP-Tijuana 10,
  SP-Ensenada 10, CyberSec 21, K9 11, Marketing 12, TI 7.
- Login renderizado y revisado en navegador (estado Tanda 1: aviso de Client ID
  pendiente + boton deshabilitado, como se espera).

### Archivos creados

```
package.json, vite.config.js, index.html, .gitignore
public/_redirects, public/estructura-maestra-sgsi.json
src/main.js, src/app.js
src/auth/{msal-config.js, allowed-users.js, auth-provider.js}
src/lib/structure-store.js
src/components/{LoginScreen.js, Header.js, HomeView.js}
src/styles/{tokens.css, base.css, components.css}
README.md, CLAUDE.md, PROMPT-INICIAL.md, .claude/launch.json
```

### Decisiones

- **Clave de nodo = `${slug}::${ruta}`** (no `driveItemId`), por ser estructura
  y no documentos. Es el contrato del futuro `seguimiento-migracion.json`.
- **Estructura maestra servida desde `public/`** (no leida del hub). Mas simple
  y sin dependencia de Graph para el "deber ser". Se puede mover al hub luego.
- **`carpetasComunes` (_Plantillas/_Migracion/_Archivo)** se modelan como nodos
  de nivel raiz del sitio (un solo juego por sitio). A revisar en Tanda 2 si en
  los sitios multi-biblioteca deben existir por biblioteca.
- **Sin routing todavia**: la app autenticada muestra el Resumen directo.
  `preact-router` y las vistas Sitio/Pendientes/Evidencia llegan en tandas 2-5.

### Bloqueante / accion requerida de Franco

- **Crear el App Registration "Dashboard JMA SGSI"** en Entra (pasos en
  `README.md`) y pegar el **Client ID** en `src/auth/msal-config.js`
  (hoy `CLIENT_ID_PENDIENTE`). Hasta entonces el login esta deshabilitado por
  diseno; el resto del andamiaje ya funciona.

### Riesgos / notas

- `npm audit` reporta 3 vulnerabilidades (2 moderate dev en esbuild/vite, 1 high
  en `xlsx`/SheetJS). No se aplico `--force` para no romper. `xlsx` se usa hasta
  la Tanda 5 (export); revisar entonces (posible migracion a `exceljs`).
- Repo GitHub `FLCybersec/dashboard-iso-sgsi` y Cloudflare Pages aun no creados
  (corresponde a la tanda de despliegue).

### Proximos pasos (Tanda 2 — al validar)

- Resolver `siteId` por slug via Graph y detectar existencia de carpetas
  (200/404) por `${slug}::${ruta}`.
- **Importante (Franco):** los sitios son Communication Sites en espanol
  (biblioteca por defecto "Documentos compartidos"). Usar SIEMPRE
  `/sites/{siteId}/drive/root:/{ruta}` (independiente del idioma). NO construir
  rutas con "Shared Documents" ni "Documentos compartidos". Detalle en CLAUDE.md.
- Vista Resumen con % de avance automatico, semaforo por sitio y grafico Chart.js.
- Cache `idb` (TTL 10 min) + boton refresh. Sitios inexistentes => todas sus
  carpetas "Pendiente" sin romper.
