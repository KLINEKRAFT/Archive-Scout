"use client";
import { deduplicate } from "@/lib/duplicates";
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

// Compare decoded pixels, not filenames. CORS failures retain URL-based identities.
async function fingerprint(url: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    const image = new window.Image();
    image.crossOrigin = "anonymous";
    const finish = (value?: string) => {
      clearTimeout(timer);
      image.onload = image.onerror = null;
      resolve(value);
    };
    const timer = setTimeout(() => finish(), 3000);
    image.onerror = () => finish();
    image.onload = async () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 32;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) return finish();
        context.drawImage(image, 0, 0, 32, 32);
        const pixels = context.getImageData(0, 0, 32, 32).data;
        const digest = await crypto.subtle.digest("SHA-256", pixels);
        finish(
          `${Math.round((image.naturalWidth / image.naturalHeight) * 1000)}:${Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("")}`,
        );
      } catch {
        finish();
      }
    };
    image.src = url;
  });
}

export function usePreviews(items: ArchiveItem[]) {
  const [results, setResults] = useState<
    Record<string, { url: string; fingerprint?: string } | null>
  >({});
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
        const value = url
          ? { url, fingerprint: videoUrl ? undefined : await fingerprint(url) }
          : null;
        if (!cancelled) setResults((prev) => ({ ...prev, [key]: value }));
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
    items: deduplicate(
      items.flatMap((item) => {
        const result = results[previewKey(item)];
        return result
          ? [
              {
                ...item,
                verifiedPreviewUrl: result.url,
                visualFingerprint: result.fingerprint || item.visualFingerprint,
              },
            ]
          : [];
      }),
    ),
    pending: items.some((item) => !Object.hasOwn(results, previewKey(item))),
  };
}
