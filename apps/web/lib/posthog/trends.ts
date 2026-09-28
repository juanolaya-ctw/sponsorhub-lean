// Analytics de tráfico del portal — API de PostHog (server-side).
//
// NEXT_PUBLIC_POSTHOG_HOST es el host de INGESTA (ej. https://us.i.posthog.com),
// distinto del host de la app/API (https://us.posthog.com), que es el que
// expone /api/projects/:id/... y el dashboard. postHogAppHost() deriva el
// segundo a partir del primero.
//
// Consultar la API de Insights requiere una Personal API Key (no confundir
// con NEXT_PUBLIC_POSTHOG_KEY, que solo sirve para capturar eventos desde el
// cliente). Sin POSTHOG_PERSONAL_API_KEY + POSTHOG_PROJECT_ID configuradas,
// getPortalPageviewsLast7Days() devuelve null sin intentar la llamada.

export type PageviewPoint = { date: string; count: number };

export function postHogAppHost(): string {
  const ingestHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  if (!ingestHost) return "https://us.posthog.com";
  return ingestHost.replace(".i.posthog.com", ".posthog.com");
}

export async function getPortalPageviewsLast7Days(): Promise<
  PageviewPoint[] | null
> {
  const apiKey = process.env.POSTHOG_PERSONAL_API_KEY;
  const projectId = process.env.POSTHOG_PROJECT_ID;
  if (!apiKey || !projectId) return null;

  try {
    const response = await fetch(
      `${postHogAppHost()}/api/projects/${projectId}/insights/trend/`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          events: [
            {
              id: "$pageview",
              name: "$pageview",
              type: "events",
              properties: [
                {
                  key: "$pathname",
                  value: "/portal",
                  operator: "icontains",
                  type: "event",
                },
              ],
            },
          ],
          date_from: "-7d",
          interval: "day",
        }),
        cache: "no-store",
      },
    );

    if (!response.ok) return null;

    const json = (await response.json()) as {
      result?: Array<{ days?: string[]; data?: number[] }>;
    };
    const serie = json.result?.[0];
    if (!serie?.days?.length || !serie.data) return null;

    return serie.days.map((date, index) => ({
      date,
      count: Math.round(serie.data?.[index] ?? 0),
    }));
  } catch {
    return null;
  }
}
