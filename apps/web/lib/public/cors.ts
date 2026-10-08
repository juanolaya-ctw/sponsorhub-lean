import { NextResponse } from "next/server";

/** Allowed Origin for Lovable / landing. Default * for previews. */
export function publicCorsOrigin(): string {
  return process.env.PUBLIC_ARTICULOS_CORS_ORIGIN?.trim() || "*";
}

export function withPublicCors(res: NextResponse): NextResponse {
  const origin = publicCorsOrigin();
  res.headers.set("Access-Control-Allow-Origin", origin);
  res.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type");
  res.headers.set("Access-Control-Max-Age", "86400");
  return res;
}

export function publicCorsPreflight(): NextResponse {
  return withPublicCors(new NextResponse(null, { status: 204 }));
}

export function publicJson(
  body: unknown,
  init?: { status?: number },
): NextResponse {
  return withPublicCors(
    NextResponse.json(body, { status: init?.status ?? 200 }),
  );
}
