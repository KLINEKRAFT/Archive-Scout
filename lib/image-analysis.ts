import sharp from "sharp";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { TTLCache } from "./cache";
import { extractPalette } from "./color";
import type { Color } from "./types";
const VERSION = 1;
const cache = new TTLCache<Color[]>(1500, 86400000);
const pending = new Map<string, Promise<Color[]>>();
let active = 0;
const hosts = [
  "pub-075ff01374c04555b51c9bc50f258b42.r2.dev",
  "framemark.vam.ac.uk",
  "gallica.bnf.fr",
  "api.europeana.eu",
  "d28dhd8eubcyz4.cloudfront.net",
  "digitalcollections.tulsalibrary.org",
  "digitalprairie.ok.gov",
  "cdm16063.contentdm.oclc.org",
  "cdm16807.contentdm.oclc.org",
  "images-assets.nasa.gov",
  "archive.org",
  "www.artic.edu",
  "openaccess-cdn.clevelandart.org",
  "images.metmuseum.org",
  "upload.wikimedia.org",
  "thumb.wikimedia.org",
  "tile.loc.gov",
  "www.loc.gov",
  "loc.gov",
  "cdn.loc.gov",
  "ids.si.edu",
  "nmaahc.si.edu",
];
export function allowedImageUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !u.port &&
      hosts.includes(u.hostname)
    );
  } catch {
    return false;
  }
}
export async function fetchImage(url: string): Promise<Buffer> {
  for (let redirects = 0; redirects < 4; redirects++) {
    if (!allowedImageUrl(url))
      throw new Error(
        "This archive image host is not supported for palette analysis",
      );
    const r = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(10000),
      headers: {
        "User-Agent": process.env.ARCHIVE_USER_AGENT || "ArchiveScout/0.1",
      },
    });
    if (r.status >= 300 && r.status < 400 && r.headers.get("location")) {
      url = new URL(r.headers.get("location")!, url).href;
      continue;
    }
    if (!r.ok || !r.headers.get("content-type")?.startsWith("image/"))
      throw new Error("Image unavailable");
    if (Number(r.headers.get("content-length")) > 8_000_000)
      throw new Error("Preview too large");
    const reader = r.body!.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 8_000_000) {
        await reader.cancel();
        throw new Error("Preview too large");
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks);
  }
  throw new Error("Too many redirects");
}
export const ColorAnalysisService = {
  version: VERSION,
  async analyzeImage(url: string): Promise<Color[]> {
    if (!allowedImageUrl(url)) throw new Error("Unsupported image host");
    const key = createHash("sha256").update(`${VERSION}:${url}`).digest("hex");
    const hit = cache.get(key);
    if (hit) return hit;
    if (pending.has(key)) return pending.get(key)!;
    if (active >= 6) throw new Error("Palette queue busy; retry shortly");
    const run = (async () => {
      active++;
      const path = join(process.cwd(), ".cache", "palettes", key + ".json");
      try {
        try {
          const saved = JSON.parse(await readFile(path, "utf8"));
          if (Array.isArray(saved)) return cache.set(key, saved);
        } catch {}
        const buffer = await fetchImage(url);
        const { data, info } = await sharp(buffer, {
          limitInputPixels: 40_000_000,
        })
          .rotate()
          .resize(80, 80, { fit: "inside", withoutEnlargement: true })
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });
        const colors = extractPalette(data, info.width, info.height);
        cache.set(key, colors);
        try {
          await mkdir(join(process.cwd(), ".cache", "palettes"), {
            recursive: true,
          });
          await writeFile(path, JSON.stringify(colors));
        } catch {
          /* Read-only hosting still uses the bounded memory cache. */
        }
        return colors;
      } finally {
        active--;
        pending.delete(key);
      }
    })();
    pending.set(key, run);
    return run;
  },
};
