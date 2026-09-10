# SponsorHub Lean — Arquitectura

## Contexto

Versión limpia del SponsorHub actual (construido en Lovable, descartado —
solo se usó como referencia visual/funcional, código no reutilizado).
Reemplaza la fragmentación de herramientas descrita por CS en
`SponsorHub_Entregables_CS_a_Producto.docx.md`.

## Decisiones y su razón (no solo el qué, el porqué)

### Stack
- **Next.js en Vercel** — frontend + API routes en un solo proyecto.
- **Supabase (Postgres + Auth + Storage), schema `sponsorhub`** — capa
  operativa real. Ver "Por qué un schema propio en un proyecto
  compartido" abajo — el proyecto Supabase donde vive esto ya tiene
  otro producto de ColombiaTech en el schema `public`.
- **Notion** — fuente de datos existente de CS, NO el modelo de datos de la app.

### Por qué un schema propio en un proyecto compartido (no un proyecto nuevo)
Ninguna organización de Supabase disponible para ColombiaTech tenía
espacio para un proyecto gratuito adicional, y el costo de $10 USD/mes
por proyecto adicional no fue autorizado. Se evaluó brevemente migrar a
Neon + Auth.js + Vercel Blob (documentado como alternativa descartada
más abajo), pero se optó por reusar un proyecto Supabase Free existente
de ColombiaTech con schema separado, tras confirmar tres condiciones:
1. Ese proyecto tiene margen de sobra en su cuota de 500MB.
2. Hay acceso real de owner/admin a ese proyecto.
3. El producto que ya vive ahí NO usa Supabase Auth — sin colisión en
   `auth.users`.

**Esto recupera todo lo que Neon hubiera hecho perder:** RLS con
`auth.uid()` real (aislamiento por sponsor a nivel de base de datos, no
solo en código de aplicación), Storage integrado, una sola cuenta que
administrar.

Todas las tablas, tipos y policies de SponsorHub viven en el schema
`sponsorhub`, no en `public` — para no chocar con nombres ni tocar el
otro producto. Esto exige un paso manual fuera del SQL: agregar
`sponsorhub` en **Settings > API > Exposed schemas** del dashboard de
Supabase; por defecto solo `public` es accesible vía la API REST /
cliente JS.

<details>
<summary>Alternativa descartada: Neon + Auth.js + Vercel Blob</summary>

Se consideró y se llegó a implementar parcialmente esta ruta antes de
confirmar que el schema compartido era viable. Se descartó porque tenía
un costo de seguridad real: Neon no tiene `auth.uid()` ni una sesión de
Postgres consciente del usuario autenticado — esa noción solo existe en
la capa de aplicación (Auth.js). El aislamiento entre sponsors habría
dependido enteramente de que el código filtrara correctamente por
`sponsor_id` en cada query, sin red de seguridad a nivel de base de
datos. Se abandona esta ruta en cuanto el schema compartido en Supabase
se confirmó viable — no quedan artefactos de Neon en el repo.
</details>

### Deuda técnica de infraestructura (ver README para el detalle activo)
El proyecto Supabase usado no es una cuenta de infraestructura propia
de ColombiaTech con owner claro más allá de una persona — ver la
sección "Deuda técnica activa" del README para el estado exacto y el
plan de migración.

### Por qué Postgres propio y no un espejo 1:1 de Notion
El "Customer Success Board" de Notion tiene 60+ properties pensadas para
que un humano las edite (multi-selects como "Actividad" con 13 valores
mezclando conceptos distintos, rollups, relations a 8+ data sources).
Reflejar esa estructura tal cual hereda su ambigüedad — ej. no hay forma
directa de sacar "% de avance" de un multi-select sin lógica de traducción.
El sync hace esa traducción UNA VEZ (en el cron), no en cada render.

### Por qué sync periódico, no tiempo real
Notion API no tiene webhooks confiables para todos los eventos de cambio.
Escritura verdaderamente bidireccional en vivo (CS edita en Notion → sponsor
lo ve al instante) requiere más que un día de trabajo sólido. Se decidió:
sync cada 1-5 min, invisible para el usuario (ve el dato actualizado al
entrar/refrescar, no en tiempo real).

### Reglas de conflicto (dos escritores: CS/Growth en el panel admin, sponsor en su portal)
- **El panel admin (rol `admin_ct`) es la única superficie que escribe
  estado de compromiso, catálogo de beneficios, y estados posibles.**
  El sponsor NUNCA edita esto — solo lo ve como timeline de solo lectura
  (`sponsorhub.v_timeline_sponsor`).
