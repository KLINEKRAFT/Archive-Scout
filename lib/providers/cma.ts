import type { ArchiveProvider } from "../types";
import { item, material, num, list } from "../normalize";
import { classifyRights } from "../rights";
import { providerText } from "../query";
import { json, params } from "./http";
const base = "https://openaccess-api.clevelandart.org/api/artworks/";
export const cma: ArchiveProvider = {
  id: "cma",
  normalizeItem(r) {
    const im = r.images || {};
    const full = im.full || im.print || im.web;
    return item("cma", r, {
      providerItemId: String(r.id),
      title: r.title,
      description: r.description,
      creator: r.creators?.map((c: any) => c.description).join("; "),
      dateDisplay: r.creation_date,
      yearStart: r.creation_date_earliest ?? undefined,
      yearEnd: r.creation_date_latest ?? undefined,
      objectType: material(r.type || ""),
      medium: r.technique,
      physicalDimensions: r.measurements,
      collection: r.collection,
      subjects: list(r.culture),
      thumbnailUrl: im.web?.url,
      previewUrl: im.print?.url || im.web?.url,
      fullImageUrl: full?.url,
      width: num(full?.width),
      height: num(full?.height),
      sourceUrl: r.url,
      addedAt: r.date_added_to_oa,
      ...classifyRights(
        r.share_license_status || r.copyright || "",
        r.share_license_status === "CC0"
          ? "https://creativecommons.org/publicdomain/zero/1.0/"
          : "",
        r.share_license_status === "CC0" ? "cc0" : undefined,
        "Cleveland API: share_license_status; only explicit CC0 is classified as open.",
      ),
      downloadOptions: Object.entries(im)
        .filter(([, v]: any) => v?.url)
        .map(([k, v]: any) => ({
          label:
            k === "full"
              ? "Original file"
              : k === "print"
                ? "Print image"
                : "Web image",
          url: v.url,
          width: num(v.width),
          height: num(v.height),
          bytes: num(v.filesize),
        })),
    });
  },
  async search(q, signal) {
    const r = await json(
      `${base}?${params({ q: providerText(q), has_image: 1, created_after: q.yearStart !== undefined ? q.yearStart - 1 : undefined, created_before: q.yearEnd !== undefined ? q.yearEnd + 1 : undefined, limit: 24, skip: (q.page - 1) * 24 })}`,
      signal,
    );
    return {
      provider: "cma",
      items: r.data.map(cma.normalizeItem).filter((r: any) => r.thumbnailUrl),
      total: r.info.total,
      hasMore: q.page * 24 < r.info.total,
      status: "ok",
    };
  },
  async getItem(id, signal) {
    return cma.normalizeItem(
      (await json(`${base}${encodeURIComponent(id)}`, signal)).data,
    );
  },
};
