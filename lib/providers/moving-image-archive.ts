import type { ArchiveItem, ArchiveProvider } from "../types";
import { item } from "../normalize";
import { classifyRights } from "../rights";
import { TTLCache } from "../cache";
import {
  allowsHistoricalVideo,
  videoYears,
  VIDEO_YEAR_LIMIT,
} from "../video-policy";
import { json, params } from "./http";
const base = "https://www.movingimagearchive.com";
export const MOVING_IMAGE_HOST = "pub-075ff01374c04555b51c9bc50f258b42.r2.dev";
const details = new TTLCache<ArchiveItem>(1000, 3600000);
function media(value: unknown, extension: RegExp) {
  try {
    const url = new URL(String(value));
    return url.protocol === "https:" &&
      url.hostname === MOVING_IMAGE_HOST &&
      !url.username &&
      !url.password &&
      !url.port &&
      extension.test(url.pathname)
      ? url.href
      : "";
  } catch {
    return "";
  }
}
// Public source pages serialize their visible clip metadata as Next flight strings.
// Parse data only; never execute scripts returned by the archive.
export function sourceClips(html: string): any[] {
  const records: any[] = [];
  for (const match of html.matchAll(
    /self\.__next_f\.push\(\[1,("(?:\\.|[^"\\])*")\]\)/g,
  )) {
    const chunk = JSON.parse(match[1]) as string;
    for (const object of chunk.matchAll(/\{"id":"[^"{}]+"[^{}]*\}/g)) {
      try {
        const r = JSON.parse(object[0]);
        if (r.sourceSlug && r.videoUrl) records.push(r);
      } catch {
        /* unrelated flight data */
      }
    }
  }
  return records;
}
export const movingImageArchive: ArchiveProvider = {
  id: "movingimagearchive",
  normalizeItem(r) {
    const videoUrl = media(r.videoUrl, /\.mp4$/i);
    const thumbnailUrl = media(r.thumbnailUrl, /\.(jpg|jpeg|png|webp)$/i);
    return item("movingimagearchive", r, {
      providerItemId: `${r.sourceSlug}~${r.id}`,
      title: `${r.sourceTitle} · shot ${Number(r.position) + 1}`,
      description: `Film excerpt, ${Number(r.startSeconds).toFixed(1)}–${Number(r.endSeconds).toFixed(1)} seconds into the source film.`,
      dateDisplay: Number.isInteger(r.sourceYear)
        ? String(r.sourceYear)
        : "Date unknown",
      ...videoYears(Number.isInteger(r.sourceYear) ? String(r.sourceYear) : ""),
      mediaType: "video",
      objectType: "Film / Video",
      videoUrl,
      duration: `${Number(r.durationSeconds).toFixed(1)} seconds`,
      thumbnailUrl,
      previewUrl: thumbnailUrl,
      sourceUrl: `${base}/sources/${encodeURIComponent(r.sourceSlug)}?clip=${encodeURIComponent(r.id)}`,
      collection: r.sourceTitle,
      ...classifyRights(
        "The Moving Image Archive describes its library as drawn from public-domain collections and free to reuse. Check the source film’s provenance and rights for this excerpt.",
        `${base}/sources/${encodeURIComponent(r.sourceSlug)}`,
        undefined,
        "Collection-wide statement; item-specific rights not independently verified.",
      ),
      downloadOptions: videoUrl
        ? [{ label: "Download clip · MP4", url: videoUrl }]
        : [],
    });
  },
  async search(q, signal) {
    const empty = {
      provider: "movingimagearchive" as const,
      items: [],
      total: 0,
      hasMore: false,
      status: "ok" as const,
    };
    if (q.mediaType === "image" || (q.yearStart ?? 1800) > VIDEO_YEAR_LIMIT)
      return empty;
    const query = q.textQuery
      .replace(/\b(?:1[89]\d{2}|20[012]\d)s?\b/g, "")
      .replace(/\s+/g, " ")
      .trim();
    // The site's browse endpoint returns 100 clips; semantic search returns 24.
    // Offsets count raw upstream clips, before date/preview filtering.
    const size = query ? 24 : 100;
    const filters = {
      color: "all",
      aspectRatio: "all",
      offset: (q.page - 1) * size,
      yearMin: q.yearStart ?? 1800,
      yearMax: Math.min(q.yearEnd ?? VIDEO_YEAR_LIMIT, VIDEO_YEAR_LIMIT),
    };
    let response;
    if (query) {
      const r = await fetch(`${base}/api/search`, {
        method: "POST",
        signal,
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ query, ...filters }),
      });
      if (!r.ok) throw new Error(`Archive returned HTTP ${r.status}`);
      response = await r.json();
    } else
      response = await json(`${base}/api/clips?${params(filters)}`, signal);
    if (!Array.isArray(response.clips))
      throw new Error("Archive catalog format changed");
    const items = response.clips
      .map(movingImageArchive.normalizeItem)
      .filter(
        (r: ArchiveItem) =>
          allowsHistoricalVideo(r) && r.videoUrl && r.thumbnailUrl,
      );
    for (const r of items) details.set(r.providerItemId, r);
    return {
      ...empty,
      items,
      total: (q.page - 1) * size + response.clips.length,
      hasMore: response.hasMore === true && response.clips.length > 0,
    };
  },
  async getItem(id, signal) {
    const cached = details.get(id);
    if (cached) return cached;
    const [slug, clipId, extra] = id.split("~");
    if (
      extra ||
      !/^[a-z0-9-]+$/.test(slug) ||
      !/^[a-f0-9-]{36}$/.test(clipId || "")
    )
      throw new Error("Invalid clip");
    const response = await fetch(`${base}/sources/${slug}`, {
      signal,
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Source film unavailable");
    const raw = sourceClips(await response.text()).find(
      (r) => r.id === clipId && r.sourceSlug === slug,
    );
    if (!raw) throw new Error("Clip unavailable");
    const result = movingImageArchive.normalizeItem(raw);
    if (
      !allowsHistoricalVideo(result) ||
      !result.videoUrl ||
      !result.thumbnailUrl
    )
      throw new Error("Clip unavailable");
    return details.set(id, result);
  },
};
