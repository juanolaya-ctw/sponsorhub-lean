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

**Paso manual obligatorio, fuera de cualquier migración SQL:** en el
dashboard de Supabase, ir a Settings → API → Exposed schemas y agregar
`sponsorhub` a la lista. Por defecto Supabase solo expone `public` a la
API REST / cliente JS — sin este paso, la app no puede leer ni escribir
nada aunque las tablas existan y la migración haya corrido bien.

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

Necesitas una integración de Notion (https://www.notion.so/my-integrations)
con acceso al `Customer Success Board` y a `Estado Compromisos Sponsors`.
El token va en `NOTION_API_KEY`.

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

- ✅ Evento: CTW/CTF 2026 (tiene datos reales en Notion)
- ⏳ Evento: GovTech Summit 2026 (arquitectura lista, sin adaptador de
  sync — no hay data de compromisos todavía, ver `docs/NOTION_MAPPING.md`)
- ❌ SSO corporativo — backlog según el documento de CS
- ❌ Notificaciones automáticas — CS decide manualmente qué notificar
- ❌ Sync en tiempo real — es periódico (1-5 min), ver `docs/ARCHITECTURE.md`
