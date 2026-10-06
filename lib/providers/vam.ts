import type { ArchiveProvider } from "../types";
import { item, material, plain } from "../normalize";
import { classifyRights } from "../rights";
import { providerText } from "../query";
import { json, params } from "./http";
import { mapRecords } from "./batch";
const base = "https://api.vam.ac.uk/v2";
export const vam: ArchiveProvider = {
  id: "vam",
  normalizeItem(raw) {
    const r = raw.record || raw;
    const meta = raw.meta || {};
    const asset = r.images?.[0] || r._primaryImageId;
    const image = /^[\w-]+$/.test(asset || "")
      ? `https://framemark.vam.ac.uk/collections/${asset}`
      : "";
    const dates = (r.productionDates || [])
      .flatMap((d: any) => [d.date?.earliest, d.date?.latest])
      .map((d: string) => Number(d?.slice(0, 4)))
      .filter((n: number) => Number.isFinite(n) && n > 0);
    const title =
      r.titles?.[0]?.title ||
      r._primaryTitle ||
      r.briefDescription ||
      r.objectType ||
      "Untitled";
    return item("vam", raw, {
      providerItemId: r.systemNumber,
      title,
      description:
        r.summaryDescription || r.physicalDescription || r.briefDescription,
      creator:
        (r.artistMakerPerson || [])
          .concat(r.artistMakerOrganisations || [])
          .map((p: any) => p.name?.text)
          .filter(Boolean)
          .join("; ") || r._primaryMaker?.name,
      dateDisplay:
        (r.productionDates || [])
          .map((d: any) => d.date?.text)
          .filter(Boolean)
          .join("; ") || r._primaryDate,
      yearStart: dates.length ? Math.min(...dates) : undefined,
      yearEnd: dates.length ? Math.max(...dates) : undefined,
      objectType: material(`${r.objectType} ${title}`),
      medium: plain(r.materialsAndTechniques),
      subjects: (r.categories || []).map((c: any) => c.text).filter(Boolean),
      thumbnailUrl: image && `${image}/full/!400,400/0/default.jpg`,
      previewUrl: image && `${image}/full/!800,800/0/default.jpg`,
      sourceUrl: `https://collections.vam.ac.uk/item/${r.systemNumber}/`,
      ...classifyRights(
        meta.images?._images_meta?.[0]?.copyright || "Check V&A image terms",
        "https://www.vam.ac.uk/info/va-websites-terms-conditions",
        undefined,
        "V&A image copyright; collection metadata does not grant image reuse permission.",
      ),
    });
  },
  async search(q, signal) {
    const r = await json(
      `${base}/objects/search?${params({ q: providerText(q), images_exist: 1, page_size: 24, page: q.page, year_made_from: q.yearStart, year_made_to: q.yearEnd })}`,
      signal,
    );
    const items = await mapRecords(r.records || [], async (r: any) =>
      vam.getItem(r.systemNumber, signal),
    );
    return {
      provider: "vam",
      items: items.filter((i) => i.thumbnailUrl),
      total: r.info?.record_count || 0,
      hasMore: q.page * 24 < (r.info?.record_count || 0),
      status: "ok",
    };
  },
  async getItem(id, signal) {
    if (!/^O\d+$/.test(id)) throw new Error("Invalid V&A identifier");
    return vam.normalizeItem(await json(`${base}/museumobject/${id}`, signal));
  },
};
