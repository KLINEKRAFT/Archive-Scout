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
      ...years(r.date),
      objectType: material(
        list(r.genre || r.original_format || r.type).join(" "),
      ),
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
      downloadOptions: files.length
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
    const r = await json(
      `https://www.loc.gov/photos/?${params({ q: providerText(q), fo: "json", c: 24, sp: q.page, dates: q.yearStart !== undefined || q.yearEnd !== undefined ? `${q.yearStart ?? 1000}/${q.yearEnd ?? new Date().getFullYear()}` : undefined })}`,
      signal,
    );
    return {
      provider: "loc",
      items: (r.results || [])
        .map(loc.normalizeItem)
        .filter((r: any) => r.thumbnailUrl),
      total: r.pagination?.total || 0,
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
