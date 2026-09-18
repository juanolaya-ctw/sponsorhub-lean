# SponsorHub Lean

Versión limpia del SponsorHub de ColombiaTech — reemplaza la versión en
Lovable. Notion (el CS Board existente) sigue siendo la fuente de datos
que usa el equipo de CS; esta app lee de ahí vía sync periódico y da al
sponsor una interfaz propia, sin exponerle el desorden interno de Notion.

Ver `docs/ARCHITECTURE.md` para el porqué de cada decisión, y
`docs/NOTION_MAPPING.md` para el mapeo campo por campo.

## Stack

- Next.js 15 (App Router) en Vercel
- Supabase (Postgres + Auth + Storage) — **schema `sponsorhub`**, en un
  proyecto compartido con otro producto de ColombiaTech (ver abajo)
- Notion API como fuente de datos operativos de CS
- pnpm workspaces

## ⚠️ Este proyecto Supabase es compartido — lee esto antes de tocar la DB

El proyecto vive en un Supabase Free existente de ColombiaTech que ya
tiene otro producto corriendo en el schema `public`. Todo lo de
SponsorHub vive en su propio schema, `sponsorhub` — nunca crear tablas
nuevas en `public` desde este repo, y nunca modificar tablas fuera de
`sponsorhub`.

**Pasos manuales en el dashboard de Supabase:**
1. Settings → API → Exposed schemas: agregar `sponsorhub`.
2. SQL Editor: correr `supabase/migrations/0008_grant_schema_sponsorhub.sql`
   (`GRANT USAGE` a `anon` / `authenticated` / `service_role`). Sin esto el
   cron de sync falla con `permission denied for schema sponsorhub`.

Se confirmó antes de esta decisión que el otro producto no usa Supabase
Auth (sin colisión en `auth.users`) y que el proyecto tiene margen de
sobra en su cuota de 500MB.

## ⚠️ Deuda técnica activa: cuenta

El acceso a este proyecto Supabase depende de una persona específica del
equipo (owner/admin del proyecto), no de una cuenta de infraestructura
compartida de ColombiaTech con múltiples administradores. Si se decide
más adelante mover esto a un proyecto propio y dedicado (por ejemplo, si
se libera presupuesto para un proyecto Supabase nuevo, o el producto que
ya vive en `public` se da de baja), la migración es: exportar el schema
`sponsorhub` completo y las filas de `auth.users` vinculadas a
`sponsor_usuarios`, y restaurarlas en el proyecto nuevo.

## Setup local

\`\`\`bash
# 1. Instalar dependencias
pnpm install

# 2. En el proyecto Supabase compartido: ir a Settings > API >
#    Exposed schemas y agregar "sponsorhub"

# 3. Copiar credenciales del proyecto a .env.local
cp .env.example .env.local

# 4. Aplicar la migración — pegar el contenido completo de
#    supabase/migrations/0001_init.sql en el SQL Editor del dashboard
#    de Supabase y correrlo (crea el schema, las tablas y las RLS
#    policies; no toca nada del schema `public`)

# 5. Levantar en local
pnpm dev
\`\`\`

## Integración con Notion

Fase actual: **solo GovTech Summit 2026**. El CS Board / compromisos de
CTW/CTF no se sincronizan.

Necesitas una integración de Notion (https://www.notion.so/my-integrations)
con acceso a la database de sponsors de GovTech. Completa en `.env.local`
(y en Vercel) `NOTION_API_KEY`, `CRON_SECRET` y `NOTION_GOVTECH_DATA_SOURCE_ID`.
Luego marca el evento en Postgres:

```sql
UPDATE sponsorhub.eventos
SET estado = 'activo',
    notion_source_id = '<NOTION_GOVTECH_DATA_SOURCE_ID>'
WHERE slug = 'govtech-2026';
```

El cron (`GET /api/sync/notion` con `Authorization: Bearer $CRON_SECRET`)
upserta sponsors; los compromisos salen del catálogo GovTech vía trigger.
El status de cada beneficio se gestiona en admin/portal, no se pisa desde Notion.

## Estructura

\`\`\`
apps/web/           Next.js — la app
supabase/            Migraciones SQL (fuente de verdad del esquema, schema sponsorhub)
docs/                Decisiones de arquitectura y mapeo de datos
\`\`\`

## Trabajo con Codex + Claude Code

Ver `docs/HARNESS.md` — define qué zonas del código le corresponden a
cada agente para evitar conflictos y estilos mezclados.

## Alcance actual (fase 1)

- ✅ Evento: GovTech Summit 2026 (sync de sponsors + catálogo local;
  ver `docs/NOTION_MAPPING.md`)
- ❌ Evento: CTW/CTF 2026 — fuera de esta fase (no se sincroniza)
- ❌ SSO corporativo — backlog según el documento de CS
- ❌ Notificaciones automáticas — CS decide manualmente qué notificar
- ❌ Sync en tiempo real — es periódico (cron diario en Hobby), ver
  `docs/ARCHITECTURE.md`
