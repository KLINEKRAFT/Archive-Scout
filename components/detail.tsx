"use client";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  Bookmark,
  Copy,
  Download,
  Palette,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import type { ArchiveItem } from "@/lib/types";
import { Dialog } from "./dialog";
import { ArchiveImage } from "./item-grid";
export function Detail({
  item,
  onClose,
  onSave,
  onPalette,
  onSimilar,
  onMove,
  notify,
  onUnavailable,
}: {
  item: ArchiveItem;
  onClose: () => void;
  onSave: () => void;
  onPalette: () => void;
  onSimilar: () => void;
  onMove: (delta: number) => void;
  notify: (s: string) => void;
  onUnavailable: (item: ArchiveItem) => void;
}) {
  const [downloads, setDownloads] = useState(false);
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).matches("input,textarea,select")) return;
      if (e.key === "ArrowRight") onMove(1);
      if (e.key === "ArrowLeft") onMove(-1);
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onMove]);
  async function copy() {
    try {
      await navigator.clipboard.writeText(
        [
          item.title,
          item.dateDisplay === "Date unknown" ? "" : item.dateDisplay,
          item.creator,
          item.institution,
          item.rightsLabel,
          item.sourceUrl,
        ]
          .filter(Boolean)
          .join(". "),
      );
      notify("Credit copied to clipboard.");
    } catch {
      notify("Clipboard is unavailable in this browser.");
    }
  }
  return (
    <Dialog title={item.title} onClose={onClose} className="detail-dialog">
      <div className="detail-image">
        <div className="detail-navigation">
          <span className="eyebrow">
            Archive record / {item.provider.toUpperCase()}
          </span>
          <div>
            <button
              className="icon-button"
              aria-label="Previous image"
              onClick={() => onMove(-1)}
            >
              <ArrowLeft size={18} />
            </button>
            <button
              className="icon-button"
              aria-label="Next image"
              onClick={() => onMove(1)}
            >
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
        <ArchiveImage
          key={item.id}
          item={item}
          large
          onUnavailable={onUnavailable}
        />
        <span className="detail-caption">
          {item.title} · {item.dateDisplay}
        </span>
      </div>
      <aside className="detail-info">
        <span className="eyebrow red">
          {item.objectType} / {item.dateDisplay}
        </span>
        <h2>{item.title}</h2>
        <p className="creator">{item.creator || "Creator not recorded"}</p>
        <div className="detail-actions">
          <button className="primary" onClick={() => setDownloads(!downloads)}>
            <Download size={15} />
            Image files
          </button>
          <button className="outline" onClick={onSave}>
            <Bookmark size={15} />
            Save
          </button>
        </div>
        {downloads && (
          <div className="downloads">
            {item.downloadOptions.length ? (
              item.downloadOptions.map((d, i) => (
                <a key={i} href={d.url} target="_blank" rel="noreferrer">
                  <span>
                    {d.label}
                    <small>
                      {d.width && d.height
                        ? `${d.width.toLocaleString()} × ${d.height.toLocaleString()}`
                        : ""}
                      {d.bytes ? ` · ${(d.bytes / 1000000).toFixed(1)} MB` : ""}
                    </small>
                  </span>
                  <ArrowUpRight size={14} />
                </a>
              ))
            ) : (
              <p className="small-note">
                Download options are available on the original archive record.
              </p>
            )}
            <p className="small-note">
              Files open directly from the archive. Use your browser’s save
              command to keep the original bytes.
            </p>
          </div>
        )}
        <a
          className="record-link"
          href={item.sourceUrl}
          target="_blank"
          rel="noreferrer"
        >
          View original record <ArrowUpRight size={15} />
        </a>
        <dl className="metadata">
          {[
            ["Date", item.dateDisplay],
            ["Source", item.institution],
            ["Collection", item.collection],
            ["Type", item.objectType],
            ["Medium", item.medium],
            ["Object size", item.physicalDimensions],
            [
              "Image pixels",
              item.width && item.height
                ? `${item.width.toLocaleString()} × ${item.height.toLocaleString()}`
                : "Not supplied",
            ],
            ["Identifier", item.providerItemId],
          ]
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
        </dl>
        <section className="rights-detail">
          <div className="eyebrow">
            Usage rights{" "}
            <span className={item.isPublicDomain ? "open-text" : ""}>
              {item.rightsLabel}
            </span>
          </div>
          <details>
            <summary>View rights details</summary>
            <p>{item.rightsDescription}</p>
            <p className="small-note">{item.evidence}</p>
            {item.rightsUrl && (
              <a href={item.rightsUrl} target="_blank" rel="noreferrer">
                Source rights information ↗
              </a>
            )}
          </details>
        </section>
        <section className="detail-palette">
          <span className="eyebrow">Detected palette</span>
          {item.dominantColors.length ? (
            <>
              <div className="palette-strip">
                {item.dominantColors.slice(0, 5).map((c) => (
                  <span
                    key={c.hex}
                    style={{ background: c.hex, flex: c.percentage }}
                    title={`${c.hex} · ${Math.round(c.percentage * 100)}%`}
                  />
                ))}
              </div>
              <div className="palette-labels">
                {item.dominantColors.slice(0, 5).map((c) => (
                  <span key={c.hex}>{c.hex}</span>
                ))}
              </div>
              <button className="text-button" onClick={onPalette}>
                <Palette size={14} />
                Search this palette ↗
              </button>
            </>
          ) : (
            <p className="small-note">
              Palette analysis pending or unavailable for this preview.
            </p>
          )}
        </section>
        <div className="detail-secondary">
          <button className="outline" onClick={onSimilar}>
            Find related imagery ↗
          </button>
          <button className="text-button" onClick={copy}>
            <Copy size={14} />
            Copy credit
          </button>
        </div>
        <p className="small-note">
          Related imagery uses subject metadata and detected colors.
        </p>
        {item.description && <p className="description">{item.description}</p>}
        {item.subjects.length > 0 && (
          <p className="subjects">{item.subjects.slice(0, 8).join(" / ")}</p>
        )}
      </aside>
    </Dialog>
  );
}
