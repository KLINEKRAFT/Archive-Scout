import type { ArchiveProvider } from "../types";
import { item, material } from "../normalize";
import { classifyRights } from "../rights";
import { providerText } from "../query";
import { allowsHistoricalVideo, VIDEO_YEAR_LIMIT } from "../video-policy";
import { json, params } from "./http";
import { catalogDate, directVideo, mediaUrl, values } from "./aggregate-media";
const base = "https://api.digitalnz.org/v3";
const headers = (): Record<string, string> =>
  process.env.DIGITALNZ_API_KEY?.trim()
    ? { "Authentication-Token": process.env.DIGITALNZ_API_KEY.trim() }
    : {};
const identifier = (id: string) => {
  if (!/^\d+$/.test(id)) throw new Error("Invalid DigitalNZ identifier");
  return id;
};
export const digitalnz: ArchiveProvider = {
  id: "digitalnz",
  normalizeItem(raw) {
    const r = raw.record || raw;
    const id = identifier(String(r.id));
    const video = values(r.category).includes("Videos");
    const date = values(r.display_date).length ? r.display_date : r.date;
    const source =
      mediaUrl(r.source_url) || `https://digitalnz.org/records/${id}`;
    const thumbnail =
      mediaUrl(r.thumbnail_url) || mediaUrl(r.large_thumbnail_url);
    const preview = mediaUrl(r.large_thumbnail_url) || thumbnail;
    const videoUrl = video ? directVideo(r.object_url) : "";
    const original = !video ? mediaUrl(r.object_url) : "";
    const rightsUrl = values(r.rights_url).map(mediaUrl).find(Boolean) || "";
    return item("digitalnz", r, {
      providerItemId: id,
      title: r.title,
      description: values([r.description, r.additional_description]).join(" "),
      creator: values(r.creator).join("; "),
      contributors: values(r.contributor),
      ...catalogDate(date, video),
      mediaType: video ? "video" : "image",
      objectType: video
        ? "Film / Video"
        : material(values([r.dc_type, r.format, r.title]).join(" ")),
      subjects: values(r.subject),
      tags: values(r.tag),
      institution:
        r.display_content_partner ||
        values(r.content_partner).join("; ") ||
        "DigitalNZ contributor",
      collection: r.display_collection || values(r.collection_title).join("; "),
      thumbnailUrl: thumbnail,
      previewUrl: preview,
      fullImageUrl: original || undefined,
      videoUrl: videoUrl || undefined,
      sourceUrl: source,
      ...classifyRights(
        values([r.rights, r.copyright, r.license]).join("; "),
        rightsUrl,
        undefined,
        "DigitalNZ item rights, copyright and rights_url. is_commercial_use describes metadata access, not media reuse.",
      ),
      downloadOptions: videoUrl
        ? [{ label: "Source video", url: videoUrl }]
        : original
          ? [{ label: "Source file", url: original }]
          : [],
    });
  },
  async search(q, signal) {
    if (q.mediaType === "video" && (q.yearStart ?? 0) > VIDEO_YEAR_LIMIT)
      return {
        provider: "digitalnz",
        items: [],
        total: 0,
        hasMore: false,
        status: "ok",
      };
    const query = new URLSearchParams(
      params({ text: providerText(q), per_page: 24, page: q.page }),
    );
    for (const category of q.mediaType === "all"
      ? ["Images", "Videos"]
      : [q.mediaType === "video" ? "Videos" : "Images"])
      query.append("or[category][]", category);
    // DigitalNZ documents year facets, not a range endpoint. Send bounded OR facets.
    const from = q.yearStart;
    const to =
      q.mediaType === "video"
        ? Math.min(q.yearEnd ?? VIDEO_YEAR_LIMIT, VIDEO_YEAR_LIMIT)
        : q.yearEnd;
    if (from !== undefined && to !== undefined && to - from <= 200)
      for (let year = from; year <= to; year++)
        query.append("or[year][]", String(year));
    const r = await json(`${base}/records.json?${query}`, signal, headers());
    if (!r.search || !Array.isArray(r.search.results))
      throw new Error("Invalid DigitalNZ response");
    return {
      provider: "digitalnz",
      items: r.search.results
        .filter((r: any) =>
          values(r.category).some((v) => v === "Images" || v === "Videos"),
        )
        .map(digitalnz.normalizeItem)
        .filter(
          (i: any) =>
            i.thumbnailUrl &&
            allowsHistoricalVideo(i) &&
            (i.mediaType !== "video" || i.videoUrl),
        ),
      total: r.search.result_count || 0,
      hasMore: q.page * 24 < (r.search.result_count || 0),
      status: "ok",
    };
  },
  async getItem(id, signal) {
    const r = await json(
      `${base}/records/${identifier(id)}.json`,
      signal,
      headers(),
    );
    if (!r.record) throw new Error("DigitalNZ record unavailable");
    return digitalnz.normalizeItem(r);
  },
};
