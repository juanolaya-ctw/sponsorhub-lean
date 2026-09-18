# Mapping Notion → Postgres

Este documento es la referencia campo por campo. El código en
`lib/notion/allowlist.ts` es la fuente de verdad ejecutable — si este
documento y el código difieren, el código manda; actualiza este archivo.

## `Customer Success Board` (collection://2d299829-d217-8123-aab7-000bf1a05ee8)

### Permitidos (sincronizan a `sponsors`)

| Campo Notion | Columna Postgres | Nota |
|---|---|---|
| `Sponsor*` | `nombre` | title de la página |
| `*Paquete` | `paquete` | Diamond/Gold/Silver/etc. |
| `*Contacto` | `contacto_nombre` | |
| `*Mail Principal` | `contacto_email` | |
| `*Teléfono` | `contacto_telefono` | |
| `Cargo` | `contacto_cargo` | |
| `Link Logo` | `logo_url` | |
| `Vocero Confirmado` | `speaker_nombre` | |
| `Perfil del vocero` | `speaker_perfil` | |
| `Linkedin Vocero ` | `speaker_linkedin` | ojo: trailing space en el nombre real de Notion |
| `Foto del vocero` | `speaker_foto_url` | |
| `Enlace publicación Newsletter` | `newsletter_url` | |
| `Informe Final` | `informe_final_url` | |
| `PPT informe final` | `informe_final_ppt_url` | |

### Excluidos explícitamente (nunca sincronizan)

| Campo Notion | Por qué se excluye |
|---|---|
| `$$*` | Monto de venta — dato comercial interno |
| `*Ya Pago 50%?` / `*Ya pago 100%?` | Estado de pago — dato comercial interno |
| `Owner` | Asignación interna de CS |
| `Key ` | Asignación interna de CS |
| `Grupo` | Agrupación interna de gestión |
| `Bloqueado por` / `Está bloqueando` | Gestión interna de dependencias |
| `Tasks Customer Success` | Tareas internas del equipo |
| `🗂️ CRM Sales`, `Encargado SALES`, `Mail SALES`, `Cel SALES`, `Paquete SALES`, `Estado Sales` | Todo el bloque de CRM de Sales — no es del sponsor, es del proceso comercial |
| `*Contrato` | Archivo legal — visible solo para CS internamente |

## `Estado Compromisos Sponsors` (collection://2d299829-d217-81e3-b039-000be569145b)

**No se mapea 1:1** — se traduce a filas de la tabla `compromisos` vía
`lib/notion/mappers/compromiso.mapper.ts`.

| Campo Notion | Tipo original | Traducción |
|---|---|---|
| `Actividad` | multi-select (13 valores) | Cada valor presente → una fila `compromisos` con `tipo = actividad_<valor>`, estado según `ACTIVIDAD_A_ESTADO` |
| `Estadoweb` | multi-select | Igual que `Actividad`, pendiente de mapear al detalle si se necesita por separado |
| `% BBDD` | select ("50"/"100" como string) | Fila `compromisos` tipo `base_de_datos`, `porcentaje` parseado a integer |
| `Entrega bbdd` | checkbox | Fila `compromisos` tipo `entrega_bbdd` |
| `Logo web` | checkbox | Fila `compromisos` tipo `logo_web` |
| `Logo piezas CTW` | checkbox | Fila `compromisos` tipo `logo_piezas_ctw` |
| `Newsletter ` | checkbox | Fila `compromisos` tipo `newsletter` |
| `Anuncio patrocinio` | checkbox | Fila `compromisos` tipo `anuncio_patrocinio` |

**Excluidos:** `Estado`, `Sprint`, `Paquete`, `PPT Informe final` — son
rollups derivados del `Customer Success Board`; se leen de ahí directamente,
no de este rollup redundante.

## `Registrados tickets CTF` (collection://31799829-d217-81e6-a337-000b56f941f4)

Mapea directo a `accesos_personas` — esta database ya está limpia, sin
mezcla con datos internos.

| Campo Notion | Columna Postgres |
|---|---|
| `Nombre` | `nombre` |
| `Apellido` | `apellido` |
| `Email` | `email` |
| `Phone` | `telefono` |
| `Cargo` | `cargo` |
| `Sponsors crm` (relation) | resuelve a `sponsor_id` |

`tipo` (`vip`/`general`/`preferencial`/`escarapela`/`arl_montaje`) no viene
de esta database — se define según de qué vista/página del sponsor se
originó la inscripción (pendiente de confirmar con CS el criterio exacto
si se necesitan varias databases de accesos, ej. VIP vs standard).

## `📦 Catálogo de Beneficios por Paquete GovTech` (collection://3d499829-d217-80c3-bdf2-000bc2830c3a)

