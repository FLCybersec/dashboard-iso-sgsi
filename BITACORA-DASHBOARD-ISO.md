# Bitacora — Dashboard de Migracion ISO 27001 (SGSI JMA)

Coordinacion Cowork <-> Claude Code. Se actualiza al cerrar cada tanda.
No se avanza de tanda sin validacion de Franco.

---

## Code — FIX del bug de carga: vistas globales NO bloquean en el crawl (2026-06-19)

Corregida la regresion. Las vistas globales (Sitios/Resumen/Ejecutivo/Apoyo/
Evidencia) ya **no esperan** el recorrido vivo de los 12 sitios para renderizar.

**Patron (stale-while-revalidate):** cada vista pinta de inmediato con estructura
+ seguimiento (rapido) + el inventario CACHEADO (`peekMigrationState`, una lectura
idb, sin Graph). El recorrido vivo (`loadMigrationState`) corre en **segundo
plano** y refresca las metricas al terminar. El render nunca bloquea en el crawl.

- `migration-store`: nuevo `peekMigrationState()` (cache idb, posiblemente vencida,
  sin tocar Graph). TTL del inventario subido a **15 min** (la estructura cambia
  despacio); "Actualizar" lo fuerza. El crawl jamas corre en el camino de render.
- Vistas: `HomeView`, `SitiosView`, `EjecutivoView`, `ApoyoView` -> peek + carga
  en 2o plano, con indicador "Calculando/Actualizando inventario...". `EvidenciaView`
  pinta con peek y **asegura el inventario fresco al EXPORTAR** (accion explicita,
  con su "Generando..."), no al abrir.
- **Degradado mientras llega el conteo:** sin inventario aun, el % cae al fallback
  sobre entradas de seguimiento (ya existia `totalLiveDe`); las metricas se afinan
  cuando el crawl de fondo termina. Vistas tolerantes a `mig === null`.

**Sobre `list.itemCount`:** evaluado. Graph DELEGADO no expone un conteo recursivo
de carpetas en una propiedad barata (`folder.childCount` es solo hijos inmediatos;
no hay itemCount de biblioteca via Graph sin enumerar). Por eso el conteo exacto
sigue siendo el recorrido, pero ahora **invisible** al usuario (2o plano + cache).
Si mas adelante se quiere un denominador instantaneo, habria que SharePoint REST
(`/_api/web/lists` ItemCount), que requiere otro token; no se hizo.

**Tests:** **34/34 en verde** (build OK). Nuevo `no-bloqueo.spec.js`: con TODAS
las llamadas de `children` retardadas 4s, Sitios y Resumen renderizan en <2s
(prueba del no-bloqueo). Mock extendido con `delayChildrenMs`.

---

## BUG PRIORITARIO (Franco) — "Sitios"/Resumen tardan >5 min en cargar (2026-06-19)

Sintoma: al entrar a "Sitios" tarda mas de 5 minutos. Regresion de la Tanda D.

Causa probable: `migration-store` (reescrito) ahora hace un **crawl recursivo COMPLETO
del drive de cada sitio** para las vistas globales (totalCarpetas reales). Con ~4214
carpetas en 12 sitios (RH 2654, Finanzas 1018, K9 288...) ese recorrido por niveles via
Graph es de minutos y BLOQUEA el render de Sitios/Resumen/Ejecutivo/Apoyo.

Necesario (Code, propon e implementa): que las vistas globales NO bloqueen en un crawl
completo. Opciones a valorar:
- Render inmediato de la grilla de sitios; calcular conteos/% en segundo plano o bajo
  demanda (no bloqueante).
- Conteo barato del total por sitio sin recorrer todo: p. ej. `list.itemCount` de la
  biblioteca (1 llamada por sitio) como denominador aproximado, en vez del BFS completo.
- Cache idb del crawl con TTL largo + "Actualizar" manual; nunca crawl sincronico al abrir.
- Degradado: si no hay conteo vivo aun, mostrar % sobre entradas de seguimiento (ya existe
  el fallback "tracked") y refinar luego.

Mientras tanto, la vista de UN sitio (lazy) va fluida; el problema es solo en las globales.
Prioridad alta. Al corregir, actualizar bitacora.

---

## Code — TANDA D cerrada: metricas sobre arbol vivo + estructura secundaria + huerfanos + ESPEC (2026-06-19) — REVISAR

Cierra el plan A->D. **Para revision de Franco.** Las metricas ya no se calculan
sobre el maestro sino sobre la estructura REAL, la aprobacion de estructura pasa a
secundaria, se surfacean huerfanos y se actualizo la ESPECIFICACION.

**Metricas sobre el arbol vivo:**
- `migration-store` deja de cruzar contra el maestro: recorre el drive de cada
  sitio (vistas globales) y devuelve `totalCarpetas` (carpetas reales),
  `existeSitio`, y los conjuntos `folders`/`itemIds` (para huerfanos). Desaparece
  el "% estructura (creadas/total)".
- `statsMigracionSitio/Global` ahora: numerador = entradas de seguimiento
  Migrada/Verificada; **denominador = nº de carpetas reales** (del inventario
  vivo). `statsMigracionPorPersona` y `misSitios` se calculan sobre las ENTRADAS
  de seguimiento (no el maestro). Sin lectura viva, caen a "tracked" (no rompen).
- Vistas actualizadas: Resumen (HomeView, sin bloque "% estructura", quita
  AvanceChart), Resumen ejecutivo, Sitios, Evidencia, Por apoyo, Mi trabajo
  (deja de cargar migration-store; "Actualizar" acotado + recargarToken del arbol).

**Aprobacion de estructura -> secundaria:** en Aprobaciones, **Permisos** es la via
principal (accesos / romper herencias); **Carpetas (estructura)** baja a una
seccion "secundaria / opcional" con nota del flujo inverso. El arbol no depende de
esa aprobacion.

**Barrido de huerfanos (read-only):** entradas de seguimiento con avance/
clasificacion cuya carpeta ya no existe viva (ni por ruta ni por itemId) se
surfacean en "Requiere atencion" (Resumen/Ejecutivo) y en el export (columna
"Existe (Graph)" = "No (huerfana)"). **No se borra nada**: revision humana. Sitios
sin lectura fiable (warning) no marcan huerfanos.

**Export ISO:** hoja "Resumen" con carpetas reales (sin %/creadas de estructura);
hoja "Carpetas" enumera carpetas con seguimiento o clasificacion (override ??
semilla), por clave `${slug}::${ruta}`, marcando si siguen vivas.

**ESPECIFICACION:** actualizada a **v2.0** (nota de flujo inverso + §4 datos, §6
vistas, §7 flujos, §10 delta, §12 numeracion: el dashboard ya no se rompe ante
renombres por el anclaje itemId).

**Archivos:** `graph/sharepoint-reader.js` (collectFolderPaths devuelve itemIds),
`lib/migration-store.js` (reescrito), `lib/seguimiento-store.js` (stats +
`huerfanosSeguimiento`), `lib/exporter.js`, `components/{HomeView,EjecutivoView,
SitiosView,EvidenciaView,ApoyoView,MiTrabajoView,AprobacionesView}.js`,
`AvanceChart.js` eliminado, `ESPECIFICACION-Dashboard-SGSI.md`.

**Tests:** suite **32/32 en verde** (build OK). Nuevo `huerfanos.spec.js`
(surfaceo en Requiere atencion); `resumen.spec.js` ajustado (sin bloque estructura).

**Pendiente / notas:**
- El denominador de "Migracion %" depende del recorrido vivo (vistas globales);
  la vista de UN sitio muestra el % sobre entradas (no hace crawl propio por el
  lazy-load). Si se quisiera el % exacto por sitio sin abrir el Resumen, habria
  que un conteo por sitio en segundo plano (no incluido; bajo impacto).
- Huerfanos: deteccion read-only. Una accion de "archivar/limpiar huerfano" desde
  el dashboard queda como mejora futura si Franco la pide.

Plan A->D COMPLETO. Pendiente solo la validacion de Franco de esta tanda.

---

## Code — TANDA C cerrada: anclaje por itemId + reconciliacion de renombres (2026-06-19) — REVISAR

Implementada la Tanda C. **Para revision de Franco antes de la Tanda D.** Resuelve
el riesgo del flujo inverso: si el equipo RENOMBRA una carpeta, el avance de
migracion / quien migra / clasificacion ligados a la ruta vieja ahora SIGUEN a la
carpeta (anclados al `itemId`, estable ante renombres), en vez de huerfanarse.

**Como funciona:**
- **Sello de itemId al escribir:** `updateNodo` y `setClasificacion` guardan el
  `itemId` (driveItem) de la carpeta en la entrada del seguimiento.
- **Backfill al cargar:** al cargar un nivel del arbol, las entradas previas (sin
  itemId) que siguen en su ruta original reciben su itemId (protege renombres
  futuros).
- **Re-llave por itemId:** si una entrada con itemId X vive en una ruta distinta
  de donde esta hoy la carpeta X (renombrada), se mueve a la ruta nueva con
  evidencia en `historial` ("Reconciliada por itemId: ruta A -> B"). Idempotente.
- Disparo: `reconciliarSitio()` corre al cargar cada nivel (sobre las carpetas ya
  traidas; sin llamadas Graph extra) y escribe en UN PUT por lote.

**Archivos:**
- `seguimiento-store.js`: `itemId` en entradas de `nodos` y `clasificaciones`;
  nueva `reconciliarSitio(structure, slug, foldersVivas)` (re-llave + backfill).
- `ArbolCarpetas.js`: llama `reconciliarSitio` tras cargar cada nivel; pasa el
  `itemId` de la carpeta a las acciones.
- `SitioView.js`: `onMigracion/onQuienMigra/onClasificar` propagan `itemId`.

**Tests:** suite **31/31 en verde** (build OK). Nuevo `reconciliacion.spec.js`:
con un avance "Migrada" sembrado en la ruta vieja pero con el itemId de la carpeta
viva (estado tipico tras un renombre), al cargar el avance se mueve a la ruta
nueva, persiste el re-llave (la vieja desaparece) y queda la evidencia.