- **El sponsor solo escribe** sus propios insumos (`archivos` con
  `direccion = 'sponsor_sube'`) y sus propios registros de acceso
  (`accesos_personas`) — nunca campos que CT gestiona.
- Esta separación reemplaza el diseño original ("Notion gana siempre")
  una vez se introdujo el panel admin (0003_roles_y_admin.sql): ahora
  hay tres escritores potenciales (Notion vía sync, admin_ct vía panel,
  sponsor vía portal) y las policies de RLS son las que arbitran, no
  una convención documentada únicamente en texto.

### Por qué extracción filtrada del CS Board existente, no una database nueva
Decisión explícita de Juanes: ir rápido hoy sobre crear una database Notion
dedicada. **Trade-off aceptado conscientemente:** si CS renombra o reestructura
una property en el CS Board (que sigue usando para su propio trabajo diario),
el sync se rompe silenciosamente hasta que alguien actualice el mapper.
Mitigación: `lib/notion/allowlist.ts` referencia nombres de campo exactos, y
`mappers/compromiso.mapper.ts` falla ruidosamente (console.warn) ante valores
no mapeados, en vez de fallar en silencio.

### Multi-evento desde el día 1
El workspace de Notion tiene al menos 3 líneas de evento (CTW/CTF, AI
Summit, GovTech), cada una con su propio árbol de databases y estructura
parcialmente distinta. `eventos` es una entidad de primer nivel para que
agregar una línea nueva sea escribir un adaptador de sync nuevo, no
rediseñar el esquema.

**Estado actual:** solo CTW/CTF tiene datos operativos reales (sponsors
confirmados con compromisos). GovTech está en fase de captación de
patrocinio — su "Compromisos por Áreas" es una página de texto libre con
tareas internas del equipo, no una database de compromisos por sponsor.
No existe todavía data que sincronizar para GovTech. La arquitectura está
lista para conectarlo en cuanto esa data exista.

### Allowlist, no blocklist, para campos de Notion
El CS Board mezcla datos de venta (`$$*`, `*Ya Pago 50%?`), asignación
interna (`Owner`, `Bloqueado por`) y datos operativos del sponsor en la
misma tabla. Un sync "traer todo lo del sponsor" filtraría datos
comerciales internos al dashboard del sponsor — no es un bug menor, es una
filtración de datos a un cliente. `lib/notion/allowlist.ts` es la única
fuente de verdad de qué campos entran; lo que no está listado, no sincroniza.

## Fuente de Notion mapeada (línea CTW/CTF)

