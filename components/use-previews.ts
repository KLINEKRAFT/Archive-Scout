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

export function loadVideo(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    const finish = (ok: boolean) => {
      clearTimeout(timer);
      video.onloadedmetadata = video.onerror = null;
      video.removeAttribute("src");
      video.load();
      resolve(ok);
    };
    const timer = setTimeout(() => finish(false), 12000);
    video.onloadedmetadata = () => finish(video.videoWidth > 0);
    video.onerror = () => finish(false);
    video.src = url;
  });
}

export function usePreviews(items: ArchiveItem[]) {
  const [results, setResults] = useState<Record<string, string | null>>({});
  // Palette/metadata updates must not restart image validation.
  const requestKey = JSON.stringify(
    items.map((i) => [
      previewKey(i),
      previewCandidates(i),
      i.mediaType === "video" ? i.videoUrl : undefined,
    ]),
  );
  useEffect(() => {
    let cancelled = false;
    const queue: [string, string[], string | undefined][] =
      JSON.parse(requestKey);
    let index = 0;
    async function worker() {
      while (!cancelled && index < queue.length) {
        const [key, urls, videoUrl] = queue[index++];
        if (Object.hasOwn(results, key)) continue;
        let url = await firstWorkingPreview(urls, loadImage);
        if (url && videoUrl && !(await loadVideo(videoUrl))) url = null;
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
