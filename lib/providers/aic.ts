import type { ArchiveProvider } from "../types";
import { item, iiif, material, plain } from "../normalize";
import { classifyRights } from "../rights";
import { providerText } from "../query";
import { json, params } from "./http";
const base = "https://api.artic.edu/api/v1/artworks";
const fields =
  "id,title,description,date_display,date_start,date_end,artist_display,artwork_type_title,medium_display,dimensions,department_title,subject_titles,term_titles,image_id,is_public_domain,copyright_notice,thumbnail";
export const aic: ArchiveProvider = {
  id: "aic",
  normalizeItem(r) {
    const image = (w: number | "max") =>
      r.image_id ? iiif("https://www.artic.edu/iiif/2", r.image_id, w) : "";
    return item("aic", r, {
      providerItemId: String(r.id),
      title: r.title,
      description: plain(r.description),
      creator: r.artist_display,
      dateDisplay: r.date_display,
      yearStart: r.date_start ?? undefined,
      yearEnd: r.date_end ?? undefined,
      objectType: material(`${r.title || ""} ${r.artwork_type_title || ""}`),
      medium: r.medium_display,
      physicalDimensions: r.dimensions,
      collection: r.department_title,
      subjects: r.subject_titles || [],
      tags: r.term_titles || [],
      thumbnailUrl: image(400),
      previewUrl: image(843),
      fullImageUrl: image("max"),
      width: r.thumbnail?.width,
      height: r.thumbnail?.height,
      sourceUrl: `https://www.artic.edu/artworks/${r.id}`,
      ...classifyRights(
        r.copyright_notice || (r.is_public_domain ? "Public domain" : ""),
        "https://www.artic.edu/image-licensing",
        r.is_public_domain ? "public-domain" : undefined,
        "Art Institute API: is_public_domain and copyright_notice. Image rights are separate from metadata licensing.",
      ),
      downloadOptions: r.image_id
        ? [
            { label: "Web · 843px derivative", url: image(843) },
            { label: "Largest IIIF image", url: image("max") },
          ]
        : [],
    });
  },
  async search(q, signal) {
    const r = await json(
      `${base}/search?${params({ q: providerText(q), page: q.page, limit: 24, fields, params: JSON.stringify({ q: providerText(q), page: q.page, limit: 24, fields, query: { bool: { must: [{ multi_match: { query: providerText(q), fields: ["title^3", "artist_display", "description", "subject_titles", "term_titles"], operator: "and" } }], filter: [{ exists: { field: "image_id" } }, ...(q.yearStart !== undefined ? [{ range: { date_end: { gte: q.yearStart } } }] : []), ...(q.yearEnd !== undefined ? [{ range: { date_start: { lte: q.yearEnd } } }] : [])] } } }) })}`,
      signal,
    );
    return {
      provider: "aic",
      items: r.data.map(aic.normalizeItem).filter((r: any) => r.thumbnailUrl),
      total: r.pagination.total,
      hasMore: q.page < r.pagination.total_pages,
      status: "ok",
    };
  },
  async getItem(id, signal) {
    return aic.normalizeItem(
      (await json(`${base}/${encodeURIComponent(id)}?fields=${fields}`, signal))
        .data,
    );
  },
};