Mapea a `catalogo_beneficios` (ver 0002_catalogo_beneficios.sql). A
diferencia de CTW/CTF, GovTech SÍ tiene un catálogo estructurado de qué
beneficio corresponde a cada tier — descubierto tras revisar el Home de
GovTech directamente, corrigiendo la suposición anterior de que GovTech
no tenía data operativa real.

| Campo Notion | Columna Postgres |
|---|---|
| `Beneficio` (title) | `beneficio` |
| `Categoría` | `categoria` |
| `Paquete` | `tier` (valores reales: `Associate Partner`, `Elite Partner`, `Deluxe Partner` — no confundir con los tiers de CTW/CTF) |
| `Detalle` | `notas` (aunque el campo se llama distinto, el contenido observado coincide con notas aclaratorias) |
| `Evento` | ya implícito en `evento_id` — no se sincroniza como columna separada |

Los beneficios son acumulativos y escalonados por tier: Elite Partner
incluye una versión ampliada de lo que tiene Associate Partner (más
accesos, mismo tipo de beneficio) más beneficios nuevos (Stand, Workshop);
Deluxe Partner extiende Elite igual. El sync (cuando se escriba el mapper
real) debe traer TODAS las filas por evento — el trigger de generación
automática de compromisos (`generar_compromisos_desde_catalogo`) ya
asume que cada fila de esta tabla es un compromiso independiente, no que
hay que calcular la diferencia entre tiers.

**Pendiente:** escribir `lib/notion/mappers/catalogo.mapper.ts` — hoy
existe el modelo de datos destino (`catalogo_beneficios`) y la fuente
real inventariada, pero no el código de sync entre ambos.

## `🏃🏻‍♀️ Acciones FU - Sponsors GovTech` (collection://3d499829-d217-807b-b2ec-000b68a6e190)

**No es la fuente para el estado de compromisos del sponsor.** Es el
histórico de seguimiento operativo interno de CS (con Owner, fechas de
creación, estado tipo Kanban: Listo/To Do/En curso/En riesgo/Backlog).
Su campo `Beneficio LAB` es texto libre sin relación estructurada al
catálogo de beneficios — confirma que hoy en Notion no existe un vínculo
automático entre "qué le corresponde a un sponsor" (catálogo) y "qué se
ha hecho" (esta tabla). Esa desconexión es precisamente lo que
`catalogo_beneficios` + `compromisos` + el trigger de generación
automática resuelven del lado de la app — no se replica este Kanban
interno de CS en el esquema de SponsorHub.

## GovTech — adaptador de sync (fase actual)

El cron `/api/sync/notion` **solo** procesa `eventos.slug = 'govtech-2026'`.
No consulta el Customer Success Board de CTW/CTF ni corre
`compromiso.mapper.ts`.

### Database de sponsors GovTech

El UUID se configura en `eventos.notion_source_id` (fallback:
`NOTION_GOVTECH_DATA_SOURCE_ID`). El código no hardcodea un collection ID
de CTW.

Filtro de páginas: property `Estado` (select) en `Activo` o
`Pendiente por Kick off`. Quien salga de esos valores **no se
borra** de Postgres (el portal/usuario del sponsor se conserva).

Allowlist ejecutable: `GOVTECH_SPONSOR_FIELD_ALLOWLIST` en
`lib/notion/allowlist.ts`. Se extraen strings (title, rich_text, select,
email, etc.) — nunca el objeto crudo de Notion. Columnas destino:

| Campo Notion (nombres CS Board + alias comunes) | Columna Postgres |
|---|---|
| `Sponsor*` / `Sponsor` / `Nombre` | `nombre` |
| `*Paquete` / `Paquete` | `paquete` |
| `*Contacto` / `Contacto` | `contacto_nombre` |
| `*Mail Principal` / `Mail Principal` / `Email` | `contacto_email` |
| `*Teléfono` / `Teléfono` / `Telefono` | `contacto_telefono` |
| `Cargo` | `contacto_cargo` |
| `Link Logo` / `Logo` | `logo_url` |

`notion_page_id` = id de la página. Speaker / entregables CTW **no** se
escriben: esas columnas no existen en `sponsors`.

Tras el upsert, el trigger `generar_compromisos_desde_catalogo` crea
compromisos desde el catálogo GovTech ya seedado. El **status** de cada
beneficio se gestiona en admin/portal, no se pisa desde Notion.

Los valores de `paquete` deben coincidir texto por texto con el catálogo
(`Associate Partner`, `Elite Partner`, `Deluxe Partner`); si no, queda
alerta `tier_sin_match`.

Pendiente (fuera de esta fase): `catalogo.mapper.ts` contra la database
del catálogo; sync de status de beneficios; CTW/CTF.
