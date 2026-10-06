"use client";
import Image from "next/image";
import { Bookmark, ArrowUpRight } from "lucide-react";
import { useState } from "react";
import { PROVIDERS, type ArchiveItem } from "@/lib/types";
export function ArchiveImage({
  item,
  large = false,
  priority = false,
}: {
  item: ArchiveItem;
  large?: boolean;
  priority?: boolean;
}) {
  const [broken, setBroken] = useState(false);
  const [fallback, setFallback] = useState(false);
  const url = large ? item.previewUrl : item.thumbnailUrl;
  return broken ? (
    <div className="image-unavailable">
      <span>Preview unavailable</span>
      <small>Open the record for the archive image ↗</small>
    </div>
  ) : (
    <Image
      src={fallback ? `/api/image?url=${encodeURIComponent(url)}` : url}
      alt={item.title}
      width={item.width || 600}
      height={item.height || 750}
      unoptimized
      loading={priority ? "eager" : "lazy"}
      onError={() => (fallback ? setBroken(true) : setFallback(true))}
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
}: {
  items: ArchiveItem[];
  layout: "masonry" | "uniform";
  onOpen: (i: ArchiveItem) => void;
  onSave: (i: ArchiveItem) => void;
  saved: Set<string>;
  showColors?: boolean;
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
              <ArchiveImage item={item} priority={index < 4} />
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
