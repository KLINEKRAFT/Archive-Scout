import { NextRequest } from "next/server";
import { fetchImage } from "@/lib/image-analysis";
import { TTLCache } from "@/lib/cache";
// Browser fallback for archives which reject cross-origin embedding. Only allowlisted
// preview hosts are accepted; redirects and response bytes are bounded. No re-encoding.
const cache = new TTLCache<Buffer>(40, 600_000);
let active = 0;
export async function GET(r: NextRequest) {
  const url = r.nextUrl.searchParams.get("url");
  if (!url || url.length > 2048) return new Response(null, { status: 400 });
  const hit = cache.get(url);
  if (hit) return respond(hit);
  if (active >= 8) return new Response(null, { status: 429 });
  active++;
  try {
    const buffer = await fetchImage(url);
    cache.set(url, buffer);
    return respond(buffer);
  } catch {
    return new Response(null, { status: 502 });
  } finally {
    active--;
  }
}
function respond(buffer: Buffer) {
  const type =
    buffer[0] === 0xff && buffer[1] === 0xd8
      ? "image/jpeg"
      : buffer[0] === 0x89
        ? "image/png"
        : buffer.subarray(0, 3).toString() === "GIF"
          ? "image/gif"
          : buffer.subarray(0, 4).toString() === "RIFF"
            ? "image/webp"
            : undefined;
  if (!type) return new Response(null, { status: 415 });
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": type,
      "Cache-Control": "public, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
