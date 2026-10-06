import type { ArchiveProvider } from "../types";
import { item, material, list, years } from "../normalize";
import { classifyRights } from "../rights";
import { providerText } from "../query";
import { json, params } from "./http";
const base = "https://api.dp.la/v2/items";
export const dpla: ArchiveProvider = {
  id: "dpla",
  normalizeItem(r) {
    const s = r.sourceResource || {};
    return item("dpla", r, {
      providerItemId: r.id,
      title: list(s.title).join("; "),
      description: list(s.description).join(" "),
      creator: list(s.creator).join("; "),
      dateDisplay:
        typeof s.date === "string"
          ? s.date
          : s.date?.displayDate || "Date unknown",
      ...years(typeof s.date === "string" ? s.date : s.date?.begin),
      objectType: material(list(s.type).join(" ")),
      subjects: list(s.subject),
      institution:
        list(r.dataProvider).join("; ") || "DPLA contributing institution",
      collection: list(s.collection).join("; "),
      thumbnailUrl: r.object,
      previewUrl: r.object,
      sourceUrl: r.isShownAt || `https://dp.la/item/${r.id}`,
      ...classifyRights(
        list(s.rights).join(" "),
        s.rights?.startsWith?.("http") ? s.rights : "",
        undefined,
        "DPLA sourceResource.rights. Contributor rights apply; aggregation does not imply public domain.",
      ),
      downloadOptions: [],
    });
  },
  async search(q, signal) {
    if (!process.env.DPLA_API_KEY)
      return {
        provider: "dpla",
        items: [],
        total: 0,
        hasMore: false,
        status: "needs-key",
        message: "Requires a DPLA API key",
      };
    const r = await json(
      `${base}?${params({ q: providerText(q), page: q.page, page_size: 24, api_key: process.env.DPLA_API_KEY })}`,
      signal,
    );
    return {
      provider: "dpla",
      items: (r.docs || [])
        .map(dpla.normalizeItem)
        .filter((i: any) => i.thumbnailUrl),
      total: r.count,
      hasMore: q.page * 24 < r.count,
      status: "ok",
    };
  },
  async getItem(id, signal) {
    if (!process.env.DPLA_API_KEY) throw new Error("DPLA key not configured");
    const r = await json(
      `${base}/${encodeURIComponent(id)}?${params({ api_key: process.env.DPLA_API_KEY })}`,
      signal,
    );
    return dpla.normalizeItem(r.docs[0]);
  },
};
