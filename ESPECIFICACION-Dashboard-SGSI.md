# Especificación del Dashboard SGSI — fuente de verdad (v1.0)

Este documento reemplaza todos los prompts sueltos anteriores. Es la definición única del dashboard. Claude Code debe reconciliar lo ya construido contra esto y completarlo; no avanzar por features sueltas, sino hacia esta idea sólida.

---

## 1. Para qué es (propósito en una frase)

Es la **cabina participativa de la migración documental a SharePoint** para ISO 27001: el equipo SGSI asigna responsabilidades, cada persona reporta su avance y pide lo que necesita, el SGSI recopila y aplica los cambios reales por PnP, y el dashboard da seguimiento, visibilidad y evidencia.

No es un verificador de carpetas. La estructura ya está creada; lo que importa es **cómo avanza la migración de cada persona**.

## 2. Modelo operativo (el bucle)

1. **SGSI asigna** (arriba-abajo): quién migra cada área/carpeta y su apoyo. El usuario no se auto-asigna.
2. **El usuario reporta**: marca su avance y, desde "Mi trabajo", registra solicitudes (crear/borrar carpeta, pedir acceso).
3. **El equipo SGSI apoya y verifica** (no hace el trabajo por ellos).
4. **Franco recopila** las solicitudes (export), **se las pasa a Cowork**, y **se aplican por PnP** (crear/borrar carpetas, cambiar permisos), con salvaguarda de no borrar carpetas con contenido.
5. **El dashboard refleja** los cambios y marca como hechas las solicitudes aplicadas.

El dashboard **nunca** crea/borra carpetas ni cambia permisos por sí mismo. Solo lee y registra. Lo real lo hace PnP.

## 3. Roles

- **Admin / SGSI** (Franco, Carmen, Ezequiel, Chema, Jorge): ven todo, asignan, verifican, exportan solicitudes.
- **Usuario** (resto del personal): entra a "Mi trabajo"; ve y edita solo lo suyo; marca avance y registra solicitudes. No asigna ni verifica.

El alcance lo impone SharePoint: como el dashboard lee por Graph **como** el usuario, cada quien solo resuelve los sitios a los que tiene acceso.

## 4. Datos y lógica (qué es cada cosa)

- **Estructura esperada** (solo lectura): `estructura-maestra-sgsi.json`. Sitios, carpetas, clasificación y propietario. Fuente del "deber ser".
- **Estado real** (solo lectura, Graph): existencia de carpetas y nº de archivos por carpeta, por `/drive/root` (independiente del idioma).
- **Seguimiento** (lectura/escritura): un archivo por **cada sitio** (`_seguimiento/seguimiento-migracion.json` dentro del sitio), para que cada persona escriba donde ya tiene permiso. Contiene: estado de migración por carpeta, quién migra, apoyo, historial, y las solicitudes.
- **Métricas derivadas**: el % de migración (por persona, área y global) se **deriva** de los estados por carpeta. Nada de % escrito a mano.
- **Identidad de personas**: una entrada por persona (normalizada; "(de momento)" no crea duplicados).

## 5. Navegación (concentrada: 5 entradas, barra lateral)

1. **Mi trabajo** — vista por defecto. Lo que me asignaron, mi avance y mis solicitudes.
2. **Resumen** — panorama: migración global y por persona; incluye dentro los paneles "Requiere atención" y "Actividad reciente" (no como menús aparte).
3. **Personas** — combina "Por usuario" y "Por apoyo" (pestañas).
4. **Sitios** — lista → árbol de cada sitio; aquí viven permisos (vista) y el registro de cambios de estructura. (Admin.)
5. **Evidencia** — export ISO, resumen ejecutivo (1 página, Dirección) y export de solicitudes **aprobadas** para PnP.

Usuario normal: solo ve "Mi trabajo" (con el árbol de su área dentro). El resto es de admin.

## 6. Vistas (qué hace cada una)

