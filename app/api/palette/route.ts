import { NextRequest, NextResponse } from "next/server";
import { ColorAnalysisService } from "@/lib/image-analysis";
export const runtime = "nodejs";
export async function GET(r: NextRequest) {
  const url = r.nextUrl.searchParams.get("url");
  if (!url || url.length > 2048)
    return NextResponse.json({ error: "Invalid image" }, { status: 400 });
  try {
    return NextResponse.json(
      {
        colors: await ColorAnalysisService.analyzeImage(url),
        version: ColorAnalysisService.version,
      },
      { headers: { "Cache-Control": "public, max-age=86400" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Palette unavailable for this image" },
      { status: 422 },
    );
  }
}