**Limitaciones conocidas (deferidas):**
- **Solo protege renombres cuyo itemId ya se conocia** (sellado en una escritura o
  backfill previo). Un renombre ocurrido antes de que la entrada tuviera itemId no
  es reconciliable automaticamente (caso de datos historicos; poco impacto: el
  avance real estaba sobre rutas del maestro, no sobre las del equipo).
- **Borrados reales (huerfanos):** no se detectan por nivel (la carga es lazy);
  requieren un crawl completo. No se borra nada en silencio: las entradas sin
  carpeta viva persisten (visibles en export/historial). El sweep de huerfanos se
  evalua en la **Tanda D**.

**Siguiente:** Tanda D (metricas globales sobre el arbol vivo + aprobacion de
estructura como secundaria + actualizar ESPECIFICACION §4/§6/§7/§10/§12 + posible
sweep de huerfanos) cuando Franco valide esta tanda.

---

## Code — TANDA B cerrada: clasificacion como mapa por ruta (2026-06-19) — REVISAR

Implementada la Tanda B segun la aclaracion de Cowork. **Para revision de Franco
antes de la Tanda C.** Clasificacion EFECTIVA = override del sitio (seguimiento,
editable por admin) ?? semilla del repo (maestro + `clasificaciones-sgsi.json`)
?? "sin clasificar".

**Semilla en repo (la mantiene Cowork):**
- `public/clasificaciones-sgsi.json` (nuevo): mapa `${slug}::${ruta}` -> nivel.
  Cowork clasifica aqui las carpetas que detecta en el arbol vivo / inventario y
  commitea; el dashboard lo lee al cargar. Arranca vacio (no se inventan niveles:
  lo no decidido sale "sin clasificar"). Se combina con la clasificacion del
  maestro (las entradas del JSON ganan). **Vive solo en `public/`** (servido); no
  se replica en raiz como el maestro, para evitar drift entre copias.

**Override por sitio (admin desde el dashboard):**
- `seguimiento-migracion.json` de cada sitio gana un bloque `clasificaciones`
  (clave = ruta; valor = { nivel, modificadoPor, ultimaModificacion, historial[] }).
  Solo admin (SGSI) puede editarlo; cada cambio deja evidencia en historial
  (A.5.12/A.5.13/A.5.15). nivel null = override quitado (vuelve a la semilla),
  conservando la evidencia.

**Archivos:**
- `structure-store.js`: carga `clasificaciones-sgsi.json`, construye
  `clasificacionSeed` (maestro + repo) y expone `clasificacionSemilla()`.
- `seguimiento-store.js`: campo `clasificaciones` (emptySeg/normalize/fusion),
  `getClasifOverride()`, `setClasificacion()` (admin + historial) y agregacion a
  clave global `${slug}::${ruta}` en `getSeguimiento()`.
- `ArbolCarpetas.js`: badge muestra la efectiva; el admin tiene un selector
  `sel-clasif` por carpeta (sin clasificar + niveles) para fijar/quitar el override.
- `SitioView.js`: accion `onClasificar`.
- `exporter.js`: la hoja "Carpetas" usa la clasificacion EFECTIVA (override ??
  semilla) en vez del campo del maestro.
- `components.css`: estilo de `sel-clasif`.

**Tests:** suite **30/30 en verde** (build OK). Nuevo `clasificacion.spec.js`:
semilla del maestro visible, carpeta nueva "sin clasificar", admin la fija y
persiste el override por ruta con su nivel, badge efectivo actualizado.

**Pendiente (en el plan):** Tanda C (anclaje `itemId` ante renombres: hoy el
override de clasificacion y el seguimiento siguen por ruta) y Tanda D (metricas
globales sobre el arbol vivo + actualizar ESPECIFICACION §4/§6/§7/§10/§12).

**Siguiente:** Tanda C cuando Franco valide esta tanda.

---

## Code — TANDA A cerrada: arbol EN VIVO + lazy-load (2026-06-19) — REVISAR

Implementada la Tanda A del plan validado. **Para revision de Franco antes de
seguir con la Tanda B** (no avanzo sin OK).

**Que cambia (visible):** la vista de un sitio ya NO arma el arbol del maestro,
sino de SharePoint EN VIVO. K9 ahora muestra sus carpetas reales (10.1 CANINOS...)
en vez de la estructura vieja del maestro. Carga LAZY por nivel: cada carpeta se
expande bajo demanda (no se traen las ~4214 de golpe). Desaparece el estado de
ESTRUCTURA "Pendiente/Creada" (si la carpeta existe, se ve). El boton "Actualizar"
del sitio invalida la cache por nivel y re-lee.

**Archivos:**
- `src/lib/live-tree-store.js` (nuevo): lectura por nivel via Graph
  (`/drive/root/children` y `/root:/{ruta}:/children`), cache memoria+idb (TTL 2
  min) e `invalidateSitio`. Conserva ya el `itemId` de cada carpeta (lo usara la
  Tanda C para reconciliar renombres).
- `src/components/ArbolCarpetas.js`: reescrito a estado central de niveles
  (lazy). Nodos REALES (de Graph) + VIRTUALES (solicitudes "crear" sobrepuestas) +
  marca "sobrante". Migracion/quien-migra/accesos por carpeta intactos (clave
  `${slug}::${ruta}`). Badge gris "sin clasificar" para carpeta real sin semilla
  del maestro (preparacion de la Tanda B).
- `src/components/SitioView.js`: deja de usar `migration-store` para el arbol;
  `existeSitio` se deriva de la lectura en vivo; se oculta la tarjeta "Estructura
  %" (ya no aplica). "Actualizar" acotado a este sitio.
- `src/components/BotonActualizar.js`: prop opcional `refrescar` (relectura
  acotada del sitio) sin forzar el crawl global de los 12 sitios.
- `src/styles/components.css`: estilo del badge "sin clasificar".

**Tests:** suite **29/29 en verde** (build Vite OK). Mock de Graph mejorado
(`childCount` real por carpeta para habilitar el caret). Specs ajustados al arbol
vivo (estado-flow, asignacion, migracion-flow, accesos, multibiblioteca) +
**nuevo `arbol-vivo.spec.js`** (lazy-load por nivel + badge "sin clasificar" +
ausencia del tag Estructura). Verificacion = suite E2E con `?e2e=1` y Graph
mockeado (el dashboard requiere login MSAL del tenant para un preview real).

**Limitaciones conocidas (deferidas, ya en el plan):**
- La tarjeta "Migracion %" del sitio y las metricas globales aun cuentan sobre los
  nodos del MAESTRO; las carpetas vivas que no existen en el maestro (p. ej.
  renombradas) no entran en ese denominador. Se recalcula en la **Tanda D**.
- El seguimiento sigue por ruta; si el equipo renombra, el estado ligado a la ruta
  vieja se huerfana. Lo resuelve la **Tanda C** (anclaje por `itemId`, ya
  capturado).
- `migration-store` se mantiene (lo usan Resumen y vistas globales); su rol en la
  vista de sitio se elimino.

**Siguiente:** Tanda B (clasificacion como mapa: semilla en repo + override por
sitio, segun la aclaracion de Cowork) cuando Franco valide esta tanda.

---

## Cowork — VALIDACION de la propuesta + aclaracion de clasificacion (2026-06-19)

Cowork valida (a), (b), (c) y el orden A->D. Arrancar por Tanda A. Una aclaracion
para la Tanda B (importante por el reparto de roles):

- **Quien edita la clasificacion y como:** Franco quiere que la asigne COWORK. Pero
  Cowork NO puede escribir en SharePoint (conector read-only); Cowork SI edita el
  repo. Por tanto: el **mapa semilla** debe vivir en el repo (el maestro o un
  `clasificaciones.json` versionado) y ser la via por la que COWORK clasifica las
  carpetas nuevas detectadas. La **override por sitio** en el `seguimiento` es para
  ediciones desde el dashboard por admins. Clasificacion efectiva = override (sitio)
  ?? semilla (repo) ?? "sin clasificar".
- Flujo recurrente: el inventario / arbol vivo expone carpetas nuevas -> Cowork las
  clasifica en la semilla del repo (commit) -> Code push -> dashboard las refleja.
- Resto: ok tal cual. Procede Tanda A.

---

## Code — PROPUESTA de plan: arbol EN VIVO + clasificacion como mapa (2026-06-19)

Respuesta al BRIEF. **No implementado aun: espera validacion de Franco** (no se
avanza de tanda sin su OK). Diagnostico del codigo actual y decisiones de diseno
abajo; al validar, se ejecuta por tandas y se actualiza la ESPECIFICACION.

### Como esta hoy (para entender el delta)
- El arbol se arma del MAESTRO (`structure.sitios[].nodos`, aplanado en
  `structure-store.js`), no de SharePoint. Por eso K9 muestra la estructura vieja.
- `migration-store.js` hace un crawl RECURSIVO COMPLETO del drive
  (`collectFolderPaths`, BFS de todos los niveles) solo para marcar `existe` y
  contar archivos cruzando contra los nodos del maestro. Es justo lo que hay que
  invertir: que el arbol SALGA de ese recorrido, no del maestro.
- Seguimiento (migracion, fases, cambios, permisos) por sitio en
  `_seguimiento/seguimiento-migracion.json`, **clave `${slug}::${ruta}`**. La
  clasificacion hoy es un campo del nodo del maestro (read-only).

### (a) Mapa de clasificacion — DONDE guardarlo
**Recomendacion: por sitio, dentro del `seguimiento-migracion.json` de cada sitio**
(nuevo bloque `clasificaciones: { [ruta]: nivel }`), NO un archivo unico.
- Razon: respeta el modelo actual (cada area escribe donde TIENE permiso via
  Graph delegado; un archivo unico en el hub seria un cuello de escritura y no
  todos pueden escribir alli). Reusa `escribirSitio()` + historial = evidencia
  A.5.12/A.5.13/A.5.15 ya implementada.
- **Semilla** = la clasificacion del maestro actual (se siembra en memoria al
  cargar, igual que hoy se siembra el seguimiento legado del hub). Carpeta real
  sin entrada -> badge gris "sin clasificar", editable por admin/Cowork.
