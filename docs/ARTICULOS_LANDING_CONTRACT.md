# Contrato: artículos publicados → News (Lovable GovTech)

Fuente de verdad: **SponsorHub lean** (`sponsorhub.articulos`).  
Landing Lovable **no** se conecta directo a Supabase: consume la **API pública**.

## Seguridad

| Enfoque | Estado |
|---------|--------|
| Anon key + `sponsor_articles` en Lovable | **No** (proyecto Supabase compartido + bucket privado) |
| `GET/POST` en SponsorHub `/api/public/*` | **Sí** — allowlist + signed URLs al vuelo |

Sitio oficial del evento (landing Lovable): **https://latamgovtech.com/**

Env Lovable (solo esto):

```
VITE_NEWS_API_BASE=https://<tu-dominio-sponsorhub>
VITE_NEWS_EVENTO=govtech-2026
VITE_SITE_URL=https://latamgovtech.com
```

No uses `VITE_SUPABASE_*` de este proyecto en Lovable para News.

Si alguna key de Supabase se pegó en un chat o prompt antiguo, **rótala** en el dashboard.

## Endpoints

Base: `{VITE_NEWS_API_BASE}/api/public`

### Listar publicados

```
GET /api/public/articulos?evento=govtech-2026
```

Respuesta:

```json
{
  "articles": [
    {
      "id": "uuid",
      "slug": "dataknow",
      "companyName": "DataKnow",
      "logoUrl": "https://…",
      "tier": "Gold Partner",
      "categoria": "SaaS & Software",
      "datoImpactante": "…",
      "articuloTexto": "…",
      "imagenUrl": "https://…signed-1080x1350…",
      "publishedAt": "2026-04-01T15:00:00.000Z",
      "eventoSlug": "govtech-2026"
    }
  ]
}
```

### Detalle

```
GET /api/public/articulos/{slug}?evento=govtech-2026
```

- 200: `{ "article": { …mismo shape… } }`
- 404: draft, inexistente o evento desconocido

### Newsletter

```
POST /api/public/newsletter
Content-Type: application/json

{ "email": "persona@empresa.com", "evento": "govtech-2026" }
```

| Resultado | HTTP | Body |
|-----------|------|------|
| OK | 200 | `{ ok: true, message: "…" }` |
| Email inválido | 400 | `{ code: "invalid_email", error: "…" }` |
| Ya suscrito | 409 | `{ code: "already_subscribed", message: "…" }` |

Tabla: `sponsorhub.newsletter_subscribers` (unique por `evento_id` + `email`).  
Escritura solo con service role desde esta API.

### CORS

Header `Access-Control-Allow-Origin` desde `PUBLIC_ARTICULOS_CORS_ORIGIN` (default `*`).  
En prod, fijar el origen de la landing:

```
PUBLIC_ARTICULOS_CORS_ORIGIN=https://latamgovtech.com
```

### Imágenes

- `imagenUrl` se regenera desde `imagen_path` (bucket privado) en cada request.
- `logoUrl`: URL http(s), path Storage firmado, o asset estático absolutizado (`NEXT_PUBLIC_APP_URL` + `/logos-sponsors-blanco/…`).

## Migraciones requeridas

1. `0017_articulos.sql` — tabla artículos + HITL  
2. `0018_newsletter_subscribers.sql` — newsletter  

Ejecutar ambas en el SQL Editor de Supabase si aún no están.

---

## Prompt para Lovable (News — GovTech)

Copia y adapta. **No** hardcodees paleta CTF (amarillo `#FEDD5A` / naranja `#FF9D39`). Usa la identidad visual **ya cargada** en el proyecto Lovable GovTech (tokens, tipografías, logos del evento).

