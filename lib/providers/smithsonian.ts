import type { ArchiveProvider } from "../types";
import { item, material, list, years } from "../normalize";
import { classifyRights } from "../rights";
import { providerText } from "../query";
import { json, params } from "./http";
const base = "https://api.si.edu/openaccess/api/v1.0";
export const smithsonian: ArchiveProvider = {
  id: "smithsonian",
  normalizeItem(r) {
    const c = r.content || {};
    const f = c.freetext || {};
    const d = c.descriptiveNonRepeating || {};
    const media =
      d.online_media?.media?.find((m: any) => m.type === "Images") || {};
    const rights = media.usage?.access || "";
    const date = list(f.date).join("; ");
    return item("smithsonian", r, {
      providerItemId: r.id,
      title: r.title || d.title?.content,
      description: list(f.notes).join(" "),
      creator: list(f.name).join("; "),
      dateDisplay: date || "Date unknown",
      ...years(date),
      objectType: material(list(f.objectType).join(" ")),
      medium: list(f.physicalDescription).join("; "),
      subjects: list(f.topic),
      institution: d.data_source || "Smithsonian",
      collection: d.unit_code,
      thumbnailUrl: media.thumbnail,
      previewUrl: media.content || media.thumbnail,
      fullImageUrl: media.content,
      sourceUrl: d.record_link || `https://www.si.edu/object/${r.id}`,
      ...classifyRights(
        rights,
        rights === "CC0"
          ? "https://creativecommons.org/publicdomain/zero/1.0/"
          : "",
        rights === "CC0" ? "cc0" : undefined,
        "Smithsonian media.usage.access on the selected image, not the metadata record.",
      ),
      downloadOptions: media.content
        ? [{ label: "Archive image", url: media.content }]
        : [],
    });
  },
  async search(q, signal) {
    if (!process.env.SMITHSONIAN_API_KEY)
      return {
        provider: "smithsonian",
        items: [],
        total: 0,
        hasMore: false,
        status: "needs-key",
        message: "Requires a Smithsonian API key",
      };
    const r = await json(
      `${base}/search?${params({ q: providerText(q), start: (q.page - 1) * 24, rows: 24, api_key: process.env.SMITHSONIAN_API_KEY })}`,
      signal,
    );
    return {
      provider: "smithsonian",
      items: (r.response?.rows || [])
        .map(smithsonian.normalizeItem)
        .filter((i: any) => i.thumbnailUrl),
      total: r.response?.rowCount || 0,
      hasMore: q.page * 24 < (r.response?.rowCount || 0),
      status: "ok",
    };
  },
  async getItem(id, signal) {
    if (!process.env.SMITHSONIAN_API_KEY)
      throw new Error("Smithsonian key not configured");
    const r = await json(
      `${base}/content/${encodeURIComponent(id)}?${params({ api_key: process.env.SMITHSONIAN_API_KEY })}`,
      signal,
    );
    return smithsonian.normalizeItem(r.response);
  },
};
