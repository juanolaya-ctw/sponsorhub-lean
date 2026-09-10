# Harness: Codex + Claude Code

Ambos corren desde Cursor (terminal integrado o extensión), sobre el mismo
working directory. No se coordinan entre sí automáticamente — la
coordinación la impone esta división de zonas + el orden de trabajo abajo.

## Por qué dividir por zona y no por archivo

Si ambos agentes pueden tocar cualquier archivo, vas a tener:
- Conflictos de merge reales cuando ambos editan el mismo archivo en
  sesiones paralelas.
- Dos estilos de código peleando (Codex y Claude Code no comparten
  memoria de las convenciones que el otro decidió).

La división es por **tipo de decisión**, no por carpeta: Claude Code se
queda con todo lo que requiere entender el porqué de una decisión ya
tomada en este chat (seguridad, modelado de datos, traducción de
Notion). Codex se queda con lo que es repetitivo una vez que el contrato
ya está fijo.

## División de responsabilidad

| Zona | Quién | Por qué |
|---|---|---|
| `supabase/migrations/*.sql` | **Claude Code** | Requiere las decisiones de modelado ya discutidas (enums, RLS, constraints) |
| `lib/notion/allowlist.ts` | **Claude Code** | Es la barrera de seguridad — un error aquí filtra datos de pago al sponsor |
| `lib/notion/mappers/*` | **Claude Code** | Lógica de negocio (traducción de 13 valores de Actividad), no CRUD |
| RLS policies | **Claude Code** | Barrera de seguridad, no delegable |
| `app/api/*/route.ts` (CRUD simple: archivos, accesos) | **Codex** | Patrón repetitivo sobre un contrato ya definido |
| `app/(dashboard)/*` (páginas y componentes UI) | **Codex** | Scaffolding sobre design system ya definido |
| Tests | **Codex** implementa, **Claude Code** define casos | Claude Code decide qué importa probar (ej. "sponsor A no ve datos de sponsor B") |

## Orden de trabajo recomendado

1. **Claude Code primero**: aplica la migración (`supabase/migrations/0001_init.sql`),
   corre `supabase gen types typescript` para generar los tipos de
   TypeScript desde el schema real. Esto es "el contrato".
2. **Claude Code**: completa `lib/notion/mappers/*` que falten (compromiso
   ya existe; falta `sponsor.mapper.ts` y `acceso.mapper.ts` si se
   necesita lógica más allá del filtrado directo del allowlist).
3. **Codex después, con el contrato ya fijo**: implementa los route
   handlers de `app/api/archivos/upload` y `app/api/accesos` contra los
   tipos generados en el paso 1. Instrucción a darle: "usa los tipos de
   `types/database.ts`, no inventes campos nuevos, sigue el patrón de
   `app/api/sync/notion/route.ts` para el manejo de errores."
4. **Codex**: construye las páginas de `app/(dashboard)/*` consumiendo
   esos endpoints.
5. **Claude Code al final**: revisa el diff completo antes de mergear a
   `main` — específicamente que ningún endpoint de Codex haya importado
   `lib/supabase/admin.ts` (el cliente que bypassa RLS) en una ruta que
   responde al sponsor autenticado. Ese es el error más caro que puede
   colarse desde generación rápida.

## Regla dura

Si vas a correr Codex y Claude Code en paralelo (no en el orden de
arriba), usa git worktrees separados por tarea, no la misma rama al
mismo tiempo — evita que uno sobrescriba el trabajo del otro sin que
te des cuenta hasta el commit.
