import { NextRequest, NextResponse } from "next/server";
import { providers } from "@/lib/providers";
import type { ProviderId } from "@/lib/types";
import { allowsHistoricalVideo } from "@/lib/video-policy";
export async function GET(r: NextRequest) {
  const p = r.nextUrl.searchParams;
  const id = p.get("provider") as ProviderId;
  const itemId = p.get("id");
  if (!Object.hasOwn(providers, id) || !itemId || itemId.length > 500)
    return NextResponse.json({ error: "Invalid record" }, { status: 400 });
  try {
    const item = await providers[id].getItem(
      itemId,
      AbortSignal.any([r.signal, AbortSignal.timeout(12000)]),
    );
    if (!allowsHistoricalVideo(item))
      return NextResponse.json(
        { error: "Only videos dated 1980 or earlier are available." },
        { status: 404 },
      );
    return NextResponse.json(item);
  } catch {
    return NextResponse.json(
      { error: "Record details unavailable; visit the original source." },
      { status: 502 },
    );
  }
}
