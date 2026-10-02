import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ billingCycleId: string }> },
) {
  const { billingCycleId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse("No autorizado", { status: 401 });
  }

  const admin = createAdminClient();

  const { data: cycle, error: cycleError } = await admin
    .from("media_billing_cycles")
    .select("id, sponsor_id, plan_id, periodo, creditos_asignados, creditos_rollover")
    .eq("id", billingCycleId)
    .maybeSingle();

  if (cycleError || !cycle) {
    return new NextResponse("Ciclo no encontrado", { status: 404 });
  }

  const { data: profile } = await supabase
    .from("sponsor_usuarios")
    .select("rol, sponsor_id")
    .eq("id", user.id)
    .maybeSingle();

  const isAdmin = profile?.rol === "admin_ct";
  const isSponsorOwner =
    profile?.rol === "sponsor" &&
    (profile.sponsor_id as string) === (cycle.sponsor_id as string);

  if (!isAdmin && !isSponsorOwner) {
    return new NextResponse("No autorizado", { status: 403 });
  }

  // Fetch sponsor name, plan name, assets, and catalog names — no FK joins
  const [sponsorResult, planResult, assetsResult] = await Promise.all([
    admin
      .from("sponsors")
      .select("nombre")
      .eq("id", cycle.sponsor_id as string)
      .maybeSingle(),
    admin
      .from("media_planes")
      .select("nombre")
      .eq("id", cycle.plan_id as string)
      .maybeSingle(),
    admin
      .from("media_assets_ejecutados")
      .select("id, asset_id, costo_creditos, estado, evidencias_url, entregado_at, metricas")
      .eq("billing_cycle_id", billingCycleId)
      .order("created_at"),
  ]);

  const assetsData = assetsResult.data ?? [];

  // Fetch catalog names for the assets found
  const assetIds = assetsData.map((a) => a.asset_id as string);
  const catalogResult =
    assetIds.length > 0
      ? await admin
          .from("media_assets_catalogo")
          .select("id, nombre")
          .in("id", assetIds)
      : { data: [] as { id: unknown; nombre: unknown }[], error: null };

  const catalogMap = new Map(
    (catalogResult.data ?? []).map((a) => [a.id as string, a.nombre as string]),
  );

  const usados = assetsData.reduce(
    (s, a) => s + (a.costo_creditos as number),
    0,
  );
  const asignados = cycle.creditos_asignados as number;
  const rollover = cycle.creditos_rollover as number;
  const disponibles = asignados + rollover - usados;
  const sponsorNombre = (sponsorResult.data?.nombre as string | null) ?? "Sponsor";
  const planNombre = (planResult.data?.nombre as string | null) ?? "—";
  const periodo = new Date(
    `${cycle.periodo as string}T00:00:00`,
  ).toLocaleDateString("es-CO", { month: "long", year: "numeric" });

  const ESTADO_LABELS: Record<string, string> = {
    pendiente_insumos: "Pendiente insumos",
    insumos_recibidos: "Insumos recibidos",
    en_ejecucion: "En ejecución",
    entregado: "Entregado",
    aprobado: "Aprobado",
  };

  const assetsRows = assetsData
    .map((a) => {
      const nombre = catalogMap.get(a.asset_id as string) ?? "—";
      const estadoKey = (a.estado as string) ?? "";
      const estado = ESTADO_LABELS[estadoKey] ?? estadoKey;
      const entregado = a.entregado_at
        ? new Date(a.entregado_at as string).toLocaleDateString("es-CO", {
            dateStyle: "medium",
          })
        : "—";
      const evidenciasRaw = a.evidencias_url as string | null;
      const evidencias = evidenciasRaw
        ? `<a href="${evidenciasRaw}" style="color:#3B82F6">${evidenciasRaw}</a>`
        : "—";
      const metricasRaw = a.metricas;
      const metricas = metricasRaw
        ? `<pre style="font-size:11px;margin:0">${JSON.stringify(metricasRaw, null, 2)}</pre>`
        : "—";
      return `
        <tr>
          <td>${nombre}</td>
          <td style="text-align:center">${a.costo_creditos as number}</td>
          <td>${estado}</td>
          <td>${entregado}</td>
          <td>${evidencias}</td>
          <td>${metricas}</td>
        </tr>`;
    })
    .join("");

  const assetsSection =
    assetsData.length === 0
      ? '<p style="font-size:13px;color:#888">Sin assets activados en este ciclo.</p>'
      : `<table>
    <thead><tr><th>Asset</th><th>Costo (cr.)</th><th>Estado</th><th>Entregado</th><th>Evidencias</th><th>Métricas</th></tr></thead>
    <tbody>${assetsRows}</tbody>
  </table>`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Reporte Media – ${sponsorNombre}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; color: #111; padding: 32px; max-width: 900px; margin: auto; }
    header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #111; padding-bottom: 16px; margin-bottom: 24px; }
    h1 { font-size: 20px; font-weight: 700; }
    h2 { font-size: 14px; font-weight: 600; color: #555; margin-top: 24px; margin-bottom: 8px; }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
    .stat { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; }
    .stat-value { font-size: 24px; font-weight: 700; }
    .stat-label { font-size: 11px; color: #666; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; font-size: 11px; color: #555; text-transform: uppercase; letter-spacing: .05em; padding: 8px; border-bottom: 1px solid #e5e7eb; }
    td { padding: 10px 8px; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
    footer { margin-top: 40px; border-top: 1px solid #e5e7eb; padding-top: 12px; font-size: 11px; color: #888; display: flex; justify-content: space-between; }
    @media print { body { padding: 0; } footer { position: fixed; bottom: 0; width: 100%; } }
  </style>
</head>
<body>
  <header>
    <div>
      <p style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.05em">Colombia Tech · CT Media</p>
      <h1>${sponsorNombre}</h1>
      <p style="font-size:13px;color:#555;margin-top:4px;text-transform:capitalize">${periodo} · ${planNombre}</p>
    </div>
    <div style="text-align:right;font-size:12px;color:#888">
      <p>sponsors.colombiatech.co</p>
    </div>
  </header>

  <h2>Resumen de créditos</h2>
  <div class="summary">
    <div class="stat"><div class="stat-value">${asignados}</div><div class="stat-label">Asignados</div></div>
    <div class="stat"><div class="stat-value">${rollover}</div><div class="stat-label">Rollover</div></div>
    <div class="stat"><div class="stat-value">${usados}</div><div class="stat-label">Usados</div></div>
    <div class="stat"><div class="stat-value">${disponibles}</div><div class="stat-label">Disponibles</div></div>
  </div>

  <h2>Assets del ciclo</h2>
  ${assetsSection}

  <footer>
    <span>Generado por Colombia Tech · sponsors.colombiatech.co</span>
    <span>${new Date().toLocaleDateString("es-CO", { dateStyle: "long" })}</span>
  </footer>

  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
