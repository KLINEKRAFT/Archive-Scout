import type { ArchiveItem } from "./types";

export function previewKey(item: ArchiveItem) {
  return JSON.stringify([
    item.id,
    item.thumbnailUrl,
    item.previewUrl,
    item.videoUrl,
  ]);
}

export function previewCandidates(item: ArchiveItem, large = false): string[] {
  const urls = [
    ...new Set(
      (large
        ? [item.previewUrl, item.thumbnailUrl]
        : [item.thumbnailUrl, item.previewUrl]
      ).filter((url) => {
        if (!/^https?:\/\//i.test(url)) return false;
        try {
          const u = new URL(url);
          return !(
            u.hostname.endsWith(".loc.gov") &&
            (u.pathname === "/pp/grp.gif" ||
              u.pathname.startsWith("/static/images/"))
          );
        } catch {
          return false;
        }
      }),
    ),
  ];
  return urls.flatMap((url) => [
    url,
    `/api/image?url=${encodeURIComponent(url)}`,
  ]);
}

export async function firstWorkingPreview(
  candidates: string[],
  load: (url: string) => Promise<boolean>,
): Promise<string | null> {
  for (const url of candidates) {
    try {
      if (await load(url)) return url;
    } catch {
      /* Try the next archive derivative. */
    }
  }
  return null;
}
