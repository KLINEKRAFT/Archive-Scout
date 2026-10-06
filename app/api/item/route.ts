import { NextRequest, NextResponse } from "next/server";
import { providers } from "@/lib/providers";
import type { ProviderId } from "@/lib/types";
export async function GET(r: NextRequest) {
  const p = r.nextUrl.searchParams;
  const id = p.get("provider") as ProviderId;
  const itemId = p.get("id");
  if (!Object.hasOwn(providers, id) || !itemId || itemId.length > 500)
    return NextResponse.json({ error: "Invalid record" }, { status: 400 });
  try {
    return NextResponse.json(
      await providers[id].getItem(
        itemId,
        AbortSignal.any([r.signal, AbortSignal.timeout(12000)]),
      ),
    );
  } catch {
    return NextResponse.json(
      { error: "Record details unavailable; visit the original source." },
      { status: 502 },
    );
  }
}