- El maestro deja de ser espejo y queda como **semilla read-only**; el export ISO
  lee el mapa (con fallback a la semilla).

### (b) Lazy-load del arbol grande (~4214 carpetas)
**Recomendacion: carga por NIVEL bajo demanda**, reemplazando el crawl completo.
- Nuevo `live-tree-store.js`: `GET /drives/{id}/root/children` para la raiz y
  `/root:/{ruta}:/children` al expandir un nodo. `existe` se vuelve trivial (si
  esta en el listado, existe) y `archivos` sale del mismo call (items no-carpeta).
- Cache idb por `${slug}::${ruta}` con TTL + invalidacion; el boton "Actualizar"
  limpia el nivel. Concurrencia acotada (ya existe `enParalelo`, limite 8).
- `ArbolCarpetas` se re-arma desde datos vivos, colapsado por defecto, expand-on-
  demand. **Desaparece el tag ESTRUCTURA "Pendiente/Creada"** (si existe, se ve).
- Metricas globales: la "Estructura %" (creadas/total vs maestro) pierde sentido.
  La "Migracion %" necesita denominador = nº de carpetas reales: se obtiene con un
  conteo por sitio (el crawl actual, ahora explicito/cacheado y NO bloqueante del
  arbol), o incremental. A definir el detalle en la Tanda B/D.

### (c) Seguimiento por ruta ante renombres — EL punto critico
Hoy, si el equipo renombra, la `ruta` cambia: el estado/clasificacion ligados a la
ruta vieja se huerfanan y la nueva no tiene entrada. Dado que el equipo renombra
mucho, "aceptar re-asignacion" perderia avance. **Recomendacion: anclar al
`driveItem.id`** (estable ante rename dentro del mismo drive; ahora es viable
porque el arbol es EN VIVO -> las carpetas existen por definicion, que era la
objecion original de CLAUDE.md para no usar el id).
- La clave canonica visible sigue siendo la ruta (legible + semilla del maestro),
  pero cada entrada de seguimiento/clasificacion **sella `itemId`** cuando se
  conoce (del arbol vivo). Al cargar: si una ruta no tiene entrada pero existe una
  entrada con el mismo `itemId` en otra ruta -> se RE-LLAVE (migra) a la ruta
  nueva y se registra en `historial` (evidencia del movimiento).
- Huerfanos sin match (carpeta borrada de verdad) NO se borran en silencio: se
  marcan "para revision" (A.5.15/A.8.15).

### Plan por tandas (al validar Franco)
- **Tanda A — Arbol en vivo + lazy-load.** `live-tree-store.js`, re-arma
  `ArbolCarpetas` (expand-on-demand, colapsado), quita tag Estructura, "Actualizar"
  por nivel. (b)
- **Tanda B — Clasificacion como mapa por ruta.** Bloque `clasificaciones` por
  sitio, semilla del maestro, badge "sin clasificar", edicion admin/Cowork +
  historial, export ISO lee el mapa. (a)
- **Tanda C — Anclaje `itemId` + reconciliacion de renombres.** Sella itemId,
  re-llave por itemId, huerfanos a revision. (c)
- **Tanda D — Aprobacion de estructura -> secundaria + spec + tests.** Degradar la
  aprobacion de estructura a opcional (mantener permisos y solicitudes puntuales),
  recalcular metricas globales, actualizar ESPECIFICACION (§4, §6, §7, §10, §12) y
  suite E2E (mocks de arbol vivo, lazy-load, mapa, reconciliacion).

**Pendiente de Franco:** validar (a)/(b)/(c) y el orden de tandas. Sugiero
arrancar por A (desbloquea el problema visible de K9). No implemento hasta tu OK.

---

## BRIEF para Code — Dashboard: arbol EN VIVO + clasificacion como mapa (2026-06-19)

Cambio de fondo (decidido por Franco) acorde al flujo inverso. Code: propone plan/tandas
y confirma en la bitacora antes de avanzar.

**Problema:** el arbol se construye del maestro; con el equipo creando/renombrando/borrando
directo en SharePoint, el maestro quedo desfasado. Ej.: K9 muestra 10.1 "Binomios y
Manejadores"... (estructura vieja del maestro, ya inexistente) -> todo "Pendiente"; las
carpetas reales (10.1 CANINOS...) no aparecen.

**Objetivo:** el arbol debe reflejar la estructura REAL de SharePoint (via Graph),
detectando automaticamente lo creado/renombrado/borrado. Desaparece el estado de
ESTRUCTURA "Pendiente/Creada" (ya no aplica: si existe, se muestra; si no, no esta).

**Cambios:**
1. **Arbol en vivo desde Graph** (carpetas reales por sitio), NO desde el maestro.
   Lazy-load al expandir (hay ~4214 carpetas; no cargar todo de golpe). Cache + boton
   Actualizar. Usar `/drive/root` por nivel.
2. **Clasificacion = mapa editable por ruta** (no existe en SharePoint). Decision de
   Franco: la asigna Cowork/equipo desde el dashboard y se CONSERVA para reflejarla en la
   documentacion/export. Guardar `clasificaciones[ruta] = nivel` persistente (semilla = el
   maestro actual). Carpeta real sin entrada -> badge "sin clasificar" (gris), editable por
   admin. El export ISO usa este mapa.
3. **Aprobacion de estructura -> SECUNDARIA** (opcional, "a veces"). El arbol ya no depende
   de ella. Se mantiene Aprobaciones para PERMISOS (y solicitudes puntuales).
4. **Migracion (estado por carpeta) y permisos**: siguen. OJO clave-por-ruta: si el equipo
   renombra una carpeta, el estado/clasificacion ligados a la ruta vieja se desligan;
   evaluar reconciliacion o aceptar re-asignacion al renombrar.

**Pregunta a Code:** propone (a) como/ donde guardar el mapa de clasificacion (seguimiento
por sitio vs archivo unico), (b) el lazy-load del arbol grande, (c) que pasa con el
seguimiento por ruta ante renombres. Actualiza tambien la ESPECIFICACION cuando se acuerde.

**Cowork:** a partir de ahora clasifica las carpetas detectadas y mantiene el mapa.

---

## Code — Renombrado de estructura corrido (flujo inverso) (2026-06-19)

Ejecutado `pnp/Renombrar-Estructura-2026-06-19.ps1` (RENAME, no destructivo, sin gate).
Previo al corrido verifique que los 24 nombres origen existieran tal cual en
`pnp/inventario.txt` (RH 8, K9 14, Admin 2). Resultado: **24/24 OK, 0 errores**.

- RH: 04.6 ALTAS IMSS ENSENADA; 04.8/04.9 BAJAS TIJUANA/ENSENADA; 04.10 CONTRATOS
  LABORALES...; 04.11 GAFETE FEDERAL (CIP); 04.12 GAFETE SECRETARIA (CUIP);
  04.13 MODALIDAD... GIRO CIBERSEGURIDAD (typo Jiro->GIRO corregido); 04.14 RELACION
  SOCIOS Y APODERADOS.
- K9: 10.1-10.13 (mismos nombres, solo numeral); `1 Curso Mayo 2024` -> `CURSO MAYO 2024`.
- Admin: 07.7 FORMATOS Y PLANTILLAS; 07.8 JMA FEDERALES (sin "NABIKI").

Contenido y subcarpetas (expedientes, nombres con acentos) intactos: el rename solo
toca el nombre de la carpeta estructural. Cola -> Corrido. Commit+push.

---

## Tarea para Code — Renombres tras inventario (flujo inverso) (2026-06-19)

Cowork reviso `pnp/inventario.txt`. Franco decidio los renombres (todo RENAME, conserva
contenido; no destructivo). **Code: corre `pnp/Renombrar-Estructura-2026-06-19.ps1`,
marca la COLA y haz commit+push.**

- **RH**: 8 carpetas del equipo -> numeral 04.6/04.8-04.14 en MAYUSCULAS (typo Jiro->GIRO).
- **K9**: esquema 1-13 -> 10.1-10.13 (mismos nombres); `1 Curso Mayo 2024` -> `CURSO MAYO 2024`.
- **Admin**: `FORMATOS Y PLANTILLAS NABIKI`->`07.7 FORMATOS Y PLANTILLAS`; `JMA FEDERALES NABIKI`->`07.8 JMA FEDERALES`.

Nota: el equipo K9 habia reemplazado la estructura corporativa 10.x por la suya (1-13);
este renumerado solo alinea el formato. El contenido (expedientes, nombres de empleados con
acentos, etc.) NO se toca: la convencion sin-acentos es solo para carpetas estructurales.

Maestro: dado el flujo inverso (el equipo crea directo, miles de carpetas), el maestro deja
de ser espejo completo; Cowork lo mantiene solo a nivel estructural (top-level) cuando
aplique. Esto NO bloquea el push del renombrado.

---

## Cambio de FLUJO + tarea inventario (2026-06-12c)

Franco cambio el modelo: el equipo NO tecnico CREA las carpetas directo en SharePoint
(ya crearon mucho); nosotros revisamos despues (renombrar las que necesiten numeral,
normalizar a MAYUSCULAS sin acentos) y el dashboard se usa SOLO para permisos y romper
herencias. Las carpetas creadas directo NO estan en el maestro ni en el arbol.

**Tarea para Code (read-only, no destructivo):** corre `pnp/Inventario-Estructura.ps1`.
Lista todas las carpetas reales de los 12 sitios en `pnp/inventario.txt`. Haz commit+push
de `pnp/inventario.txt` para que Cowork lo revise y proponga renombres. (No requiere gate:
es de solo lectura.)

Pendiente previo aun en cola: `pnp/Crear-Aprobados-2026-06-12b.ps1` (crear, Code) y
`pnp/Borrar-Aprobados-2026-06-12b.ps1` (borrar, gate Franco). Ver COLA.

---

## Code — Acceso de Martha a SP-Ensenada, AUTORIZADO por Franco (2026-06-12)

