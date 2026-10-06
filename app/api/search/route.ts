import { NextRequest, NextResponse } from "next/server";
import { providers } from "@/lib/providers";
import { parseQuery } from "@/lib/query";
import { TTLCache } from "@/lib/cache";
import type { ProviderId, ProviderResult } from "@/lib/types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const cache = new TTLCache<ProviderResult>(200, 300_000);
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const id = p.get("provider") as ProviderId;
  if (!Object.hasOwn(providers, id))
    return NextResponse.json({ error: "Unknown archive" }, { status: 400 });
  const q = parseQuery(p);
  if (q.mediaType === "video" && !["nasa", "internetarchive"].includes(id))
    return NextResponse.json({
      provider: id,
      items: [],
      total: 0,
      hasMore: false,
      status: "ok",
    } satisfies ProviderResult);
  const key = JSON.stringify([
    id,
    q.textQuery,
    q.yearStart,
    q.yearEnd,
    q.page,
    q.mediaType,
  ]);
  const hit = cache.get(key);
  if (hit) return NextResponse.json(hit);
  try {
    const signal = AbortSignal.any([
      request.signal,
      AbortSignal.timeout(18000),
    ]);
    const result = await providers[id].search(q, signal);
    if (result.status === "ok") cache.set(key, result);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({
      provider: id,
      items: [],
      total: 0,
      hasMore: false,
      status: "unavailable",
      message: "Temporarily unavailable. Try this archive again shortly.",
    } satisfies ProviderResult);
  }
}