| Database Notion | Uso |
|---|---|
| `Customer Success Board` (collection://2d299829-d217-8123-aab7-000bf1a05ee8) | Datos de sponsor, contacto, speaker, entregables — filtrado por allowlist |
| `Estado Compromisos Sponsors` (collection://2d299829-d217-81e3-b039-000be569145b) | Compromisos y % de avance — traducido, no mapeado 1:1 |
| `Registrados tickets CTF` (collection://31799829-d217-81e6-a337-000b56f941f4) | Función 2: inscripción de personas para accesos |

Ver `docs/NOTION_MAPPING.md` para el detalle campo por campo.

## Lo que NO se construyó hoy (decisiones explícitas de alcance)
- SSO corporativo / login con Google — backlog, según el documento de CS.
- Notificaciones automáticas por cada actualización — CS decide manualmente
  qué notificar (función 4 del documento).
- Sync verdaderamente bidireccional en tiempo real.
- Adaptador de sync para GovTech hacia `catalogo_beneficios` (el catálogo
  real ya existe en Notion, ver abajo, pero el mapper de sync todavía no
  está escrito) ni AI Summit (fuera de alcance de esta fase).
- Catálogo de beneficios por tier para CTW/CTF — decisión explícita de no
  improvisarlo; CTW/CTF sigue con compromisos manuales hasta que CS
  estructure su propio catálogo, igual al de GovTech.
- Flujo de invitación para crear usuarios `admin_ct` — el primer admin se
  promueve manualmente por SQL Editor (ver 0003_roles_y_admin.sql).

## SponsorHub anterior (predecesor real, no una referencia externa)
Existe un SponsorHub anterior en producción real
(`sponsors-hub-ct.vercel.app`, Payload CMS + Next.js + Supabase) que se
usó hasta el último CTW/CTF y que esta versión lean reemplaza. Una
auditoría técnica de ese sistema (28 jul 2026, página de Notion
"Sponsors Hub CT — Auditoría Técnica & Mejoras") encontró fallas graves
de seguridad (CRUD público sin autenticación en casi todas las
colecciones, cascadas de webhooks sin control, JWT secret con fallback
vacío) — es la razón de fondo detrás de "mal construido" que motivó
reemplazarlo, no solo una preferencia de stack.

De esa auditoría se rescataron dos datos de producto reales (no de
código): los tiers que usó ese sistema (`Diamond, Platinum, Gold,
Silver, Bronze, Aliados, Experiencia, Presenta, Media Partner`) y sus
estados de entregable (`pending, completed, overdue, published,
in_progress_grid`) — ambos informaron el diseño de `estados_compromiso`
más abajo, aunque el modelo de datos en sí no se reutilizó.

## Catálogo de beneficios por tier (0002_catalogo_beneficios.sql)
Los compromisos ya no se cargan a mano sin relación a lo que el sponsor
realmente compró. `catalogo_beneficios` modela, por evento y tier, qué
beneficios corresponden (fuente real: "📦 Catálogo de Beneficios por
Paquete GovTech" en Notion — GovTech tiene esto estructurado, CTW/CTF
no). Un trigger (`generar_compromisos_desde_catalogo`) crea
automáticamente los compromisos de un sponsor al asignarle un tier
(`sponsors.paquete`), leyendo del catálogo de su evento. Si el evento no
tiene catálogo cargado (caso actual de CTW/CTF), el trigger simplemente
no encuentra filas y no genera nada — el flujo manual sigue funcionando
sin romperse.

**Nota de riesgo asumida:** se confirmó con Juanes que `sponsors.paquete`
y "tier" son el mismo concepto. Si CS reporta un caso donde difieren, hay
que revisar el trigger antes de que genere compromisos incorrectos.

## Estados de compromiso: tabla editable, no enum (0002/0003)
Growth debe poder crear y editar los estados posibles (ej. agregar
"En revisión legal") sin depender de una migración de código. El enum
`compromiso_estado` de 0001_init.sql fue reemplazado por la tabla
`estados_compromiso`, gestionable desde el panel admin. Seed inicial:
Pendiente, En progreso, Vencido, Publicado, Completado — punto de
partida editable, no un valor fijo del sistema. El seguimiento es por
status, no por porcentaje: la columna `compromisos.porcentaje` se
eliminó en 0002.

## Roles: admin_ct vs sponsor (0003_roles_y_admin.sql)
`sponsor_usuarios` ganó una columna `rol` (`admin_ct` | `sponsor`) con
un constraint de integridad: un `admin_ct` nunca tiene `sponsor_id`, un
`sponsor` siempre lo tiene. RLS se reescribió completa alrededor de esta
distinción — ver la tabla de responsabilidades por rol abajo.

| | Portal del sponsor | Panel admin CT (`admin_ct`) |
|---|---|---|
| Edita estado de compromiso | Nunca | Único que puede |
| Ve compromisos | Solo lectura, timeline (`v_timeline_sponsor`) | Lectura + escritura, vista de gestión |
| Sube archivos | Sus insumos (`direccion = sponsor_sube`) | Entregables de CT (`direccion = ctw_entrega`) |
| Alcance de datos | Solo su propio sponsor | Todos los sponsors, todos los eventos |
| Define estados posibles | No | Sí (CRUD en `estados_compromiso`) |

## Por qué no se fusionó con Agenda Hub
Se evaluó explícitamente construir SponsorHub dentro del mismo producto
que Agenda Hub (otro proyecto de ColombiaTech, mismo stack de
infraestructura). Se descartó: son dominios sin solapamiento real de
datos (Agenda gestiona speakers/slots/horarios; SponsorHub tiene un
actor externo real —el sponsor— con su propia sesión y datos
comercialmente sensibles). Fusionarlos mezclaría el aislamiento de
RLS de dos audiencias que nunca deben verse entre sí. Sí se reutiliza
la capa de infraestructura de Agenda (patrón de Auth, Navbar,
componentes de tabla/filtros) — nunca su esquema de datos ni su lógica
de dominio. Un panel único de ColombiaTech que navegue entre productos
como secciones es una idea válida para evaluar más adelante, no algo
para construir hoy.

## Workspaces por evento en el panel admin
`eventos` ya era una entidad de primer nivel desde 0001_init.sql. El
panel admin usa un segmento de ruta dinámico (`app/(admin)/[evento]/...`)
para filtrar toda la vista por el evento activo. Se confirmó con Juanes
que cualquier usuario `admin_ct` ve y gestiona todos los eventos — no
existe (ni se construyó) una tabla de permisos usuario↔evento; si en el
futuro se necesita restringir a personas específicas a eventos
específicos, esa es una migración nueva, no algo ya soportado.
