import { archiveCollection } from "../collections";
import {
  allowsHistoricalVideo,
  videoYears,
  VIDEO_YEAR_LIMIT,
} from "../video-policy";
import type { ArchiveProvider } from "../types";
import { item, material, list, years, num } from "../normalize";
import { classifyRights } from "../rights";
import { providerText } from "../query";
import { json, params } from "./http";
export const loc: ArchiveProvider = {
  id: "loc",
  normalizeItem(raw) {
    const base = raw.item?.item ? raw.item : raw;
    const r = {
      ...base,
      ...(base.item || {}),
      image_url: base.image_url || base.item?.image_url,
      id:
        typeof base.id === "string" && base.id.startsWith("http")
          ? base.id
          : base.item?.link || base.url || base.item?.id || base.id,
    };
    const images = list(r.image_url).filter(
      (u) => !u.includes("/static/images/"),
    );
    const resources = raw.resources || r.resources || [];
    const video = list(r.original_format || r.type).some((v) =>
      /film|video/i.test(v),
    );
    const movie = resources.find((res: any) =>
      /^https?:.*\.mp4(?:\?|$)/i.test(res.video || ""),
    );
    const videoUrl = movie?.video?.replace(/^http:/, "https:");
    const files = resources
      .flatMap((res: any) => res.files || [])
      .flat()
      .filter((f: any) => f.url && /image\//.test(f.mimetype || ""));
    const best = files.toSorted(
      (a: any, b: any) => (num(b.width) || 0) - (num(a.width) || 0),
    )[0];
    const rights = list(
      r.rights ||
        r.rights_advisory ||
        (r.access_restricted && "Access restricted"),
    ).join(" ");
    const source = r.id || r.url;
    return item("loc", raw, {
      providerItemId: source,
      title: r.title,
      description: list(r.description || r.summary).join(" "),
      creator: list(r.contributors || r.contributor).join("; "),
      contributors: list(r.contributors),
      dateDisplay: r.date || "Date unknown",
      ...(video ? videoYears(r.date) : years(r.date)),
      mediaType: video ? "video" : "image",
      videoUrl,
      duration: movie?.duration
        ? `${Math.floor(movie.duration / 60)}:${String(movie.duration % 60).padStart(2, "0")}`
        : undefined,
      objectType: video
        ? "Film / Video"
        : material(list(r.genre || r.original_format || r.type).join(" ")),
      subjects: list(r.subject),
      collection: list(r.partof).join("; "),
      thumbnailUrl:
        r.service_medium ||
        images.find((u) => /640|400|300|250/.test(u)) ||
        images[0],
      previewUrl: r.service_high || r.service_medium || images.at(-1),
      fullImageUrl: best?.url,
      width: num(best?.width),
      height: num(best?.height),
      sourceUrl: source,
      ...classifyRights(
        rights,
        "",
        undefined,
        "Library of Congress item rights / rights_advisory. “No known restrictions” is not treated as a public-domain declaration.",
      ),
      downloadOptions: video
        ? videoUrl
          ? [{ label: "MP4 archive film", url: videoUrl }]
          : []
        : files.length
          ? files
              .map((f: any) => ({
                label: `Archive file${f.mimetype ? " · " + f.mimetype : ""}`,
                url: f.url,
                width: num(f.width),
                height: num(f.height),
              }))
              .slice(0, 8)
          : [
              r.service_high
                ? { label: "Large archive derivative", url: r.service_high }
                : null,
              r.service_medium
                ? { label: "Web archive derivative", url: r.service_medium }
                : null,
              ...(images.length
                ? [{ label: "Available thumbnail", url: images.at(-1)! }]
                : []),
            ].filter((x): x is { label: string; url: string } => !!x),
    });
  },
  async search(q, signal) {
    if (q.mediaType === "video" && (q.yearStart ?? 0) > VIDEO_YEAR_LIMIT)
      return {
        provider: "loc",
        items: [],
        total: 0,
        hasMore: false,
        status: "ok",
      };
    const collection = archiveCollection(q.collection);
    const path =
      collection?.locPath ||
      (q.mediaType === "video"
        ? "film-and-videos"
        : q.mediaType === "all"
          ? "search"
          : "photos");
    const r = await json(
      `https://www.loc.gov/${path}/?${params({ q: q.collection && !q.textQuery ? undefined : providerText(q), fo: "json", c: 24, sp: q.page, dates: q.yearStart !== undefined || q.yearEnd !== undefined || q.mediaType === "video" ? `${q.yearStart ?? 1800}/${q.mediaType === "video" ? Math.min(q.yearEnd ?? VIDEO_YEAR_LIMIT, VIDEO_YEAR_LIMIT) : (q.yearEnd ?? new Date().getFullYear())}` : undefined })}`,
      signal,
    );
    return {
      provider: "loc",
      items: (r.results || r.content?.results || [])
        .map(loc.normalizeItem)
        .filter(
          (i: any) =>
            i.thumbnailUrl &&
            allowsHistoricalVideo(i) &&
            (i.mediaType !== "video" || i.videoUrl),
        ),
      total: r.pagination?.of || 0,
      hasMore: !!r.pagination?.next,
      status: "ok",
    };
  },
  async getItem(id, signal) {
    const u = new URL(id);
    if (!["www.loc.gov", "loc.gov"].includes(u.hostname))
      throw new Error("Invalid LOC record");
    u.protocol = "https:";
    u.searchParams.set("fo", "json");
    return loc.normalizeItem(await json(u.href, signal));
  },
};
