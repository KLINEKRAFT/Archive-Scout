import type { ArchiveProvider } from "../types";
import { item, material, list } from "../normalize";
import { classifyRights } from "../rights";
import { providerText } from "../query";
import { json, params } from "./http";
const base = "https://collectionapi.metmuseum.org/public/collection";
export const met: ArchiveProvider = {
  id: "met",
  normalizeItem(r) {
    return item("met", r, {
      providerItemId: String(r.objectID),
      title: r.title,
      creator: r.artistDisplayName,
      dateDisplay: r.objectDate,
      yearStart: r.objectBeginDate,
      yearEnd: r.objectEndDate,
      objectType: material(r.objectName || r.classification || ""),
      medium: r.medium,
      physicalDimensions: r.dimensions,
      collection: r.department,
      subjects: list(r.tags),
      tags: [r.culture, r.period].filter(Boolean),
      thumbnailUrl: r.primaryImageSmall,
      previewUrl: r.primaryImage,
      fullImageUrl: r.primaryImage,
      sourceUrl: r.objectURL,
      ...classifyRights(
        r.rightsAndReproduction || (r.isPublicDomain ? "Public domain" : ""),
        "https://www.metmuseum.org/about-the-met/policies-and-documents/open-access",
        r.isPublicDomain ? "public-domain" : undefined,
        "Met API: isPublicDomain. No assumption is made from the age of the object.",
      ),
      downloadOptions: r.primaryImage
        ? [{ label: "Archive image", url: r.primaryImage }]
        : [],
    });
  },
  async search(q, signal) {
    const r = await json(
      `${base}/v1.1/search?${params({ q: providerText(q), hasImages: "true", offset: (q.page - 1) * 12, limit: 12, dateBegin: q.yearStart, dateEnd: q.yearEnd })}`,
      signal,
    );
    const ids = r.objectIDs || [];
    const items = [];
    let failures = 0;
    for (let i = 0; i < ids.length; i += 4) {
      const part = await Promise.allSettled(
        ids
          .slice(i, i + 4)
          .map((id: number) => met.getItem(String(id), signal)),
      );
      for (const p of part)
        if (p.status === "fulfilled" && p.value.thumbnailUrl)
          items.push(p.value);
        else if (p.status === "rejected") failures++;
    }
    if (ids.length && failures === ids.length)
      throw new Error("Met records unavailable");
    return {
      provider: "met",
      items,
      total: r.total,
      hasMore: q.page * 12 < Math.min(r.total, 10000),
      status: "ok",
      message: failures ? `${failures} records could not be loaded` : undefined,
    };
  },
  async getItem(id, signal) {
    return met.normalizeItem(
      await json(`${base}/v1/objects/${encodeURIComponent(id)}`, signal),
    );
  },
};
