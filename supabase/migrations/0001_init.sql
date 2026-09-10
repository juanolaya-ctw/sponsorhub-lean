-- ============================================================
-- SponsorHub Lean — migración inicial (Supabase, schema propio)
--
-- Este proyecto Supabase es COMPARTIDO con otro producto de
-- ColombiaTech que ya vive en el schema `public`. Todo lo de
-- SponsorHub vive en su propio schema `sponsorhub` para no
-- interferir con esas tablas ni sus nombres.
--
-- PASO MANUAL REQUERIDO, fuera de este SQL: en el dashboard de
-- Supabase, ir a Settings > API > Exposed schemas y agregar
-- `sponsorhub` a la lista (por defecto solo `public` está expuesto
-- a los clientes vía la API REST / cliente JS). Sin esto, el cliente
-- de la app no puede leer ni escribir estas tablas aunque existan.
--
-- Decisiones de diseño (no cambiar sin actualizar docs/ARCHITECTURE.md):
--   - Multi-evento desde el día 1 (eventos como entidad de primer nivel)
--   - Notion es fuente, NO dicta el esquema (allowlist de campos, no espejo 1:1)
--   - Escritura: Notion gana en compromisos/fechas/estado; el sponsor
--     solo escribe evidencia y sus propios insumos (ver docs/NOTION_MAPPING.md)
--   - Sync periódico (1-5 min vía Vercel Cron), no tiempo real
--   - RLS aísla por sponsor individual vía auth.uid() (Supabase Auth) —
--     esto es lo que Neon NO podía dar sin trabajo adicional; es la
--     razón principal de haber vuelto a Supabase con schema propio.
-- ============================================================

create schema if not exists sponsorhub;

create extension if not exists "pgcrypto";

-- ============================================================
-- CORE
-- ============================================================

create type sponsorhub.evento_estado as enum ('planificacion', 'activo', 'cerrado');

create table sponsorhub.eventos (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,              -- 'ctw-2026', 'ctf-2026', 'govtech-2026'
  nombre text not null,
  fecha_inicio date,
  fecha_fin date,
  estado sponsorhub.evento_estado not null default 'planificacion',
  notion_source_id text,                  -- data_source_id del CS Board de Notion para ese evento
  created_at timestamptz not null default now()
);

create table sponsorhub.sponsors (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references sponsorhub.eventos(id) on delete cascade,
  notion_page_id text not null,
  nombre text not null,
  paquete text,
  contacto_nombre text,
  contacto_email text,
  contacto_telefono text,
  contacto_cargo text,
  logo_url text,
  updated_from_notion_at timestamptz,
  created_at timestamptz not null default now(),
  unique (evento_id, notion_page_id)
);

-- ============================================================
-- AUTH: vincula auth.users (Supabase Auth del proyecto compartido)
-- a un sponsor. auth.users es global al proyecto, pero ya se
-- confirmó que el otro producto no usa Supabase Auth — sin colisión.
-- ============================================================

