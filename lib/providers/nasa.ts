import type { ArchiveProvider } from "../types";
import { item, list, years } from "../normalize";
import { classifyRights } from "../rights";
import { providerText } from "../query";
import { json, params } from "./http";
import { mapRecords } from "./batch";
const base = "https://images-api.nasa.gov";
function assetUrl(value: string) {
  const url = new URL(value);
  if (url.hostname !== "images-assets.nasa.gov") return "";
  url.protocol = "https:";
  return url.href;
}
async function enrich(r: any, signal: AbortSignal, includeImages = false) {
  if (r.data?.[0]?.media_type !== "video" && !includeImages) return r;
  const assets = await json(
    `${base}/asset/${encodeURIComponent(r.data[0].nasa_id)}`,
    signal,
  );
  return { ...r, assets: assets.collection?.items || [] };
}
export const nasa: ArchiveProvider = {
  id: "nasa",
  normalizeItem(r) {
    const d = r.data?.[0] || {};
    const previews = (r.links || []).filter((l: any) => l.render === "image");
    const thumb = previews.find((l: any) => l.rel === "preview") || previews[0];
    const large = previews.find((l: any) => l.href.includes("~large")) || thumb;
    const video = d.media_type === "video";
    const allAssets: string[] = (r.assets || [])
      .map((a: any) => assetUrl(a.href))
      .filter(Boolean);
    const originals = allAssets.filter((url) =>
      /\.(jpe?g|png|tiff?)$/i.test(url),
    );
    const files = (r.assets || [])
      .map((a: any) => assetUrl(a.href))
      .filter((u: string) => /\.mp4$/i.test(u));
    const stream =
      files.find((u: string) => /~(medium|small)\.mp4$/i.test(u)) || files[0];
    return item("nasa", r, {
      providerItemId: d.nasa_id,
      title: d.title,
      description: d.description,
      creator: d.photographer || d.secondary_creator || d.center,
      institution: `NASA${d.center ? ` / ${d.center}` : ""}`,
      subjects: list(d.keywords),
      dateDisplay: d.date_created?.slice(0, 10),
      ...years(d.date_created),
      mediaType: video ? "video" : "image",
      objectType: video ? "Film / Video" : "Photography",
      thumbnailUrl: thumb?.href,
      previewUrl: large?.href,
      videoUrl: stream,
      fullImageUrl: originals.find((url) => /~orig\./i.test(url)),
      width: large?.width,
      height: large?.height,
      sourceUrl: `https://images.nasa.gov/details/${encodeURIComponent(d.nasa_id)}`,
      ...classifyRights(
        "NASA media usage guidelines apply. Check the item credit for third-party material and restrictions on logos, endorsements, and identifiable people.",
        "https://www.nasa.gov/nasa-brand-center/images-and-media/",
        undefined,
        "NASA library record; no blanket public-domain classification.",
      ),
      downloadOptions: video
        ? files.map((url: string) => ({
            label: `MP4 · ${url.match(/~([^~/.]+)\.mp4$/)?.[1] || "archive file"}`,
            url,
          }))
        : originals.length
          ? originals.map((url) => ({
              label: `NASA image · ${url.match(/~([^~/.]+)\./)?.[1] || "archive file"}`,
              url,
            }))
          : previews.map((p: any) => ({
              label: "NASA image",
              url: p.href,
              width: p.width,
              height: p.height,
            })),
    });
  },
  async search(q, signal) {
    const response = await json(
      `${base}/search?${params({ q: providerText(q), media_type: q.mediaType === "all" ? "image,video" : q.mediaType, year_start: q.yearStart, year_end: q.yearEnd, page: q.page, page_size: 12 })}`,
      signal,
    );
    const records = await mapRecords(
      response.collection?.items || [],
      (r: any) => enrich(r, signal),
    );
    return {
      provider: "nasa",
      items: records
        .map(nasa.normalizeItem)
        .filter(
          (i) => i.thumbnailUrl && (i.mediaType !== "video" || i.videoUrl),
        ),
      total: response.collection?.metadata?.total_hits || 0,
      hasMore: !!response.collection?.links?.some((l: any) => l.rel === "next"),
      status: "ok",
    };
  },
  async getItem(id, signal) {
    const r = await json(`${base}/search?${params({ nasa_id: id })}`, signal);
    if (!r.collection?.items?.[0]) throw new Error("NASA record unavailable");
    return nasa.normalizeItem(
      await enrich(r.collection.items[0], signal, true),
    );
  },
};
