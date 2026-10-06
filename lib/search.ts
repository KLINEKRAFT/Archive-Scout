import type { ArchiveItem, SearchQuery } from "./types";
import { paletteScore } from "./color";
export function deduplicate(items: ArchiveItem[]): ArchiveItem[] {
  const seen = new Set<string>();
  return items.filter((i) => {
    const key = i.fullImageUrl || i.sourceUrl || i.id;
    if (seen.has(i.id) || seen.has(key)) return false;
    seen.add(i.id);
    seen.add(key);
    return true;
  });
}
export function filterAndRank(
  items: ArchiveItem[],
  q: SearchQuery,
): ArchiveItem[] {
  const filtered = deduplicate(items).filter((i) => {
    if (!q.providers.includes(i.provider)) return false;
    if (
      q.yearStart !== undefined &&
      (i.yearEnd ?? i.yearStart ?? -Infinity) < q.yearStart
    )
      return false;
    if (q.yearEnd !== undefined && (i.yearStart ?? Infinity) > q.yearEnd)
      return false;
    if (q.types.length && !q.types.includes(i.objectType)) return false;
    if (
      q.rights.length &&
      !q.rights.some((r) =>
        r === "commercial"
          ? i.commercialUseStatus === "allowed"
          : r === "public-domain"
            ? i.isPublicDomain
            : r === i.category,
      )
    )
      return false;
    if (q.minimumSize && Math.max(i.width || 0, i.height || 0) < q.minimumSize)
      return false;
    const ratio = i.aspectRatio;
    if (
      q.orientation !== "any" &&
      (!ratio ||
        (q.orientation === "portrait" && ratio >= 0.95) ||
        (q.orientation === "landscape" && (ratio <= 1.05 || ratio >= 2.4)) ||
        (q.orientation === "square" && (ratio < 0.95 || ratio > 1.05)) ||
        (q.orientation === "panoramic" && ratio < 2.4))
    )
      return false;
    if (
      q.selectedColors.length &&
      q.colorTolerance === "strict" &&
      paletteScore(i.dominantColors, q.selectedColors, q.colorMode, "strict") <
        0.035
    )
      return false;
    return true;
  });
  const scored = filtered.map((item, index) => ({
    item,
    index,
    color: paletteScore(
      item.dominantColors,
      q.selectedColors,
      q.colorMode,
      q.colorTolerance,
    ),
  }));
  scored.sort((a, b) => {
    switch (q.sort) {
      case "oldest":
        return (a.item.yearStart ?? Infinity) - (b.item.yearStart ?? Infinity);
      case "newest":
        return (b.item.yearEnd ?? -Infinity) - (a.item.yearEnd ?? -Infinity);
      case "largest":
        return (
          (b.item.width || 0) * (b.item.height || 0) -
          (a.item.width || 0) * (a.item.height || 0)
        );
      case "recent":
        return (b.item.addedAt || "").localeCompare(a.item.addedAt || "");
      case "random":
        return hash(a.item.id) - hash(b.item.id);
      default:
        return q.selectedColors.length
          ? (b.color - a.color) * 0.8 +
              ((a.index - b.index) / Math.max(items.length, 1)) * 0.08
          : a.index - b.index;
    }
  });
  return scored.map((r) => r.item);
}
function hash(s: string) {
  let n = 0;
  for (const c of s) n = (n * 31 + c.charCodeAt(0)) | 0;
  return n;
}
export interface SimilarityService {
  mode: "metadata-and-palette" | "embeddings";
  related(item: ArchiveItem): Partial<SearchQuery>;
}
export const similarityService: SimilarityService = {
  mode: "metadata-and-palette",
  related: (item) => ({
    textQuery:
      item.subjects.slice(0, 2).join(" ") ||
      item.title.split(" ").slice(0, 4).join(" "),
    selectedColors: item.dominantColors.slice(0, 5).map((c) => c.hex),
    yearStart: undefined,
    yearEnd: undefined,
    types: [],
    rights: [],
    sort: "relevance",
  }),
};
