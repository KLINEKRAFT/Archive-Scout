"use client";
import { useEffect, useState } from "react";
import type { ArchiveItem } from "@/lib/types";
import {
  firstWorkingPreview,
  previewCandidates,
  previewKey,
} from "@/lib/preview";

// Browser decoding is the authority: a URL or HTTP success alone is not a preview.
export function loadImage(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const image = new window.Image();
    const finish = (ok: boolean) => {
      clearTimeout(timer);
      image.onload = image.onerror = null;
      if (!ok) image.removeAttribute("src");
      resolve(ok);
    };
    const timer = setTimeout(() => finish(false), 8000);
    image.onload = () =>
      finish(image.naturalWidth > 1 && image.naturalHeight > 1);
    image.onerror = () => finish(false);
    image.src = url;
  });
}

export function usePreviews(items: ArchiveItem[]) {
  const [results, setResults] = useState<Record<string, string | null>>({});
  // Palette/metadata updates must not restart image validation.
  const requestKey = JSON.stringify(
    items.map((i) => [previewKey(i), previewCandidates(i)]),
  );
  useEffect(() => {
    let cancelled = false;
    const queue: [string, string[]][] = JSON.parse(requestKey);
    let index = 0;
    async function worker() {
      while (!cancelled && index < queue.length) {
        const [key, urls] = queue[index++];
        if (Object.hasOwn(results, key)) continue;
        const url = await firstWorkingPreview(urls, loadImage);
        if (!cancelled) setResults((prev) => ({ ...prev, [key]: url }));
      }
    }
    void Promise.all(Array.from({ length: 6 }, worker));
    return () => {
      cancelled = true;
    };
    // Snapshot results at the start; completions must not restart the workers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);
  return {
    items: items.flatMap((item) => {
      const url = results[previewKey(item)];
      return url ? [{ ...item, verifiedPreviewUrl: url }] : [];
    }),
    pending: items.some((item) => !Object.hasOwn(results, previewKey(item))),
  };
}