Franco pidio en el chat dar acceso de usuario a Martha en Seguridad Privada -
Ensenada, en todas las carpetas (esa instruccion es la autorizacion del gate de
permisos). Ejecutado `pnp/Acceso-Martha-SP-Ensenada.ps1`:

- Verificacion previa (lectura): las 10 carpetas del sitio heredan permisos
  (0 herencias rotas), asi que Integrante a nivel sitio cubre todas.
- Martha (malvarez@jmaseguridad.com) agregada al grupo "Integrantes de la
  Seguridad Privada - Ensenada". Verificado post-cambio: aparece en el grupo.

Cola actualizada. Nota para Cowork: si el maestro documenta accesos por sitio,
reflejar este alta donde corresponda.

---

## Fix — Sitios enteros "Pendiente" tras el lote 2026-06-12b (throttling Graph)

**Reporte de Franco (con captura):** en "Mi trabajo" y "Sitio", carpetas que llevan
semanas creadas (06.3, 06.4, 06.6... de Finanzas) aparecian con "○ Pendiente".

**Causa:** el recorrido de carpetas (`collectFolderPaths`) lanzaba TODAS las
hermanas de un nivel en paralelo sin limite. Tras el lote 2026-06-12b (~500
carpetas nuevas), el nivel de clientes de 06.1 disparaba ~420 llamadas Graph
simultaneas; SharePoint respondia 429 hasta agotar los 3 reintentos del SDK, la
lectura del sitio fallaba y TODOS sus nodos quedaban `existe=false`. Ademas el
`warning` del sitio no se mostraba en ninguna vista: fallo silencioso.

**Fix:**
- `sharepoint-reader.js`: BFS por niveles con concurrencia acotada (`enParalelo`,
  limite 8 por drive). Se verifico contra SharePoint real que las 497 carpetas
  existen con los nombres exactos del maestro (lectura PnP).
