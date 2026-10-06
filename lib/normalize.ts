import { providerCountries } from "./countries";
import type { ArchiveItem, ProviderId } from "./types";
import { PROVIDERS } from "./types";
import { classifyRights } from "./rights";
export function plain(value: unknown): string {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
export const list = (value: any): string[] =>
  (Array.isArray(value) ? value : value ? [value] : [])
    .map((v) =>
      plain(
        typeof v === "object"
          ? (v.name ?? v.label ?? v.content ?? v.term ?? "")
          : v,
      ),
    )
    .filter(Boolean);
export function safeUrl(value: unknown): string {
  try {
    const u = new URL(String(value));
    return ["https:", "http:"].includes(u.protocol) ? u.href : "";
  } catch {
    return "";
  }
}
export const num = (value: unknown): number | undefined =>
  value !== null &&
  value !== "" &&
  value !== undefined &&
  Number.isFinite(Number(value))
    ? Number(value)
    : undefined;
export function years(value: unknown): {
  yearStart?: number;
  yearEnd?: number;
} {
  const normalized = String(value ?? "")
    .replace(/\[(\d{2})\](\d{2})/g, "$1$2")
    .replace(/\b(\d{4})\d{4}\b/g, "$1");
  const found = normalized
    .match(/\b(?:1[0-9]{3}|20[0-2][0-9])\b/g)
    ?.map(Number);
  return found?.length
    ? { yearStart: found[0], yearEnd: found[1] ?? found[0] }
    : {};
}
export function material(value: string): string {
  const s = value.toLowerCase();
  const rules: [RegExp, string][] = [
    [/postcard/, "Postcard"],
    [/poster/, "Poster"],
    [/advertis/, "Advertisement"],
    [/photograph|negative|photo/, "Photography"],
    [/packag/, "Packaging"],
    [/illustrat/, "Illustration"],
    [/drawing/, "Drawing"],
    [/print|lithograph|etching|woodcut|engraving/, "Print"],
    [/map/, "Map"],
    [/catalog/, "Catalog"],
    [/magazine|periodical/, "Magazine"],
    [/book/, "Book"],
    [/typograph/, "Typography"],
    [/ephemera|greeting|card/, "Ephemera"],
    [/sculpture|object|vase|ceramic/, "Object"],
  ];
  return rules.find(([r]) => r.test(s))?.[1] ?? "Other";
}
export function item(
  provider: ProviderId,
  raw: any,
  data: Partial<ArchiveItem> & { providerItemId: string; title: string },
): ArchiveItem {
  const p = PROVIDERS.find((p) => p.id === provider)!;
  const result: ArchiveItem = {
    ...classifyRights(),
    id: `${provider}:${data.providerItemId}`,
    provider,
    description: "",
    contributors: [],
    dateDisplay: "Date unknown",
    objectType: "Other",
    subjects: [],
    tags: [],
    thumbnailUrl: "",
    previewUrl: "",
    sourceUrl: "",
    institution: p.name,
    archiveCountries: providerCountries(provider),
    downloadOptions: [],
    dominantColors: [],
    originalMetadata: raw,
    ...data,
  };
  result.title = plain(result.title);
  result.description = plain(result.description);
  result.creator = plain(result.creator) || undefined;
  result.thumbnailUrl = safeUrl(result.thumbnailUrl);
  result.previewUrl = safeUrl(result.previewUrl) || result.thumbnailUrl;
  result.sourceUrl = safeUrl(result.sourceUrl);
  result.downloadOptions = result.downloadOptions.filter((d) => safeUrl(d.url));
  if (result.width && result.height)
    result.aspectRatio = result.width / result.height;
  if (result.yearStart !== undefined)
    result.decade = Math.floor(result.yearStart / 10) * 10;
  return result;
}
export function iiif(
  base: string,
  identifier: string,
  width: number | "max" = 843,
): string {
  return `${base.replace(/\/$/, "")}/${encodeURIComponent(identifier)}/full/${width === "max" ? "max" : `${width},`}/0/default.jpg`;
}