- **Mi trabajo**: árbol de mi(s) área(s) con clasificación y estado; marco estado de migración de mis carpetas; registro solicitudes (crear carpeta, marcar sobrante/borrar, pedir acceso). Mi avance y mis pendientes.
- **Resumen**: avance de migración (global + por persona con foto y barra). Panel "Requiere atención" (sin avance 7+ días, sin quién migra, bloqueadas, Restringida vacías). Panel "Actividad reciente" (últimos cambios). Estructura, bloque pequeño secundario.
- **Personas**: por persona (Por usuario) y por apoyo (Por apoyo), con foto, avance, áreas y última actualización.
- **Sitios** (admin): árbol visual e interactivo por sitio — clasificación por color + icono + texto del estado, nº de archivos, propietario/acceso (con marca temporal correcta), acciones de cambio de estructura.
- **Evidencia**: export Excel/CSV con historial; resumen ejecutivo imprimible; export de solicitudes **aprobadas** (CSV/JSON) listo para PnP. La cola muestra propuestas/aprobadas/aplicadas; solo se exportan las aprobadas.

## 7. Flujos de solicitud (crear / borrar / acceso)

Todos siguen el mismo ciclo **con aprobación previa**: el usuario **registra** (estado propuesto) → un **admin SGSI valida** (aprobado) o descarta → se **exporta SOLO lo aprobado** → Cowork lo **aplica por PnP** → se **marca aplicado**. Lo que se exporta y llega a Cowork es siempre definitivo (aprobado), nunca peticiones crudas. La aprobación es exclusiva de admin.

- **Crear carpeta** (100% visual, sin escribir rutas): el usuario **navega el árbol y pulsa la carpeta destino** (o "agregar dentro de aquí") y solo escribe el **nombre** de la nueva carpeta; la ubicación/ruta se calcula sola desde el nodo seleccionado. Queda "pendiente de crear" (punteada), como `cambio_estructura` tipo crear. **Nunca** un campo de "ruta específica" a mano.
- **Borrar (sobrante)**: se **selecciona la carpeta existente en el árbol** (no se escribe ruta). Si tiene archivos (nº de archivos), el dashboard **avisa y exige confirmación**; nunca facilita borrar con contenido.
- **Pedir acceso**: el usuario solicita acceso a un área/carpeta → `solicitud_permiso` (agregar persona a un sitio, con motivo). El admin la revisa y la aplica por PnP. El dashboard no concede acceso por sí mismo.

Cada solicitud lleva: solicitante, fecha, motivo y estado (propuesto / aprobado / aplicado / descartado).

## 8. Seguridad

- Solo lectura sobre estructura y permisos; la única escritura es el seguimiento por sitio.
- Scopes Graph: `User.Read`, `Sites.Read.All`, `Files.ReadWrite.All`, `User.ReadBasic.All` (fotos). Sin scopes de escritura adicionales.
- **Badge "temporal" correcto**: una persona es temporal en un sitio solo si NO figura en el propietario/acceso del maestro de ese sitio. En su área propia (p. ej. Franco en el hub SGSI y CyberSec) es permanente, sin badge.
- "Verificada" solo lo marca Apoyo SGSI o Franco (no quien migró).
- Acceso de migración del equipo SGSI = temporal, a retirar al cierre.

## 9. Diseño (pase visual)

- Jerarquía: lo importante arriba-izquierda; Resumen encabeza con migración por persona.
- Estado = color + icono + texto (nunca solo color); contraste de texto ≥ 4.5:1.
- Avatares (foto real / iniciales) en header (usuario logueado), Mi trabajo, Personas y tarjetas.
- Componentes consistentes (radio, borde, espaciado, tipografía de números) con los tokens JMA; barra lateral de navegación.
- Estados vacíos que guían ("asigna quién migra para empezar"), no "vacío" a secas.
- Una fuente, dos pesos (400/500); lazy-load para bajar el bundle; responsive.
- Referencia visual: el mockup aprobado (métricas arriba, avance por persona con foto y barra, árbol con clasificación por color e icono de estado).

## 10. Delta vs lo construido (qué cambiar para llegar aquí)

- Concentrar navegación a 5 entradas (barra lateral); absorber menús sueltos.
- "Mi trabajo" con el árbol del área del usuario + acciones de solicitud (crear/borrar/acceso).
- Mover el seguimiento a un archivo **por sitio** (no en el hub); el archivo del hub queda como respaldo de solo lectura (no destructivo).
- Corregir el badge "temporal" (no marcar a quien es dueño legítimo del sitio).
- Fotos en header y vistas de trabajo (re-login para tomar el scope nuevo).
- Pase de diseño (sección 9).
- Quitar lo que no aporta: % de estructura como protagoni