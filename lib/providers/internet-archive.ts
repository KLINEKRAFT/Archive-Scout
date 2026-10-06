import { archiveCollection } from "../collections";
import type { ArchiveProvider } from "../types";
import { item, list, plain, years, num, material } from "../normalize";
import { classifyRights } from "../rights";
import { providerText } from "../query";
import { json, params } from "./http";
import { mapRecords } from "./batch";
import {
  allowsHistoricalVideo,
  videoYears,
  VIDEO_YEAR_LIMIT,
} from "../video-policy";
const base = "https://archive.org";
const identifier = (id: string) => {
  if (!/^[\w.-]+$/.test(id)) throw new Error("Invalid archive identifier");
  return id;
};
export const internetArchive: ArchiveProvider = {
  id: "internetarchive",
  normalizeItem(r) {
    const d = r.metadata || r;
    const id = identifier(d.identifier);
    const video = d.mediatype === "movies";
    const print = d.mediatype === "texts";
    const date = video ? d.proddate || d.date || d.year : d.date || d.year;
    const files = (r.files || []).filter((f: any) => !f.private);
    const fileUrl = (name: string) =>
      `${base}/download/${id}/${name.split("/").map(encodeURIComponent).join("/")}`;
    const movies = files
      .filter((f: any) => /\.(mp4|webm)$/i.test(f.name))
      .sort(
        (a: any, b: any) =>
          (num(a.size) || Infinity) - (num(b.size) || Infinity),
      );
    const images = files.filter(
      (f: any) =>
        /\.(jpe?g|png)$/i.test(f.name) &&
        !/(__ia_thumb|_thumb|itemimage)/i.test(f.name),
    );
    const license = list(d.licenseurl)[0]?.replace(/^http:/, "https:") || "";
    return item("internetarchive", r, {
      providerItemId: id,
      title: plain(d.title),
      description: list(d.description).join(" "),
      creator: list(d.creator).join("; "),
      dateDisplay: plain(date) || "Date unknown",
      ...(video ? videoYears(date) : years(date)),
      mediaType: video ? "video" : "image",
      objectType: video
        ? "Film / Video"
        : print
          ? material(`${list(d.subject).join(" ")} ${plain(d.title)}`) ===
            "Other"
            ? "Book"
            : material(`${list(d.subject).join(" ")} ${plain(d.title)}`)
          : "Photography",
      subjects: list(d.subject),
      collection: list(d.collection)
        .filter((c) => !c.startsWith("fav-"))
        .join("; "),
      thumbnailUrl: `${base}/services/img/${id}`,
      previewUrl:
        video || print
          ? `${base}/services/img/${id}`
          : images[0]
            ? fileUrl(images[0].name)
            : "",
      videoUrl: video && movies[0] ? fileUrl(movies[0].name) : undefined,
      duration: plain(d.runtime) || undefined,
      sourceUrl: `${base}/details/${id}`,
      ...classifyRights(
        list(d.rights).join(" "),
        license,
        undefined,
        "Internet Archive item rights and license metadata, as supplied by its contributor; not independently verified.",
      ),
      downloadOptions: (video
        ? movies
        : print
          ? files.filter((f: any) => /\.(pdf|epub)$/i.test(f.name))
          : images
      )
        .slice(0, 8)
        .map((f: any) => ({
          label: plain(f.format || f.name),
          url: fileUrl(f.name),
          bytes: num(f.size),
          width: num(f.width),
          height: num(f.height),
        })),
    });
  },
  async search(q, signal) {
    const text = (q.collection && !q.textQuery ? "" : providerText(q))
      .replace(/[+\-!(){}\[\]^"~*?:\\/|&]/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((t) => `"${t}"`)
      .join(" AND ");
    const movieMedia = `mediatype:movies AND year:[${q.yearStart ?? 1800} TO ${Math.min(q.yearEnd ?? VIDEO_YEAR_LIMIT, VIDEO_YEAR_LIMIT)}]`;
    const imageMedia = `mediatype:image${q.yearStart !== undefined || q.yearEnd !== undefined ? ` AND year:[${q.yearStart ?? 1000} TO ${q.yearEnd ?? new Date().getFullYear()}]` : ""}`;
    if (q.mediaType === "video" && (q.yearStart ?? 0) > VIDEO_YEAR_LIMIT)
      return {
        provider: "internetarchive",
        items: [],
        total: 0,
        hasMore: false,
        status: "ok",
      };
    const printMedia = `mediatype:texts AND year:[${Math.max(q.yearStart ?? 1800, 1800)} TO ${Math.min(q.yearEnd ?? 1980, 1980)}]`;
    const stillMedia =
      (q.yearStart ?? 0) > 1980
        ? imageMedia
        : `(${imageMedia}) OR (${printMedia})`;
    const media =
      q.mediaType === "video"
        ? movieMedia
        : q.mediaType === "image" || (q.yearStart ?? 0) > VIDEO_YEAR_LIMIT
          ? stillMedia
          : `(${stillMedia}) OR (${movieMedia})`;
    const scope = archiveCollection(q.collection)?.iaFilter;
    const query = `${scope ? `(${scope}) AND ` : ""}${text ? `(${text}) AND ` : ""}(${media}) AND -access-restricted-item:true`;
    const r = await json(
      `${base}/advancedsearch.php?${params({ q: query, output: "json", rows: 12, page: q.page, "fl[]": "identifier" })}`,
      signal,
    );
    const records = await mapRecords(r.response?.docs || [], async (d: any) =>
      json(`${base}/metadata/${identifier(d.identifier)}`, signal),
    );
    return {
      provider: "internetarchive",
      items: records
        .filter(
          (r) =>
            r.metadata?.["access-restricted-item"] !== true &&
            r.metadata?.["access-restricted-item"] !== "true",
        )
        .map(internetArchive.normalizeItem)
        .filter(allowsHistoricalVideo)
        .filter(
          (i) =>
            (i.originalMetadata.metadata as any)?.mediatype !== "texts" ||
            (i.yearStart !== undefined &&
              i.yearStart >= 1800 &&
              (i.yearEnd ?? i.yearStart) <= 1980 &&
              i.downloadOptions.length > 0),
        )
        .filter((i) =>
          i.mediaType === "video" ? !!i.videoUrl : !!i.previewUrl,
        ),
      total: r.response?.numFound || 0,
      hasMore: q.page * 12 < (r.response?.numFound || 0),
      status: "ok",
    };
  },
  async getItem(id, signal) {
    return internetArchive.normalizeItem(
      await json(`${base}/metadata/${identifier(id)}`, signal),
    );
  },
};
