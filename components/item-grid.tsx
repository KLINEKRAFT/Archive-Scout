"use client";
import Image from "next/image";
import { loadImage } from "./use-previews";
import { Bookmark, ArrowUpRight } from "lucide-react";
import { useEffect, useState } from "react";
import { firstWorkingPreview, previewCandidates } from "@/lib/preview";
import { PROVIDERS, type ArchiveItem } from "@/lib/types";
export function ArchiveImage({
  item,
  large = false,
  priority = false,
  onUnavailable,
}: {
  item: ArchiveItem;
  large?: boolean;
  priority?: boolean;
  onUnavailable?: (item: ArchiveItem) => void;
}) {
  const [resolved, setResolved] = useState<{ key: string; url: string } | null>(
    null,
  );
  const key = JSON.stringify([
    item.id,
    item.previewUrl,
    item.verifiedPreviewUrl,
  ]);
  const url = resolved?.key === key ? resolved.url : item.verifiedPreviewUrl;
  useEffect(() => {
    if (!large) return;
    let alive = true;
    void firstWorkingPreview(previewCandidates(item, true), loadImage).then(
      (next) => {
        if (alive && next) setResolved({ key, url: next });
      },
    );
    return () => {
      alive = false;
    };
  }, [key, large]);
  if (!url) return null;
  return (
    <Image
      src={url}
      alt={item.title}
      width={item.width || 600}
      height={item.height || 750}
      unoptimized
      loading={priority ? "eager" : "lazy"}
      onError={() => {
        if (large && url !== item.verifiedPreviewUrl && item.verifiedPreviewUrl)
          setResolved({ key, url: item.verifiedPreviewUrl });
        else onUnavailable?.(item);
      }}
    />
  );
}

export function ItemGrid({
  items,
  layout,
  onOpen,
  onSave,
  saved,
  showColors = false,
  onUnavailable,
}: {
  items: ArchiveItem[];
  layout: "masonry" | "uniform";
  onOpen: (i: ArchiveItem) => void;
  onSave: (i: ArchiveItem) => void;
  saved: Set<string>;
  showColors?: boolean;
  onUnavailable: (item: ArchiveItem) => void;
}) {
  return (
    <div className={`image-grid ${layout}`}>
      {items.map((item, index) => (
        <article className="archive-card" key={item.id}>
          <div className="image-wrap">
            <button
              className="open-image"
              aria-label={`View ${item.title}`}
              onClick={() => onOpen(item)}
            >
              <ArchiveImage
                item={item}
                priority={index < 4}
                onUnavailable={onUnavailable}
              />
            </button>
            <button
              className={`save-image ${saved.has(item.id) ? "is-saved" : ""}`}
              aria-label={`Save ${item.title} to a collection`}
              onClick={() => onSave(item)}
            >
              <Bookmark
                size={16}
                fill={saved.has(item.id) ? "currentColor" : "none"}
              />
            </button>
            <span className="image-resolution">
              {item.width && item.height
                ? `${item.width.toLocaleString()} × ${item.height.toLocaleString()}`
                : "View record"}{" "}
              <ArrowUpRight size={12} />
            </span>
          </div>
          <div className="card-meta">
            <div className="card-title-row">
              <button onClick={() => onOpen(item)}>{item.title}</button>
              <span>{item.dateDisplay}</span>
            </div>
            <div className="card-source">
              <span>{PROVIDERS.find((p) => p.id === item.provider)?.code}</span>
              <span
                className={`rights-mark ${item.isPublicDomain ? "open" : ""}`}
              >
                {item.isCC0
                  ? "CC0"
                  : item.isPublicDomain
                    ? "PD"
                    : item.requiresAttribution
                      ? "BY"
                      : "Check source"}
              </span>
            </div>
            {showColors && item.dominantColors.length > 0 && (
              <div className="detected-swatches" aria-label="Detected colors">
                {item.dominantColors.slice(0, 5).map((c) => (
                  <i
                    key={c.hex}
                    title={`${c.hex} · ${Math.round(c.percentage * 100)}%`}
                    style={{ background: c.hex }}
                  />
                ))}
              </div>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