- Warning visible: banner en Sitio y Mi trabajo ("No se pudo leer el estado
  real...") y tag "sin lectura" en la tabla del Resumen.

E2E 28/28 en verde. Nota operativa: las solicitudes aprobadas de este lote siguen
abiertas; falta "Marcar creada" en lote desde Aprobaciones (paso manual por diseno).

---

## Code — Corrido Borrar-Aprobados-2026-06-12b, AUTORIZADO por Franco (2026-06-12)

Primer destructivo bajo el flujo nuevo. Franco autorizo en el chat "borrar
directo" (sin dry-run previo). Resultado:

- Finanzas `06.5 Egresos por Cliente`: VACIA, borrada a papelera
  (RecycleBinItemId d6e6e6f9-5ac1-4461-81da-33b2035b3eeb).
- RH `04.1 Ano 2026/04.1.4 Documentos generales del personal contratado`:
  VACIA, borrada a papelera (RecycleBinItemId c89c5d46-90b0-4732-b3b9-b64d76d38996).

Ambas recuperables desde la papelera del sitio. El script quedo de nuevo con
`$ConfirmarBorrado=$false` (salvaguarda) y con el registro de la corrida en
comentario. Maestro actualizado: quitados los 2 nodos borrados (raiz + public,
840 nodos, validaciones y E2E 28/28 en verde). Cola marcada como Corrido.

---

## Cambio de flujo PnP (Franco, 2026-06-12) — destructivos los corre Code con autorizacion en chat

Franco actualizo el gate: los scripts destructivos y de permisos ya NO los corre
el mismo; los ejecuta Claude Code, pero SOLO tras pedirle autorizacion explicita
en el chat para cada script (dry-run previo y reporte recomendados). La
autorizacion queda registrada en bitacora y cola como evidencia (A.5.15/A.8.15).
Actualizados CLAUDE.md y las reglas de COLA-PNP.md.

---

## Code — Corrido Crear-Aprobados-2026-06-12b (2026-06-12)

Ejecutado `pnp/Crear-Aprobados-2026-06-12b.ps1` (no destructivo, flujo PnP aprobado):

- 06.1/SEGURIDAD: 420 creadas, 0 errores
- 06.1/K9: 60 creadas, 0 errores
- 06.1/CIBERSEGURIDAD: 12 creadas, 0 errores
- 06.2/EGRESOS: 1 creada, 0 errores
- RH (expedientes JMA SEGURIDAD x3 + FINIQUITOS RESPALDOS): 4 creadas, 0 errores

Total: 497 carpetas, 0 errores. Maestro validado antes del commit (JSON parsea,
raiz == public, 842 nodos, 0 rutas duplicadas, clasificaciones validas) y suite
E2E en verde (28/28). Cola marcada como Corrido.

`pnp/Borrar-Aprobados-2026-06-12b.ps1` NO se ejecuto: destructivo, queda en
gate de Franco (arranca en modo revision; borrado a papelera).

---

## Tarea para Code — Aplicar aprobados 06.1/06.2/RH + convencion MAYUSCULAS (2026-06-12b)

Franco reviso lo aprobado en el dashboard y decidio. Cowork ya genero scripts y
actualizo el maestro. **Code: corre el de crear, push, y marca la COLA.**

**Convencion NUEVA (Franco):** de ahora en adelante las carpetas que creemos van en
MAYUSCULAS, sin acentos, sin numeral (instancias). El numeral sigue solo para
secciones estructurales existentes. (Aplicado a este lote.)

**Crear (no destructivo) -> `pnp/Crear-Aprobados-2026-06-12b.ps1` (corre Code):**
- Finanzas `06.1 Facturacion`: divisiones SEGURIDAD, K9, CIBERSEGURIDAD; anios
  (SEGURIDAD/K9: 2022-2026; CIBERSEGURIDAD: 2026); 12 MESES por anio; clientes por mes
  (SEGURIDAD: DKM, HOSPITAL, ASCENSO, MOLOAKAN VALLE, TP&OIL DE MEXICO, BONATTI,
  BF-MOTORS; K9: TRABLISA; CIBERSEGURIDAD: sin clientes). ~490 carpetas.
- Finanzas `06.2 Movimientos Bancarios/EGRESOS/SEGURIDAD PRIVADA`.
- RH `04.2 Expedientes de Personal/JMA SEGURIDAD/{TIJUANA,ENSENADA,K9}` y
  `04.1 Ano 2026/04.1.6 Finiquitos pagados 2026/FINIQUITOS RESPALDOS`.

**Borrar (destructivo, GATE Franco) -> `pnp/Borrar-Aprobados-2026-06-12b.ps1`:**
- `06.5 Egresos por Cliente` (Finanzas) y `04.1.4 Documentos generales del personal
  contratado` (RH). Arranca en MODO REVISION; lo corre Franco tras dry-run.

**Maestro:** Cowork ya agrego las ~626 nodos de 06.1, EGRESOS y las de RH a
`public/estructura-maestra-sgsi.json` (+ raiz). Las dos a BORRAR siguen en el maestro
hasta confirmar el borrado. Incluir en commit+push.

**Resueltos en revision (descartados/ignorados):** se ignoran los experimentos
descartados de Martha (Año/2026/Junio/Egresos/DKM/HOSPITAL, Seguridad Privada en 06.1,
Expediente Ensenada/*, Finiquitos Tijuana/Ensenada). El conflicto de 04.1.4
(crear-dentro vs borrar) se resolvio: BORRAR (Franco).

Code: corre el crear, push del maestro+scripts, marca COLA y confirma.

---

## Fix — Carpetas "Año" en Facturacion (Finanzas) que "no se podian quitar" (2026-06-12)

**Reporte de Franco:** en 06.1 Facturacion (Emitidas-Recibidas) habia una
carpeta suelta "Año" con un ano dentro que no se podia quitar; pidio borrarlas.

**Diagnostico:** las carpetas "Año" NUNCA existieron en SharePoint ni en el
maestro: eran solicitudes 'crear' de Martha en el seguimiento de Finanzas, y
TODAS ya estaban descartadas en los datos (verificado en los 12 sitios). Se
veian por sesion de navegador vieja + un BUG real que explica el "no se puede
quitar": el doble clic al registrar creaba DOS solicitudes con la misma ruta
(p. ej. K9/2022 y Ciberseguidad/2026 estaban duplicadas), el arbol las pinta
como UNA carpeta virtual, y "quitar" descartaba solo una copia: la carpeta
"revivia" en el siguiente render.

**Fix (doble defensa):**
- `ArbolCarpetas`: cada carpeta virtual acumula TODOS los ids de solicitudes
  abiertas de su ruta y "quitar" los descarta todos.
- `seguimiento-store.addCambioEstructura`: rechaza registrar un cambio si ya
  hay una solicitud ABIERTA (propuesta/aprobada) del mismo tipo y ruta, con
  aviso claro de quien la tiene abierta. El chequeo corre sobre la copia
  recien fundida con el servidor (atrapa duplicados entre sesiones).

**Limpieza de datos (Code, via PnP):** en el seguimiento de Finanzas se
descartaron las 2 duplicadas abiertas que quedaban, conservando la mas
antigua de cada ruta: `cam-1781297029617` (Ciberseguidad/2026) y
`cam-1781296959720` (K9/2022), con comentario de limpieza. Las "Año"
descartadas se conservan como tombstones (evitan que sesiones viejas las
resuciten en la fusion por id).

**Para Franco:** recarga el navegador y las "Año" desaparecen (ya estaban
descartadas). 2 E2E nuevos (`duplicados.spec.js`); 28/28 en verde.

---

## Tanda — Rendimiento: lecturas Graph en paralelo (los tiempos "enormes") + quitar "bloquear" (2026-06-12)

**Estado:** Code-complete. 26/26 E2E; build OK; mejora medida con latencia
simulada de 150ms/peticion: Resumen 7.6s (equivalente secuencial) -> 2.0s, y
en el tenant real la diferencia es mucho mayor (ver causa).

**Reporte de Franco:** tiempos de carga enormes; quiere algo cercano a "tiempo
real". Ademas: quitar el boton "bloquear" (no lo ve necesario) y confirmar que
los cambios se ven bien en telefono.

**Causa raiz de la lentitud — TRES niveles de secuencialidad encadenados:**
1. `collectFolderPaths` recorria el arbol de cada sitio CARPETA POR CARPETA
   (~45 viajes seriales solo CyberSec).
2. `loadMigrationState` detectaba los 12 sitios UNO TRAS OTRO (el total era la
   SUMA de los 12 recorridos: minutos con red real).
3. `loadSeguimiento` repetia el patron (12 x resolver siteId + descargar = 24
   viajes seriales), y las vistas cargaban migracion y seguimiento en serie.

**Fix:**
- Recorrido de carpetas con hermanas en PARALELO: O(profundidad) niveles en
  vez de O(n carpetas) viajes (`sharepoint-reader.js`).
- Sitios en paralelo con limite 4 en migracion (`migration-store`) y limite 6
  en seguimiento (hub primero, es la semilla) (`seguimiento-store`); helper
  compartido `lib/concurrencia.js`. El SDK de Graph reintenta 429 con
  Retry-After; los limites evitan provocarlo.
- Cache PERSISTENTE de siteIds (idb, 24h): son estables; ademas se deduplican
  resoluciones en vuelo (migracion y seguimiento pedian los mismos slugs a la
  vez). Sitios inexistentes (null) NO se cachean.
- Vistas (Resumen, Mi trabajo, Sitio): migracion y seguimiento ahora cargan en
  paralelo entre si.
- El TTL de 2 min + boton "Actualizar" + refresh por sitio quedan igual: con
  el refresh ahora rapido, la reconciliacion se siente cercana a tiempo real.

**UI:** se retiro el boton "bloquear" del arbol (marcaba una carpeta como
"Bloqueada" con motivo, para senalar "no migrar hasta resolver X"; Franco no lo
ve necesario). Queda "desbloquear" SOLO en carpetas ya bloqueadas (limpieza de
historicos) y la etiqueta "Bloqueada" si hay datos. Beneficio extra: filas mas
compactas en movil (verificado con captura 390px).

---

## Tanda — Transparencia de permisos por carpeta + solicitud "quitar acceso" para PnP (2026-06-12)

**Estado:** Code-complete. 28/28 E2E (3 nuevos en `accesos.spec.js`); build OK;
capturas escritorio/movil verificadas.

**Pedido de Franco:** (1) en "Mi trabajo" todos ven los permisos del grupo de
trabajo; (2) en todo arbol de carpetas se ve quien accede a cada carpeta
individual; (3) boton para QUITAR acceso a una carpeta (gestion de herencias
via PnP).

**Implementado:**
- **Equipo del area en "Mi trabajo"** (`MiTrabajoView`): la `CabeceraSitio`
  (propietario / Apoyo SGSI / acceso con temporales) se muestra por area en
  solo lectura para TODOS los perfiles.
- **Panel "accesos" por carpeta** (`ArbolCarpetas`): toggle por fila que
  muestra el acceso EFECTIVO segun el maestro: propietario + acceso del sitio
  (sin duplicar al propietario) + equipo de migracion temporal + `accesoExtra`
  de la carpeta y heredado de ancestros (con marca "carpeta · origen");
  soporta `accesoExcluido` (opcional, para cuando Cowork modele exclusiones).
  El contador "accesos (+n)" delata extras. Solo informativo: el dashboard no
  cambia permisos reales.
- **Boton "x" (quitar acceso a la carpeta)**: visible para admin/propietario;
  registra una solicitud de permiso tipo `quitar` con campo nuevo `ruta`
  (carpeta), que entra a Aprobaciones ("Quitar (carpeta)" + ruta visible), al
  panel de permisos del sitio y al export PnP (CSV: detalle "carpeta: ...";
  JSON: campo `ruta`). El gate humano de Franco para permisos NO cambia.
- **Store**: `addSolicitudPermiso` acepta `ruta` opcional;
  `structure-store` aplana `accesoExtra`/`accesoExcluido` a los nodos.

**Para Cowork:** el dashboard ya LEE `accesoExtra` (y `accesoExcluido` si lo
agregas) del maestro y los muestra por carpeta; las solicitudes de quitar
acceso por carpeta llegan en el export JSON con `ruta` — listas para generar
el script de herencia rota correspondiente.

---

## Code CONFIRMA: Acceso-Total-RH.ps1 ejecutado y verificado (2026-06-12)

Primera ejecucion PnP bajo el nuevo flujo (permisos, con autorizacion explicita
de Franco en la bitacora y por mensaje directo):

- **Pre-chequeo del script:** solo `Add-PnPGroupMember` (agrega, no quita ni
  borra), credenciales desde `_secrets.ps1` (sin contrasena embebida), 7 UPN
  coincidentes con lo autorizado.
- **Ejecucion:** los 7 agregados como Integrantes de SGSI-RecursosHumanos sin
  errores (jalvarez, rmarquez, mplantillas, nprolon, jlara, dhurtado, malvarez).
- **Verificacion:** lectura posterior del grupo de Integrantes del sitio
  confirma exactamente esos 7 miembros (Wendy queda como propietaria).
- **Cola:** marcada como **Corrido** (Code). El paso a "Verificado" queda a
  criterio de Franco como en las filas anteriores.
- **Maestro:** validado (raiz == public, 209 carpetas, 0 errores, 23/23 E2E)
  y publicado. El campo nuevo `accesoExtra` por carpeta no afecta al dashboard
  (lo ignora); queda como referencia para herencias finas futuras.

---

## Tarea para Code — Acceso total a RH (autorizado por Franco) + maestro (2026-06-12)

Franco autoriza acceso a TODO Recursos Humanos (nivel sitio, Integrante) para:
Jorge, Rita, Miguel, Nabiki, Joel, Daniela, Martha. (Herencias finas: despues.)

- **Script (nuevo flujo):** `pnp/Acceso-Total-RH.ps1` (sin credenciales, lee `_secrets.ps1`).
  Es de PERMISOS pero AUTORIZADO por Franco y NO destructivo (solo agrega). Code:
  ejecutalo y marca la COLA como Corrido.
- **Maestro:** Cowork ya actualizo `SGSI-RecursosHumanos.acceso` = Wendy(prop), Nabiki,
  Martha, Jorge, Rita, Miguel, Joel, Daniela. Incluir en commit+push.
- Nota: esto da a Joel/Daniela acceso de SITIO (mas amplio que el folder-level previo);
  el `accesoExtra` por carpeta sigue util como referencia para cuando se rompan herencias.

Code: corre el script, push del maestro, y confirma aqui.

---

## Code CONFIRMA: flujo Cowork -> Code adoptado (2026-06-12)

Adoptado y documentado en `CLAUDE.md > Flujo PnP` y en la memoria persistente
de Code. En concreto:

- **Canal**: bitacora como log comun + `pnp/COLA-PNP.md` como cola operativa;
  Code la revisa al iniciar cada tanda.
- **Reparto**: Cowork escribe los `.ps1` en `pnp/` (sin credenciales) y
  documenta; Code hace push siempre y ejecuta los PnP NO destructivos
  (crear/renombrar), marcando la cola como "Corrido".
- **Gate humano**: borrar/sobrante y permisos los autoriza Franco; Code puede
  dejarlos en dry-run para visto bueno.
- **Seguridad — hecho ya**: creado `pnp/_secrets.ps1` (gitignored) con la
  contrasena del certificado; `.gitignore` ahora excluye `pnp/_secrets.ps1` y
  `*.pfx`. La contrasena que venia en texto en la entrada de la propuesta se
  REDACTO antes de publicarla a GitHub. Verificado en esta maquina: PS 7.6.2,
  PnP.PowerShell 3.2.0 y certificado en `C:\PnPCerts\PnP-JMA-SGSI-AppOnly.pfx`
  (fuera del repo). Patron para los scripts: `. "$PSScriptRoot\_secrets.ps1"`
  y usar `$PnPCertPassword`/`$PnPCertPath`/`$PnPClientId`/`$PnPTenant`.
- **Recomendacion**: rotar la contrasena del certificado cuando haya
  oportunidad (circulo en texto plano por chats/notas antes de este flujo);
  con _secrets.ps1 la rotacion es un cambio en un solo archivo local.
- **Pendiente de Cowork**: migrar los `.ps1` de la carpeta de trabajo de
  Franco a `pnp/` ya sin credenciales (leer de _secrets.ps1).

---

## Tarea para Code — Mostrar acceso por CARPETA en el arbol (2026-06-12)

Sintoma (Franco): Joel y Daniela tienen acceso a RH pero el dashboard no lo refleja.
Causa: la vista de Sitio muestra `sitioDef.acceso` (nivel SITIO, del maestro); ellos
tienen acceso a nivel CARPETA (herencia rota en 04.1/04.2/04.5), que no se modelaba.

Cowork ya agrego al maestro el campo **`accesoExtra`** (array de nombres) en los nodos
de carpeta correspondientes de `SGSI-RecursosHumanos`:
- `04.2 Expedientes de Personal` -> ["Daniela"]
- `04.5 Contratos y Altas IMSS` -> ["Daniela","Joel"]
- `04.1 Ano 2026` -> ["Daniela","Joel"]

**Code:** en `ArbolCarpetas.js`, si un nodo tiene `accesoExtra`, mostrar una pildora
discreta tipo "acceso: Daniela, Joel" en esa carpeta (ademas del badge de clasificacion).
Es informativo (refleja permisos por carpeta concedidos por PnP). Convencion: `accesoExtra`
= personas con acceso adicional al de herencia del sitio. Commit+push.

---

## Propuesta de flujo (Cowork -> Code) — Coordinacion mas fluida y documentada (2026-06-12)

Franco quiere menos chat y mas trabajo documentado entre Cowork y Code. Propuesta
(Code: opina/ajusta en esta misma bitacora):

**Canal:** esta bitacora sigue siendo el log narrativo comun. Se anade un archivo
de **cola operativa** `pnp/COLA-PNP.md` (tabla viva): cada operacion = una fila con
script, que hace, destructivo si/no, estado (Pendiente correr / Corrido / Verificado).
Los scripts `.ps1` viven en `pnp/` (versionados), no en OneDrive.

**Reparto propuesto:**
- **Cowork**: disena estructura/permisos, edita el maestro y docs, ESCRIBE los `.ps1`
  en `pnp/`, registra en bitacora + COLA. No tiene acceso al tenant: NO ejecuta PnP.
- **Code**: hace `push` siempre; y SI Franco le da PS7 + certificado, EJECUTA los PnP
  **no destructivos** (crear carpetas, idempotentes) marcando la COLA como "Corrido".
- **Gate humano (ISO):** operaciones **destructivas** (borrar/sobrante) y de **permisos**
  NO se automatizan: las confirma Franco (o Code las deja en dry-run para su visto bueno).
  Asi queda evidencia de control (A.5.15/A.8.15).

**Seguridad (IMPORTANTE):** hoy los `.ps1` llevan la contrasena del certificado en texto
(redactada por Code antes de publicar esta entrada; ya vive en `pnp/_secrets.ps1`,
gitignored). Si entran al repo y/o los corre Code, hay que SACAR la credencial:
leerla de un `pnp/_secrets.ps1` **gitignored** (o prompt / almacen seguro), nunca commitearla.
El `.pfx` es credencial privilegiada (FullControl); cuidar su difusion.

Code: si estas de acuerdo, confirma en la bitacora y ajustamos.

**ACTUALIZACION — Franco APROBO (2026-06-12):**
- Code recibe PS7 + certificado y ejecuta los PnP **no destructivos** (crear/renombrar).
- **Borrar y permisos** siguen requiriendo visto bueno de Franco (gate humano).
- Sacar la contrasena del cert de los scripts a `pnp/_secrets.ps1` **gitignored**.
Code: adopta este flujo, guardalo en tu memoria/CLAUDE.md y confirma aqui.

---

## Datos (Cowork) — Permisos Finanzas->RH (peticion Martha) (2026-06-12)

Cowork edito `public/estructura-maestra-sgsi.json` (+ raiz). Code: incluir en commit+push; no sobreescribir el maestro.

PnP ya aplicado en SharePoint (sitio RH):
- **Martha** (malvarez@): Integrante a nivel SITIO de RH (es la jefa, ve todo). En el maestro: agregada a `SGSI-RecursosHumanos.acceso` (ahora Wendy, Nabiki, Martha).
- **Daniela** (dhurtado@): acceso por CARPETA (Editar, herencia rota) a `04.2 Expedientes de Personal`, `04.5 Contratos y Altas IMSS`, `04.1 Ano 2026`.
- **Joel** (jlara@): acceso por CARPETA (Editar, herencia rota) a `04.5 Contratos y Altas IMSS`, `04.1 Ano 2026`.
- Excluido para Daniela/Joel: `04.4 Expedientes Medicos` (dato medico).

Nota: el acceso por carpeta de Daniela/Joel NO se modela en el maestro (es a nivel folder); queda como evidencia aqui y se ve en vivo por Graph. Es la 1a herencia rota intencional; el resto se hara al cierre.

---

## Coordinacion — Protocolo Claude Code <-> Cowork + maestro actualizado (2026-06-12)

Franco confirmo el flujo: un chat de **Cowork** redacta las instrucciones que el
pega en Claude Code y ademas **edita archivos del repo en paralelo** (sobre todo
el maestro). Cowork registrara sus cambios tambien en esta bitacora.

- Protocolo documentado en `CLAUDE.md > Coordinacion`: leer bitacora al iniciar,
  separar en commit propio los archivos no tocados por la sesion, y validar el
  maestro antes de commitearlo (parseo, raiz == public, sin duplicados,
  clasificaciones validas, E2E en verde).
- Se commitea aparte la actualizacion del maestro que Cowork dejo en el arbol
  de trabajo: normalizacion sin acentos (Formacion, Sesion, Bitacoras,
  Direccion, CyberSec), propietario de SP-Tijuana a "Jorge Alvarez / Nabiki
  Parada" (Jose Maria pasa a acceso; Ensenada NO cambia — correccion a la
  redaccion original de esta entrada y del mensaje del commit 2c9eb66) y Chema
  agregado al acceso del hub. Validada: 12 sitios, 209 carpetas, 0 errores;
  23/23 E2E.
- Cowork confirmo despues estos mismos cambios por mensaje (incl. bancos 06.2 y
  06.8-06.10 movidas desde Gerencia General, ya publicados en 590224b) y pidio
  no sobrescribir el maestro desde Claude Code: queda asumido, el dashboard lo
  trata como solo lectura (ya era regla de CLAUDE.md) y sus ediciones se
  commitean tal cual tras validarlas.
- Contexto: la actualizacion previa del maestro (bancos en 06.2, nomina a
  Finanzas 06.8-06.10) viajo dentro del commit de UI `590224b` por un
  `git add -A`; este protocolo evita que se repita.

---

## Ajuste — Movil: arbol con subcarpetas legible + fix de cascada CSS (2026-06-12)

**Estado:** Code-complete. 23/23 E2E; build OK; revision visual en 320/360/390/430px
(arbol profundo de CyberSec, Resumen, Sitios, Personas, Evidencia, Aprobaciones).

**Reporte de Franco:** en telefonos distintos algunas cosas se descuadran y el
arbol con muchas subcarpetas se ve mal.

**Causa 1 — cascada CSS:** el bloque `@media (max-width: 760px)` habia quedado a
MITAD de `components.css`; reglas base definidas despues (`.view-head`,
`.arbol-indent`...) lo pisaban por orden de cascada con la misma especificidad.
Sintomas visibles: titulos de vista centrados solo en algunas vistas, sangria
del arbol sin reducir. Fix: el bloque movil se movio AL FINAL del archivo (con
comentario de advertencia para no moverlo de vuelta).

**Causa 2 — arbol en movil:** las filas (caret + nombre + badge + chips +
2 selects + 3 enlaces) se rompian en 3-4 lineas desordenadas, los enlaces
"+ carpeta"/"sobrante" se cortaban en el borde y la jerarquia era ilegible
porque la sangria de 18px/nivel se perdia al envolver. Fix:
- La sangria por nivel paso de estilo inline a variable CSS `--nivel` con clase
  `.arbol-indent` (ArbolCarpetas.js), lo que permite adaptarla por media query.
- En movil: sangria minima (8px) + **lineas guia verticales** por nivel
  (`.arbol-hijos` con margen y borde izquierdo), las **acciones en su propia
  linea** (`.arbol-acciones` a ancho completo con wrap), nombres con
  `overflow-wrap`, descripciones secundarias ocultas y el chip de estado de
  migracion omitido (duplica el valor del selector de al lado; se detecta con
  `:has(.ico-estado)`, degradacion benigna en navegadores viejos).
- Escritorio: sin cambios (18px/nivel, mismo aspecto).

---

## Tanda — Movil + fix de carrera en cargas concurrentes + SitioView sin relectura bloqueante (2026-06-12)

**Estado:** Code-complete. 23/23 E2E (incluye nuevo E2E movil); build OK;
capturas movil y escritorio verificadas.

### 1. Uso desde telefono movil (<=760px)

- `Sidebar.js`: en movil la barra lateral se vuelve **cabecera superior con
  menu hamburguesa** (`.nav-burger`); el menu y la cuenta (con "Salir") se
  pliegan y se cierran automaticamente al navegar. En escritorio no cambia nada
  (el boton se oculta por CSS).
- `components.css`: se reemplazo la regla movil rota (sidebar de 64px que
  cortaba las etiquetas) por un bloque completo: layout en columna, tablas con
  **scroll horizontal interno** (sin scroll lateral del documento), `view-head`
  apilado, metricas a lo ancho, checkboxes de 18px y botones con mas area
  tactil, input de "agregar carpeta" fluido.
- Nuevo `tests/e2e/movil.spec.js` (viewport 390x844): hamburguesa abre/cierra y
  navega, aprobar en lote operable, sin overflow horizontal del documento.

### 2. Fix — carrera en `loadSeguimiento` (bug real detectado por el E2E movil)

Navegar a Aprobaciones mientras otra vista aun cargaba (p. ej. "Mi trabajo"
recien abierto) disparaba DOS recorridos concurrentes de `loadSeguimiento`, que
reasignaban los mapas del modulo a mitad del otro: la bandeja podia renderizar
**vacia o con datos parciales**. En produccion era alcanzable con red lenta
(tipico en movil). Fix en `seguimiento-store.js`: las cargas se **serializan**
(una en curso se espera antes de iniciar otra) y el estado se publica
**atomico** (mapas locales asignados completos al final). El E2E movil corre
x5 sin flakes.

### 3. SitioView — marcar "Aplicado" ya no relee los 12 sitios

Mismo patron que se quito de Aprobaciones: `onCreada` ahora reconcilia **solo
el sitio afectado y en segundo plano** con la nueva
`migration-store.js > refreshMigrationSite(structure, slug)` (re-detecta un
sitio, actualiza la cache idb y recalcula agregados). Si falla, el TTL de 2 min
o "Actualizar" lo reintentan.

### 4. Pulido de Aprobaciones

`BarraLote` contaba selecciones de filas ya cerradas (p. ej. seleccionada y
luego descartada seguia sumando en "n seleccionadas"); ahora cuenta solo
abiertas y se oculta si no queda ninguna.

---

## Ajuste — Aprobaciones: marcado instantaneo, acciones por lote y aprobar sin "nombre final" (2026-06-12)

**Estado:** Code-complete. 22/22 E2E; captura visual verificada.

Tres cambios pedidos por Franco sobre la bandeja de Aprobaciones:

1. **Marcado instantaneo (optimista).** Al marcar "Creada/Aplicada" ya NO se
   dispara `loadMigrationState({ force: true })` (releia los 12 sitios por Graph
   de forma bloqueante; era la causa de la lentitud). Ahora toda accion
   (aprobar / marcar / descartar) cambia el estado del item en memoria y la UI
   al instante, y la escritura del seguimiento corre en segundo plano (la cola
   por sitio serializa acciones rapidas consecutivas). Si la escritura falla, se
   revierte el estado visible y se muestra el error. El arbol y las metricas se
   reconcilian con el TTL de 2 min o con el boton "Actualizar".
2. **Acciones por lote.** Checkbox por fila (solo solicitudes abiertas) +
   "seleccionar todas" en la cabecera de cada tabla (carpetas Y permisos), con
   barra de lote: "Aprobar seleccionadas (n)" (pendientes) y "Marcar
   creadas/aplicadas seleccionadas (n)" (aprobadas). Cada item del lote se
   escribe en segundo plano con el mismo flujo optimista.
3. **Aprobar sin "nombre final".** Se revierte la obligatoriedad del 2026-06-10:
   `seguimiento-store.js > setCambioEstado` ya no lanza error por `nombreFinal`
   ausente en `crear`, y en `AprobacionesView` desaparecio el formulario de
   aprobacion: aprobar es UN clic que solo cambia el estado a "aprobado". El
   nombre canonico (numeral / acentos / mayusculas) lo fija Cowork al generar el
   PnP y actualizar el maestro. `nombreFinal`/`comentario` se conservan como
   datos opcionales y se siguen mostrando si existen (solicitudes historicas).
   La clasificacion OBLIGATORIA al solicitar la creacion NO cambia (Bug #2).

**Archivos:** `AprobacionesView.js` (reescrita: optimista + lote + sin
`FormAprobar`), `seguimiento-store.js` (sin throw de nombre final),
`components.css` (`.lote-bar` reemplaza `.aprobar-row`).

**Tests:** `aprobaciones.spec.js` reescrito — (a) aprobar es un clic, persiste
`aprobado` sin `nombreFinal`, y "Marcar creada" NO genera ningun GET de
`children` (sin relectura de estructura); (b) lote completo: aprobar y marcar en
bloque carpetas y permisos. `concurrencia.spec.js` ajustado al flujo sin
formulario (la fusion anti lost-update sigue cubierta y en verde).

**Nota UX menor:** en lotes grandes sobre el mismo sitio, mientras las
escrituras en cola terminan, una fila puede mostrar por un momento su estado del
servidor (la fusion releida pisa lo optimista hasta que llega su turno de
escritura); converge solo, sin perdida de datos.

---

## Fix — Bug #2 (QA Carmen): clasificacion OBLIGATORIA al crear carpeta (2026-06-10)

**Reporte (crodriguez@, severidad/prioridad Alta):** el portal permitia
registrar/guardar una carpeta nueva sin asignar clasificacion (Publica / Interna
/ Confidencial / Restringida). Rompe el modelo de sensibilidad y permisos
(A.5.12, A.5.13, A.5.15).

**Causa raiz:** en `ArbolCarpetas.js > FormAgregar.agregar()` solo se validaba
`!nombre.trim()`; el `<select>` de clasificacion admitia valor vacio y el boton
Registrar no lo bloqueaba. El store `addCambioEstructura` guardaba
`clasificacion: clasificacion || ''` sin validar.

**Fix (dos capas):**
- Store (`seguimiento-store.js > addCambioEstructura`): para `tipo: 'crear'`
  rechaza clasificacion vacia (`throw`) y valida que sea uno de los niveles
  definidos en `structure.clasificaciones`. Defensa de fondo: cubre todos los
  flujos (Mi trabajo, Sitio, raiz y anidado).
- UI (`FormAgregar`): boton Registrar deshabilitado hasta que haya nombre Y
  clasificacion; `<option>` placeholder "Clasificacion (obligatoria)"; borde
  rojo + aviso "Selecciona una clasificacion..." cuando falta.
- CSS: `.arbol-agregar select.campo-invalido` (borde rojo).

**Decision:** se opto por validacion obligatoria (bloquear guardado), no por un
valor por defecto "Por definir", porque una clasificacion placeholder se
filtraria al modelo de acceso. Pendiente de validacion de Franco + commit/push.

**Verificacion:** `node --check` OK en ambos archivos. Falta E2E de regresion.

---

## Ajustes UX — Refresh mas frecuente y boton "Actualizar" en mas vistas (2026-06-10)

**Estado:** Code-complete. 21/21 E2E; build OK.

- **TTL del estado real** (`migration-store.js`): de 10 a 2 minutos. El
  seguimiento NO usa TTL (cachea por sesion y ya se refresca al montar cada
  vista y antes de cada escritura), no requirio cambio.
- **Boton "Actualizar" reutilizable** (`BotonActualizar.js`): fuerza
  `loadMigrationState` + `loadSeguimiento` (ambos `force: true`) y entrega
  `{ st, mig }` al padre. Colocado en Resumen (sustituye al boton propio),
  Mi trabajo y Sitio (arriba a la derecha, sobre las metricas).
- **Refresh automatico al marcar "Creada/Aplicada"** un cambio tipo `crear`
  (Aprobaciones y panel del Sitio): se fuerza la relectura del estado real
  para que el arbol y las metricas detecten la carpeta sin esperar al TTL.
- **Arbol en lenguaje llano**: "Expandir todo" → "Abrir todo",
  "Colapsar todo" → "Cerrar todo".

---

## Fix QA #3 — "Solicitar acceso a un area" fallaba para perfiles no-admin (2026-06-10)

**Estado:** Code-complete. 21/21 E2E (incluye regresion nueva `solicitud-acceso.spec.js`).

**Reporte (Carmen, correo 10/06):** un usuario no-admin no puede solicitar
acceso a un area distinta a la suya; el portal devuelve error y la solicitud no
se registra. Con admin si funciona. Severidad Media-Alta.

**Causa raiz (no eran roles del dashboard):** la solicitud se guardaba en el
archivo `_seguimiento/seguimiento-migracion.json` del sitio DESTINO, donde el
solicitante por definicion no tiene escritura (justo por eso pide acceso). El
admin escribe en todos los sitios, por eso solo a admin le funcionaba.

**Arreglo (`seguimiento-store.js`):**
- `addSolicitudPermiso`: cascada de escritura — sitio destino → area(s)
  propia(s) del solicitante (`misSitios`) → hub; primer sitio donde pueda
  escribir. `item.slug` conserva el DESTINO solicitado.
- `getSeguimiento`/`getSolicitudesPermiso`: las solicitudes se agregan por id
  entre TODOS los archivos (prefiriendo la copia del archivo de su propio
  sitio), porque ya pueden vivir en el archivo de otro sitio.
- `setSolicitudPermisoEstado`: actualiza la copia "ganadora" (la misma que
  muestra la agregacion), localizada con `localizarSolicitud`.
- Mock e2e: opcion `denySites` (403 al resolver siteId) + `putsPorSitio`.

**Verificacion:** `solicitud-acceso.spec.js` — Daniela (no-admin, area propia
via quien-migra) solicita acceso a SGSI-Marketing con el sitio denegado: la
solicitud se registra en el archivo de SU area (nunca en el destino) y el admin
la ve Pendiente en Aprobaciones. Con la conducta anterior el test falla
(comprobado). Limpieza: `test-results/` deja de versionarse.

---

## Ajuste — Aprobaciones: nombre final PRECARGADO con el solicitado (2026-06-10)

**Estado:** Code-complete. 20/20 E2E.

- `FormAprobar` precarga el nombre final con el ya acordado o, si no hay, con el
  solicitado (base editable; el boton arranca habilitado). Sigue siendo
  obligatorio: si se borra el campo, no se puede confirmar (la regla del store
  no cambia).
- Tests actualizados a los dos ajustes de QA del dia: `aprobaciones.spec.js`
  (precarga + obligatorio al borrar), `arbol.spec.js` y `arbol-anidado.spec.js`
  (clasificacion obligatoria al registrar: Registrar deshabilitado y aviso sin
  clasificacion). Nota: el Fix #2 se habia pusheado con 3 specs en rojo; quedan
  en verde con esta tanda.

---

## Fix — Lost update entre sesiones: la subcarpeta virtual "desaparecia" (2026-06-10)

**Estado:** Code-complete. 20/20 E2E (incluye regresion nueva `concurrencia.spec.js`).

**Sintoma (Franco):** crear una carpeta virtual funcionaba (la aprobacion
aparecia), pero al crear una carpeta virtual DENTRO de otra virtual, la
aprobacion no aparecia y la subcarpeta desaparecia al poco tiempo.

**Causa raiz:** cada escritura sube el archivo COMPLETO del sitio
(`seguimiento-migracion.json`) desde la copia en memoria de la sesion, y esa
copia no se refrescaba en toda la sesion (`loadSeguimiento` cachea). Con dos
sesiones vivas (el area que propone + el admin que aprueba), cualquier
escritura desde una copia vieja pisaba lo escrito por la otra: al aprobar el
padre, el PUT del admin borraba del servidor la subcarpeta recien propuesta.
El caso anidado lo disparaba siempre porque exige una ronda previa de
crear/aprobar con ambas sesiones ya cargadas (copia vieja garantizada).

**Arreglo:**
- `seguimiento-store.js`: nueva `escribirSitio(slug, mutar)` — cola secuencial
  por sitio + RELEIDO del archivo del servidor y fusion (`fusionarConLocal`,
  union por id/clave; en conflicto manda el servidor y la mutacion se aplica
  despues sobre la copia fresca). TODAS las escrituras (nodos, apoyo,
  pendientes, fases, cambios de estructura, permisos) pasan por ahi.
- `refreshSeguimientoSitio(structure, slug)`: re-descarga un sitio y fusiona,
  sin escribir. Se usa al montar SitioView y Mi trabajo (mis areas).
- `AprobacionesView`: `loadSeguimiento(..., { force: true })` al entrar — las
  solicitudes las crean OTRAS sesiones; con la cache no aparecian sin F5.
- `ArbolCarpetas` (`FormAgregar`): los errores de guardado ahora se muestran
  (antes fallaba en silencio y la carpeta quedaba solo en memoria).
- Mock e2e (`graph-mock.js`): el GET del seguimiento ahora devuelve lo ultimo
  escrito por sitio (como SharePoint real), para poder probar recargas.

**Verificacion:** la regresion `concurrencia.spec.js` simula la otra sesion con
un PUT directo y aprueba desde la copia vieja: el ultimo PUT debe conservar la
subcarpeta (propuesto) y aprobar el padre. Sin el releido, el test falla
(comprobado); con el fix, 20/20.

---

## Ajuste — Aprobaciones: nombre final OBLIGATORIO al aprobar "crear" (2026-06-10)

**Estado:** Code-complete. Build no requerido (solo JS); 19/19 E2E.

**Necesidad:** al aprobar una solicitud de "crear carpeta", el admin debe FIJAR
el "nombre final" (con su numeral correcto) en ese momento; antes se podia
aprobar con el campo vacio o con el prellenado de la ruta solicitada sin
revisarlo. El dashboard nunca renombra carpetas reales: solo registra; el cambio
real lo hace PnP con el nombre acordado.

**Arreglo (dos capas):**
- `seguimiento-store.js` (`setCambioEstado`): regla de negocio — aprobar un
  cambio `tipo: 'crear'` sin nombre final (ni en `extra` ni ya anotado en el
  item) lanza error. Aplica a cualquier llamador, no solo a la vista.
- `AprobacionesView.js` (`FormAprobar`): el campo arranca VACIO (ya no se
  prellena con la ruta solicitada; esta queda como `placeholder` de referencia)
  y "Confirmar aprobacion" se deshabilita mientras el nombre final este vacio
  (con tooltip explicando por que). Etiqueta: "obligatorio, con su numeral".
  Sobrantes y permisos no cambian (no llevan nombre final).

```
src/lib/seguimiento-store.js        (setCambioEstado valida nombre final en 'crear')
src/components/AprobacionesView.js  (campo vacio + boton deshabilitado sin nombre)
tests/e2e/aprobaciones.spec.js      (asegura: vacio => no se puede confirmar)
```

---

## Ajuste — Estado de carga K9: perro rastreador olfateando (2026-06-09)

**Estado:** Code-complete. Verificado en navegador (animaciones bob/step/wag/puff
activas, titulo en Arial 18px, sin errores de consola).

Se reemplazo el spinner generico del estado `loading` por un componente
reutilizable `<Cargando>` (perro rastreador K9 que olfatea), alineado a la marca
JMA Seguridad / K9 y al dominio del dashboard (rastreo del estado real en
SharePoint).

- **Nuevo** `src/components/Cargando.js`: SVG del perro (cuerpo, cabeza, oreja,
  cuatro patas, cola, hocico + particulas de olfateo) con props `titulo` y
  `detalle` configurables. Defaults: "Rastreando en SharePoint…" /
  "Leyendo el estado real de la migracion. Esto puede tardar unos segundos."
- **CSS** en `src/styles/components.css`: bloque `.cargando-k9` con animaciones
  CSS (`transform-box: fill-box` para que las rotaciones giren sobre su punto) y
  `@media (prefers-reduced-motion: reduce)` que las desactiva. Se elimino el CSS
  muerto de `.loading`/`.loading::before`; el keyframe `jma-spin` se conserva
  porque lo usa el splash de arranque.
- **Reemplazo** de los 9 usos de `<div class="loading">` por `<${Cargando}>` en:
  Home, Sitio, Sitios, Evidencia, Ejecutivo, Aprobaciones, MiTrabajo, Apoyo,
  Usuarios. Home (carga inicial real) usa los textos por defecto; el resto pasa
  su mensaje contextual como `titulo`.

---

## Ajuste — Arbol: agregar carpeta dentro de una pendiente (pendiente anidada) (2026-06-09)

**Estado:** Code-complete. Build + 19/19 E2E (nuevo `arbol-anidado.spec.js`).

**Necesidad:** poder pedir una subcarpeta DENTRO de una carpeta que tambien esta
"pendiente de crear" (nodo virtual), no solo dentro de las reales. Asi un usuario
solicita una subcarpeta de una carpeta que acaba de solicitar.

**Arreglo (codigo):**
- `ArbolCarpetas.js`: el boton "+ carpeta" se muestra en TODOS los nodos (antes
  se ocultaba en los virtuales con `!node.virtual`). El resto ya funcionaba:
  `construirArbol` reconstruye los padres virtuales por su ruta y enlaza
  `padre/hijo`, asi que cada subcarpeta es su propio `cambio_estructura` "crear"
  con su ruta/padre y el arbol la muestra anidada (pendiente dentro de pendiente).

**Sin cambios:** la salvaguarda de borrado (confirmacion de "sobrante" en
carpetas con archivos) y el ciclo de estados en Aprobaciones siguen igual; los
nodos virtuales conservan su accion "quitar" (descarta el cambio).

```
src/components/ArbolCarpetas.js   ("+ carpeta" incondicional)
tests/e2e/arbol-anidado.spec.js   (pendiente dentro de pendiente)
```

---

## Ajuste — Aprobaciones: ciclo de vida explicito + nombre final acordado (2026-06-09)

**Estado:** Code-complete. Build + 18/18 E2E (nuevo `aprobaciones.spec.js`).

**Necesidad:** gestionar las solicitudes (crear/sobrante/acceso) con estados en
lenguaje llano, todo el ciclo visible y gestionable en la MISMA pantalla de
Aprobaciones, sin autodetectar nada por nombre/ruta (el nombre final puede
diferir del solicitado: podemos renombrar al crear).

**Ciclo de vida (lenguaje llano, todo manual desde Aprobaciones):**
- **Pendiente** (interno `propuesto`): la pide el usuario.
- **Aprobada** (`aprobado`): la aprueba un admin; al aprobar se anota el
  **nombre final acordado** (puede diferir del solicitado) y un **comentario**.
- **Creada/Aplicada** (`aplicado`): ya se hizo en la realidad; lo marca el admin
  a mano. "Creada" para carpetas nuevas, "Aplicada" para sobrantes y permisos.
- **Descartada** (`descartado`): si no procede.

NO se autodetecta por nombre/ruta: el paso a Creada/Aplicada es siempre manual.

**Arreglo (codigo):**
- `seguimiento-store.js`: `setCambioEstado`/`setSolicitudPermisoEstado` aceptan
  `extra = { nombreFinal, comentario }`; nuevo `aplicarMetaEstado` sella
  `nombreFinal`, `comentario`, y `aprobadoPor/En` o `aplicadoPor/En` segun el
  destino. Estados internos sin cambio (backward-compat).
- `AprobacionesView.js`: reescrita. Etiquetas llanas (`estadoLabel`), ciclo
  completo visible (se ordena abiertas primero, luego cerradas), formulario de
  aprobacion inline (nombre final solo en carpetas `crear`; comentario en todo),
  botones por estado (Aprobar / Marcar creada-aplicada / Descartar) y linea de
  meta con el nombre final acordado y la nota.
- `exporter.js`: hoja Excel "Cambios estructura" gana columnas "Nombre final
  acordado" y "Comentario"; el CSV de PnP (solicitudes aprobadas) suma columna
  "Nombre final" y mete el comentario en el detalle. El JSON ya los lleva.
- `components.css`: `.aprobar-row` para la fila del formulario embebida.
- `tests/e2e/aprobaciones.spec.js`: Pendiente -> Aprobada (con nombre final +
  comentario) -> Creada, validando persistencia y etiquetas.

**Nota de verificacion:** la prueba efectiva son los E2E con el mock de Graph;
un preview en navegador no ejercita esto sin MSAL real + mock de Graph.

```
src/lib/seguimiento-store.js       (extra nombreFinal/comentario + aplicarMetaEstado)
src/components/AprobacionesView.js  (reescrita: ciclo llano + form de aprobacion)
src/lib/exporter.js                 (nombre final + comentario en Excel y CSV PnP)
src/styles/components.css           (.aprobar-row)
tests/e2e/aprobaciones.spec.js      (ciclo completo)
```

---

## Ajuste — "Mi trabajo": el propietario del area edita estado sin "quien migra" (2026-06-09)

**Estado:** Code-complete.

**Necesidad:** en "Mi trabajo" el selector de estado de migracion quedaba
bloqueado cuando ninguna carpeta tenia "quien migra" asignado. El dueno de un
area no podia marcar el avance de su propia area sin que un admin le delegara
carpeta por carpeta.

**Arreglo (codigo):**
- `seguimiento-store.js`: nuevo `esPropietarioSitio(nombre, sitio)` — como
  `esMiembroMaestro` pero ignora la lista de acceso; solo el `propietario` del
  maestro.
- `ArbolCarpetas.js`: nuevo prop `esPropietario` (default `false`); el selector
  se habilita si `admin || esPropietario || (quien migra === yo)`.
- `MiTrabajoView.js`: pasa `esPropietario=esPropietarioSitio(miNombre, sitio)`
  por cada area.

**Regla resultante:** el dueno del area marca el estado de cualquier carpeta de
SU area directo; los delegados marcan solo las carpetas donde figuran como
"quien migra". La asignacion explicita de "quien migra" sigue siendo de admin
desde "Sitios". Backward-compat: en otras vistas (SitioView) `esPropietario`
queda en `false` y el comportamiento no cambia. La escritura no destructiva de
`updateNodo` no cambia; "Verificada" sigue restringida a Apoyo/Franco.

```
src/lib/seguimiento-store.js       (esPropietarioSitio)
src/components/ArbolCarpetas.js    (prop esPropietario en el gate del selector)
src/components/MiTrabajoView.js    (pasa esPropietario por sitio)
```

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

**Nota:** la consultora ya fue invitada como externa en Entra (Franco,
2026-06-09). El cotejo de la lista blanca reconoce automaticamente tanto su
correo real como el UPN de invitado B2B (`usuario_dominio.com#EXT#@...
onmicrosoft.com`), reconstruyendo el correo original (el ultimo `_` del prefijo
era la `@`). Asi no hay que averiguar el UPN exacto. Falta solo darle **lectura
en SharePoint** a los sitios para que vea datos.

```
src/auth/allowed-users.js   (OBSERVADORES + cotejo tolerante a UPN #EXT#)
src/app.js
src/components/Sidebar.js
src/components/SitioView.js
tests/e2e/roles.spec.js      (observador por correo y por UPN #EXT#)
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