create table sponsorhub.sponsor_usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  sponsor_id uuid not null references sponsorhub.sponsors(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ============================================================
-- FUNCIÓN 3 del doc CS: compromisos y % de avance
-- Normalizado — NO es espejo del multi-select "Actividad" de Notion.
-- Ver lib/notion/mappers/compromiso.mapper.ts para la traducción.
-- ============================================================

create type sponsorhub.compromiso_estado as enum ('pendiente', 'en_progreso', 'completado');

create table sponsorhub.compromisos (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references sponsorhub.sponsors(id) on delete cascade,
  tipo text not null,
  estado sponsorhub.compromiso_estado not null default 'pendiente',
  porcentaje integer not null default 0 check (porcentaje between 0 and 100),
  fecha_limite date,
  notion_source_field text,
  updated_from_notion_at timestamptz,
  created_at timestamptz not null default now()
);

-- ============================================================
-- FUNCIÓN 1 del doc CS: carga/descarga de contenido
-- ============================================================

create type sponsorhub.archivo_direccion as enum ('sponsor_sube', 'ctw_entrega');
create type sponsorhub.sync_estado as enum ('local', 'sincronizado', 'pendiente_sync', 'error');

create table sponsorhub.archivos (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references sponsorhub.sponsors(id) on delete cascade,
  direccion sponsorhub.archivo_direccion not null,
  tipo text not null,
  nombre_archivo text not null,
  storage_path text not null,          -- path dentro del bucket de Supabase Storage
  sync_estado sponsorhub.sync_estado not null default 'local',
  notion_block_id text,
  subido_por uuid references sponsorhub.sponsor_usuarios(id),
  created_at timestamptz not null default now()
);

-- ============================================================
-- FUNCIÓN 2 del doc CS: inscripción de personas para accesos
-- ============================================================

create type sponsorhub.tipo_acceso as enum ('vip', 'general', 'preferencial', 'escarapela', 'arl_montaje');

create table sponsorhub.accesos_personas (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references sponsorhub.sponsors(id) on delete cascade,
  tipo sponsorhub.tipo_acceso not null,
  nombre text not null,
  apellido text,
  email text,
  telefono text,
  cargo text,
  arl_archivo_id uuid references sponsorhub.archivos(id),
  sync_estado sponsorhub.sync_estado not null default 'local',
  created_at timestamptz not null default now()
);

-- ============================================================
-- FUNCIÓN 5 del doc CS: evidencia de cumplimiento
-- ============================================================

create table sponsorhub.evidencias (
  id uuid primary key default gen_random_uuid(),
  compromiso_id uuid not null references sponsorhub.compromisos(id) on delete cascade,
  archivo_id uuid references sponsorhub.archivos(id) on delete set null,
  descripcion text,
  visible_para_sponsor boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================
-- FUNCIÓN 4 del doc CS: check-ins semanales (curados manualmente por CS)
-- ============================================================

create table sponsorhub.notificaciones (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references sponsorhub.sponsors(id) on delete cascade,
  asunto text not null,
  cuerpo text not null,
  enviado_por text not null,
  enviado_at timestamptz,
  created_at timestamptz not null default now()
);

-- ============================================================
-- SYNC: cola de escritura hacia Notion (no bloquea la request del usuario)
-- ============================================================

create type sponsorhub.sync_direccion as enum ('notion_a_app', 'app_a_notion');
create type sponsorhub.sync_job_estado as enum ('pendiente', 'procesando', 'completado', 'error');

create table sponsorhub.sync_queue (
  id uuid primary key default gen_random_uuid(),
  direccion sponsorhub.sync_direccion not null,
  entidad text not null,
  entidad_id uuid not null,
  payload jsonb not null,
  estado sponsorhub.sync_job_estado not null default 'pendiente',
  intento_count integer not null default 0,
  error_mensaje text,
  created_at timestamptz not null default now(),
  procesado_at timestamptz
);

-- ============================================================
-- ÍNDICES
-- ============================================================

create index idx_sponsors_evento on sponsorhub.sponsors(evento_id);
create index idx_compromisos_sponsor on sponsorhub.compromisos(sponsor_id);
create index idx_archivos_sponsor on sponsorhub.archivos(sponsor_id);
create index idx_accesos_sponsor on sponsorhub.accesos_personas(sponsor_id);
create index idx_evidencias_compromiso on sponsorhub.evidencias(compromiso_id);
create index idx_notificaciones_sponsor on sponsorhub.notificaciones(sponsor_id);
create index idx_sync_queue_pendiente on sponsorhub.sync_queue(estado) where estado = 'pendiente';

-- ============================================================
-- ROW LEVEL SECURITY — aislamiento real por sponsor vía auth.uid()
-- Esta es la ventaja concreta de estar en Supabase y no en Neon:
-- un sponsor no puede ver los datos de otro aunque el código de la
-- app tenga un bug, porque la base de datos misma lo impide.
-- ============================================================

alter table sponsorhub.sponsors enable row level security;
alter table sponsorhub.compromisos enable row level security;
alter table sponsorhub.archivos enable row level security;
alter table sponsorhub.accesos_personas enable row level security;
alter table sponsorhub.evidencias enable row level security;
alter table sponsorhub.notificaciones enable row level security;
alter table sponsorhub.sponsor_usuarios enable row level security;

create or replace function sponsorhub.auth_sponsor_id()
returns uuid
language sql
security definer
stable
as $$
  select sponsor_id from sponsorhub.sponsor_usuarios where id = auth.uid()
$$;

create policy "sponsor lee su propio registro"
  on sponsorhub.sponsors for select
  using (id = sponsorhub.auth_sponsor_id());

create policy "sponsor lee sus compromisos"
  on sponsorhub.compromisos for select
  using (sponsor_id = sponsorhub.auth_sponsor_id());

create policy "sponsor lee y sube sus archivos"
  on sponsorhub.archivos for select
  using (sponsor_id = sponsorhub.auth_sponsor_id());

create policy "sponsor inserta sus propios archivos"
  on sponsorhub.archivos for insert
  with check (sponsor_id = sponsorhub.auth_sponsor_id() and direccion = 'sponsor_sube');

create policy "sponsor lee y gestiona sus accesos"
  on sponsorhub.accesos_personas for select
  using (sponsor_id = sponsorhub.auth_sponsor_id());

create policy "sponsor inserta sus propios accesos"
  on sponsorhub.accesos_personas for insert
  with check (sponsor_id = sponsorhub.auth_sponsor_id());

create policy "sponsor lee evidencia visible de sus compromisos"
  on sponsorhub.evidencias for select
  using (
    visible_para_sponsor = true
    and compromiso_id in (
      select id from sponsorhub.compromisos where sponsor_id = sponsorhub.auth_sponsor_id()
    )
  );

create policy "sponsor lee sus notificaciones"
  on sponsorhub.notificaciones for select
  using (sponsor_id = sponsorhub.auth_sponsor_id());

create policy "usuario lee su propio vínculo"
  on sponsorhub.sponsor_usuarios for select
  using (id = auth.uid());

-- NOTA: las operaciones de CS y del cron de sync usan la service_role
-- key de Supabase, que bypassa RLS por diseño. Estas policies solo
-- gobiernan el acceso del sponsor autenticado.
