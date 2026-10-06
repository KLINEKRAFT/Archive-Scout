import type { ArchiveProvider } from "../types";
import { item, material, plain, years } from "../normalize";
import { classifyRights } from "../rights";
import { providerText } from "../query";
import { json, params } from "./http";
const base = "https://commons.wikimedia.org/w/api.php";
const imageArgs = {
  action: "query",
  format: "json",
  prop: "imageinfo",
  iiprop: "url|size|extmetadata",
  iiurlwidth: 500,
};
export const commons: ArchiveProvider = {
  id: "commons",
  normalizeItem(r) {
    const im = r.imageinfo?.[0] || {};
    const m = im.extmetadata || {};
    const get = (k: string) =>
      plain(m[k]?.value).split(/ (?:label|date) QS:/)[0];
    return item("commons", r, {
      providerItemId: String(r.pageid),
      title: get("ObjectName") || r.title?.replace(/^File:/, ""),
      description: get("ImageDescription"),
      creator: get("Artist"),
      dateDisplay: get("DateTimeOriginal") || "Date unknown",
      ...years(get("DateTimeOriginal")),
      objectType: material(`${get("Categories")} ${r.title}`),
      subjects: get("Categories").split("|").filter(Boolean).slice(0, 15),
      thumbnailUrl: im.thumburl || im.url,
      previewUrl: im.thumburl || im.url,
      fullImageUrl: im.url,
      width: im.width,
      height: im.height,
      sourceUrl:
        im.descriptionurl || `https://commons.wikimedia.org/?curid=${r.pageid}`,
      ...classifyRights(
        get("LicenseShortName"),
        get("LicenseUrl"),
        undefined,
        "Wikimedia file extmetadata: LicenseShortName and LicenseUrl; original author/source remain on the file record.",
      ),
      downloadOptions: im.url
        ? [
            {
              label: "Original file",
              url: im.url,
              width: im.width,
              height: im.height,
              bytes: im.size,
            },
          ]
        : [],
    });
  },
  async search(q, signal) {
    const r = await json(
      `${base}?${params({ ...imageArgs, generator: "search", gsrsearch: q.yearStart !== undefined ? `${providerText(q)} ${q.yearStart}${q.yearEnd === q.yearStart + 9 ? "s" : ""}` : providerText(q), gsrnamespace: 6, gsrlimit: 24, gsroffset: (q.page - 1) * 24 })}`,
      signal,
    );
    if (r.error) throw new Error("Commons search unavailable");
    return {
      provider: "commons",
      items: Object.values(r.query?.pages || {})
        .sort((a: any, b: any) => (a.index || 0) - (b.index || 0))
        .map(commons.normalizeItem)
        .filter((i) => i.thumbnailUrl),
      total: 0,
      hasMore: !!r.continue,
      status: "ok",
    };
  },
  async getItem(id, signal) {
    const r = await json(
      `${base}?${params({ ...imageArgs, pageids: id, iiurlwidth: 1400 })}`,
      signal,
    );
    return commons.normalizeItem(Object.values(r.query?.pages || {})[0]);
  },
};
