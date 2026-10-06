import { XMLParser } from "fast-xml-parser";
import type { ArchiveProvider } from "../types";
import { item, list, material, years } from "../normalize";
import { classifyRights } from "../rights";
import { providerText } from "../query";
const array = (v: any): any[] => (v == null ? [] : Array.isArray(v) ? v : [v]);
export function parseGallica(xml: string) {
  if (xml.length > 4_000_000 || /<!DOCTYPE|<!ENTITY/i.test(xml))
    throw new Error("Unsupported XML");
  const r = new XMLParser({ removeNSPrefix: true, parseTagValue: false }).parse(
    xml,
  ).searchRetrieveResponse;
  if (!r || r.diagnostics) throw new Error("Gallica search failed");
  return {
    total: Number(r.numberOfRecords) || 0,
    records: array(r.records?.record),
  };
}
async function searchRecords(
  query: string,
  start: number,
  signal: AbortSignal,
) {
  const p = new URLSearchParams({
    version: "1.2",
    operation: "searchRetrieve",
    query,
    startRecord: String(start),
    maximumRecords: "24",
  });
  const response = await fetch(`https://gallica.bnf.fr/SRU?${p}`, {
    signal,
    headers: {
      "User-Agent": process.env.ARCHIVE_USER_AGENT || "ArchiveScout/0.1",
      Accept: "application/xml",
    },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Gallica unavailable");
  return parseGallica(await response.text());
}
export const gallica: ArchiveProvider = {
  id: "gallica",
  normalizeItem(raw) {
    const r = raw.recordData?.dc || {};
    const source =
      list(r.identifier).find((s) =>
        /^https?:\/\/gallica.bnf.fr\/ark:\/12148\/[a-z\d]+$/i.test(s),
      ) || "";
    const id = source.split("/").pop() || "";
    const title = list(r.title).join("; ");
    const date = list(r.date).join("; ");
    // Gallica's public-domain work status is separate from digitization reuse terms.
    return item("gallica", raw, {
      providerItemId: id,
      title,
      description: list(r.description).join("; "),
      creator: list(r.creator).join("; "),
      dateDisplay: date || "Date unknown",
      ...years(date),
      objectType: material(`${list(r.type).join(" ")} ${title}`),
      subjects: list(r.subject),
      medium: list(r.format).join("; "),
      sourceUrl: source,
      institution: list(r.source)[0] || "Bibliothèque nationale de France",
      thumbnailUrl: source && `${source}.thumbnail`,
      previewUrl: source && `${source}.medres`,
      ...classifyRights(
        `Work rights: ${list(r.rights).join("; ")}. Check Gallica digitization reuse terms; commercial reuse may require permission.`,
        "https://gallica.bnf.fr/edit/und/conditions-dutilisation-des-contenus-de-gallica",
        undefined,
        "Source work rights and Gallica reproduction terms must both be checked.",
      ),
    });
  },
  async search(q, signal) {
    const text = providerText(q).replace(/["\\]/g, " ");
    let query = `dc.type all "image" and gallica all "${text}" and provenance adj "bnf.fr"`;
    if (q.yearStart !== undefined)
      query += ` and dc.date >= "${Math.trunc(q.yearStart)}"`;
    if (q.yearEnd !== undefined)
      query += ` and dc.date <= "${Math.trunc(q.yearEnd)}"`;
    const r = await searchRecords(query, (q.page - 1) * 24 + 1, signal);
    return {
      provider: "gallica",
      items: r.records.map(gallica.normalizeItem).filter((i) => i.thumbnailUrl),
      total: r.total,
      hasMore: q.page * 24 < r.total,
      status: "ok",
    };
  },
  async getItem(id, signal) {
    if (!/^[a-z\d]+$/i.test(id)) throw new Error("Invalid Gallica identifier");
    const r = await searchRecords(
      `dc.identifier all "https://gallica.bnf.fr/ark:/12148/${id}"`,
      1,
      signal,
    );
    const result = r.records
      .map(gallica.normalizeItem)
      .find((i) => i.providerItemId === id);
    if (!result) throw new Error("Record not found");
    return result;
  },
};