```
Build a public News hub for GovTech Summit 2026 sponsor articles.

OFFICIAL SITE (canonical):
- https://latamgovtech.com/
- News lives as a tab/section of this landing (same Lovable project / domain).
- Canonical links, logo “home”, footer “Inicio”, and share URLs must use
  https://latamgovtech.com (and paths under it, e.g. https://latamgovtech.com/news).
- Do NOT point nav/footer to Colombia Tech Fest or Tech Week festival URLs
  unless already present as partner links elsewhere on the site.

IMPORTANT DATA RULES:
- Do NOT connect to Supabase for articles.
- Use HTTP fetch against the SponsorHub public API.
- Env:
    VITE_NEWS_API_BASE = <SponsorHub origin, no trailing slash>
    VITE_NEWS_EVENTO = govtech-2026
    VITE_SITE_URL = https://latamgovtech.com
- Endpoints:
    GET  ${VITE_NEWS_API_BASE}/api/public/articulos?evento=${VITE_NEWS_EVENTO}
         → { articles: PublicArticle[] }
    GET  ${VITE_NEWS_API_BASE}/api/public/articulos/${slug}?evento=${VITE_NEWS_EVENTO}
         → { article: PublicArticle }
    POST ${VITE_NEWS_API_BASE}/api/public/newsletter
         body JSON { email, evento: VITE_NEWS_EVENTO }

PublicArticle fields (camelCase):
  id, slug, companyName, logoUrl, tier, categoria, datoImpactante,
  articuloTexto, imagenUrl, publishedAt, eventoSlug

Use categoria (not tier) for badges and filter chips.
If categoria is null/empty, show no badge.
Badge style: use existing GovTech design tokens (one consistent style for all categories).

--- VISUAL IDENTITY ---
Keep the existing GovTech / Lovable design system already on
https://latamgovtech.com (colors, fonts, logos, nav) — see brand kit at
https://latamgovtech.com/recursos if you need assets.
Do NOT import Colombia Tech Fest yellow/orange tokens from old CTF prompts.
Reuse the site header/footer; News is part of latamgovtech.com.

--- ROUTING ---
- News hub: /news  (or the existing News tab route on latamgovtech.com)
- Article detail: /news/:slug  (absolute: https://latamgovtech.com/news/:slug)
- Stay consistent with the site router.

--- HUB PAGE ---
1. Hero: title + short subtitle about ecosystem news (copy in Spanish).
2. Filter chips: "Todos" + unique categoria values from articles (client-side filter).
3. Grid of cards (responsive 3/2/1 cols):
   - imagenUrl as 4:5 cover (placeholder if missing)
   - categoria badge
   - companyName
   - datoImpactante (2-line clamp)
   - publishedAt via Intl.DateTimeFormat('es-CO', { day:'numeric', month:'short', year:'numeric' })
   - click → detail route
4. Optional “Top stories” row: first N articles, horizontal scroll on mobile.
5. Empty: “Próximamente” + short subtitle.

--- DETAIL PAGE ---
Fetch by slug. 404 state with back link.
1. Back to hub
2. Accent/header: categoria badge + datoImpactante as H1
3. Meta row: logoUrl (h-8 contain) · companyName · date · categoria
4. imagenUrl centered (max-width ~480px) if present
5. articuloTexto as paragraphs split on \n\n (body font from design system)
6. “Más del ecosistema”: up to 3 other published articles (exclude current slug)
7. document.title = `${companyName} | GovTech Summit` (hub: `News | GovTech Summit`)
8. Open Graph / canonical URL: ${VITE_SITE_URL}/news/${slug}

--- NEWSLETTER ---
Form email + submit:
- validate email regex
- POST newsletter endpoint
- loading: “Enviando…”
- success: hide form, show success message from API
- 409 already_subscribed: show grey message
- other errors: red retry message
Legal line under form (Términos) — link to existing legal page on
https://latamgovtech.com if any.

--- TENDENCIAS / CATEGORÍAS (optional sections on hub) ---
Two columns using the same articles list (limit 5 each):
- Featured image + list of datoImpactante + companyName + date
- Thumbnail + title + meta
Reuse design system spacing; no CTF zigzag SVG unless already in brand.

--- SPONSORS MARQUEE (optional) ---
Static scrolling names or logos if already in the Lovable project assets
(or from https://latamgovtech.com sponsors section).
Do not invent a second CMS.

--- FOOTER / NAV ---
- Logo / “Inicio” → https://latamgovtech.com/
- Contact if needed: govtechsummit@colombiatechweek.co (from site)
- Social links: reuse those already on latamgovtech.com

--- TECHNICAL ---
- try/catch on all fetches; loading skeletons matching layout
- Public read only; no auth
- Mobile-first
- img alt={companyName || 'Sponsor article'}
- No localStorage for articles
```

## Flujo operativo CS

1. Admin HITL: `/admin/govtech-2026/articulos` → editar → **Publicar**  
2. Lovable News llama `GET .../articulos?evento=govtech-2026`  
3. El artículo aparece en el hub (solo `status=published`)

## Follow-ups (fuera de este entregable)

- Rate limiting en `/api/public/*`
- UI News implementada dentro de Lovable (este repo solo API + contrato)
- Webhooks al publicar
