import type { ArchiveItem } from "./types";
// Only strip transformations whose semantics are known. Preserve arbitrary query IDs.
export function canonicalAssetUrl(value: string): string {
  try {
    const u = new URL(value, "https://archive-scout.invalid");
    if (u.pathname === "/api/image" && u.searchParams.get("url"))
      return canonicalAssetUrl(u.searchParams.get("url")!);
    if (!/^https?:$/.test(u.protocol) || u.hostname === "archive-scout.invalid")
      return "";
    if (u.pathname === "/" && !u.search) return "";
    u.protocol = "https:";
    u.hash = "";
    for (const key of [...u.searchParams.keys()])
      if (/^utm_|^(fbclid|gclid)$/i.test(key)) u.searchParams.delete(key);
    const vam =
      u.hostname.endsWith(".vam.ac.uk") &&
      u.pathname.match(/\/(?:item|museumobject|object)\/(O\d+)(?:\/|$)/);
    if (vam) return `vam:${vam[1]}`;
    const ark =
      u.hostname === "gallica.bnf.fr" &&
      u.pathname.match(/\/ark:\/12148\/([a-z\d]+)/i);
    if (ark) return `gallica:${ark[1]}`;
    // IIIF: identifier / region / size / rotation / quality.format.
    u.pathname = u.pathname.replace(
      /\/(?:full|[\d,]+)\/(?:!?[\d,]+|full|max|pct:[\d.]+)\/!?[\d.]+\/(?:default|native|color|gray|bitonal)\.(?:jpg|png|webp)$/i,
      "",
    );
    if (u.hostname === "upload.wikimedia.org")
      u.pathname = u.pathname.replace(/\/thumb\/(.+)\/[^/]+$/, "/$1");
    u.pathname = u.pathname.replace(/\/$/, "");
    u.searchParams.sort();
    return u.href;
  } catch {
    return "";
  }
}
export function identityKeys(i: ArchiveItem): string[] {
  const urls = [i.sourceUrl, i.fullImageUrl, i.previewUrl, i.thumbnailUrl];
  // A shared poster does not imply that two films are the same.
  if (i.mediaType === "video")
    urls.splice(0, urls.length, i.sourceUrl, i.videoUrl);
  return [
    ...new Set([
      `id:${i.id}`,
      ...(i.identityKeys || []),
      ...urls
        .filter(Boolean)
        .map((u) => canonicalAssetUrl(u!))
        .filter(Boolean)
        .map((u) => `url:${u}`),
      ...(i.visualFingerprint && i.mediaType !== "video"
        ? [`pixels:${i.visualFingerprint}`]
        : []),
    ]),
  ];
}
export function deduplicate(items: ArchiveItem[]): ArchiveItem[] {
  const parent = items.map((_, i) => i);
  const root = (i: number): number =>
    parent[i] === i ? i : (parent[i] = root(parent[i]));
  const seen = new Map<string, number>();
  items.forEach((item, index) =>
    identityKeys(item).forEach((key) => {
      const previous = seen.get(key);
      if (previous !== undefined) {
        const a = root(previous),
          b = root(index);
        parent[Math.max(a, b)] = Math.min(a, b);
      } else seen.set(key, index);
    }),
  );
  const groups = new Map<number, ArchiveItem>();
  items.forEach((item, index) => {
    const key = root(index),
      previous = groups.get(key);
    groups.set(
      key,
      previous
        ? {
            ...previous,
            identityKeys: [
              ...new Set([
                ...(previous.identityKeys || []),
                ...identityKeys(item),
              ]),
            ],
          }
        : { ...item, identityKeys: identityKeys(item) },
    );
  });
  return [...groups.values()];
}
// Keep alternative providers until browser validation; merge repeated pages by record ID only.
export function uniqueRecords(items: ArchiveItem[]): ArchiveItem[] {
  return [...new Map(items.map((i) => [i.id, i])).values()];
}
