"use client";
import { ARCHIVE_COLLECTIONS, collectionQuery } from "@/lib/collections";
import { COUNTRIES } from "@/lib/countries";
import { useState } from "react";
import { Pipette, Plus, RotateCcw } from "lucide-react";
import {
  MATERIALS,
  PROVIDERS,
  type SearchQuery,
  type ProviderResult,
  type SavedPalette,
} from "@/lib/types";
import { SWATCHES } from "@/lib/color";
type Props = {
  query: SearchQuery;
  setQuery: (q: SearchQuery) => void;
  statuses: Record<string, ProviderResult>;
  savePalette: () => void;
  palettes: SavedPalette[];
};
export function Filters({
  query: q,
  setQuery: set,
  statuses,
  savePalette,
  palettes,
}: Props) {
  const [hex, setHex] = useState("#b83a2d");
  const [message, setMessage] = useState("");
  const toggle = (key: "types" | "rights", value: string) =>
    set({
      ...q,
      [key]: q[key].includes(value)
        ? q[key].filter((v) => v !== value)
        : [...q[key], value],
    });
  const color = (hex: string) => {
    if (q.selectedColors.includes(hex))
      set({ ...q, selectedColors: q.selectedColors.filter((c) => c !== hex) });
    else if (q.selectedColors.length < 5)
      set({ ...q, selectedColors: [...q.selectedColors, hex] });
    else setMessage("Choose up to five colors. Remove one to add another.");
  };
  const eye = async () => {
    const EyeDropper = (window as any).EyeDropper;
    if (!EyeDropper) {
      setMessage(
        "Screen sampling is unavailable in this browser. Use the color picker.",
      );
      return;
    }
    try {
      const r = await new EyeDropper().open();
      color(r.sRGBHex);
    } catch {}
  };
  return (
    <div className="filter-content">
      <div className="filter-heading">
        <span className="eyebrow">Refine the search</span>
        <button
          className="icon-button"
          title="Reset filters"
          aria-label="Reset filters"
          onClick={() =>
            set({
              ...q,
              yearStart: undefined,
              yearEnd: undefined,
              mediaType: "all",
              collection: "",
              countries: [],
              types: [],
              rights: [],
              selectedColors: [],
              orientation: "any",
              minimumSize: 0,
              providers: PROVIDERS.map((p) => p.id),
            })
          }
        >
          <RotateCcw size={14} />
        </button>
      </div>
      <fieldset className="media-filter">
        <legend className="eyebrow">Media</legend>
        <div className="media-options">
          {(
            [
              ["all", "All"],
              ["image", "Images"],
              ["video", "Video"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              aria-pressed={q.mediaType === value}
              onClick={() => set({ ...q, mediaType: value })}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="field-hint">
          Videos: 1980 and earlier. Undated videos are excluded.
        </p>
      </fieldset>
      <details open>
        <summary>
          Collection <span>{q.collection ? "1" : "All"}</span>
        </summary>
        <select
          aria-label="Archive collection"
          className="collection-select"
          value={q.collection}
          onChange={(e) => set({ ...q, ...collectionQuery(e.target.value) })}
        >
          <option value="">All collections</option>
          {ARCHIVE_COLLECTIONS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </details>
      <details open>
        <summary>
          Archive country <span>{q.countries.length || "All"}</span>
        </summary>
        <label className="country-hint" htmlFor="archive-country">
          Location of the archive, not the subject pictured.
        </label>
        <select
          id="archive-country"
          value={q.countries[0] || ""}
          onChange={(e) =>
            set({ ...q, countries: e.target.value ? [e.target.value] : [] })
          }
        >
          <option value="">All countries</option>
          {COUNTRIES.map(([code, name]) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>
      </details>
      <details open>
        <summary>
          Era{" "}
          <span>
            {q.yearStart ? `${q.yearStart}—${q.yearEnd}` : "All dates"}
          </span>
        </summary>
        <div className="decades">
          {[
            "All",
            "Pre-1900",
            ...Array.from({ length: 10 }, (_, i) => `${1900 + i * 10}s`),
          ].map((d) => {
            const y = parseInt(d);
            const active =
              d === "All"
                ? q.yearStart === undefined && q.yearEnd === undefined
                : d === "Pre-1900"
                  ? q.yearEnd === 1899
                  : q.yearStart === y && q.yearEnd === y + 9;
            return (
              <button
                key={d}
                aria-pressed={active}
                className={active ? "selected" : ""}
                onClick={() =>
                  set({
                    ...q,
                    yearStart: Number.isNaN(y) ? undefined : y,
                    yearEnd:
                      d === "Pre-1900"
                        ? 1899
                        : Number.isNaN(y)
                          ? undefined
                          : y + 9,
                  })
                }
              >
                {d}
              </button>
            );
          })}
        </div>
        <div className="year-range">
          <label>
            From
            <input
              aria-label="From year"
              type="number"
              placeholder="1800"
              value={q.yearStart ?? ""}
              onChange={(e) =>
                set({
                  ...q,
                  yearStart: e.target.value
                    ? Number(e.target.value)
                    : undefined,
                })
              }
            />
          </label>
          <span>—</span>
          <label>
            To
            <input
              aria-label="To year"
              type="number"
              placeholder="1999"
              value={q.yearEnd ?? ""}
              onChange={(e) =>
                set({
                  ...q,
                  yearEnd: e.target.value ? Number(e.target.value) : undefined,
                })
              }
            />
          </label>
        </div>
        {q.yearStart !== undefined &&
          q.yearEnd !== undefined &&
          q.yearStart > q.yearEnd && (
            <p className="small-note">
              The end year must follow the start year.
            </p>
          )}
      </details>
      <details open>
        <summary>
          Color index{" "}
          <span>{String(q.selectedColors.length).padStart(2, "0")} / 05</span>
        </summary>
        <div className="swatch-grid">
          {SWATCHES.map(([name, hex]) => (
            <button
              key={hex}
              title={`${name} · ${hex}`}
              aria-label={`${name} ${hex}`}
              aria-pressed={q.selectedColors.includes(hex)}
              className={`swatch ${q.selectedColors.includes(hex) ? "selected" : ""}`}
              style={{ background: hex }}
              onClick={() => color(hex)}
            >
              {q.selectedColors.includes(hex) ? "✓" : ""}
            </button>
          ))}
        </div>
        <div className="custom-color">
          <input
            aria-label="Custom color picker"
            type="color"
            value={/^#[0-9a-f]{6}$/i.test(hex) ? hex : "#b83a2d"}
            onChange={(e) => setHex(e.target.value)}
          />
          <input
            aria-label="Custom hex color"
            value={hex}
            maxLength={7}
            onChange={(e) => setHex(e.target.value)}
          />
          <button
            className="icon-button"
            disabled={!/^#[0-9a-f]{6}$/i.test(hex)}
            aria-label="Add custom color"
            onClick={() => color(hex.toLowerCase())}
          >
            <Plus size={16} />
          </button>
          <button
            className="icon-button"
            aria-label="Sample screen color"
            onClick={eye}
          >
            <Pipette size={15} />
          </button>
        </div>
        {message && (
          <p role="status" className="small-note">
            {message}
          </p>
        )}
        {q.selectedColors.length > 0 && (
          <>
            <div className="active-colors">
              {q.selectedColors.map((c) => (
                <button key={c} onClick={() => color(c)} title={`Remove ${c}`}>
                  <i style={{ background: c }} />
                  {c}
                  <span>×</span>
                </button>
              ))}
            </div>
            <div className="text-actions">
              <button onClick={() => set({ ...q, selectedColors: [] })}>
                Clear
              </button>
              <button onClick={savePalette}>Save palette ↗</button>
            </div>
            <label className="field-label">
              Match colors
              <select
                value={q.colorMode}
                onChange={(e) =>
                  set({ ...q, colorMode: e.target.value as "any" | "palette" })
                }
              >
                <option value="palette">Match palette</option>
                <option value="any">Any selected color</option>
              </select>
            </label>
            <label className="field-label">
              Color match
              <select
                value={q.colorTolerance}
                onChange={(e) =>
                  set({
                    ...q,
                    colorTolerance: e.target
                      .value as SearchQuery["colorTolerance"],
                  })
                }
              >
                <option value="loose">Loose</option>
                <option value="balanced">Balanced</option>
                <option value="strict">Strict</option>
              </select>
            </label>
            <p className="small-note">
              Colors rank the images loaded so far. Strict hides images without
              a close, analyzed match.
            </p>
          </>
        )}
        {palettes.length > 0 && (
          <label className="field-label">
            Saved palettes
            <select
              value=""
              onChange={(e) => {
                const p = palettes.find((p) => p.id === e.target.value);
                if (p) set({ ...q, selectedColors: p.colors });
              }}
            >
              <option value="">Choose a palette…</option>
              {palettes.map((p) => (
                <option value={p.id} key={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </details>
      <details open>
        <summary>Usage rights</summary>
        {[
          ["public-domain", "Public domain"],
          ["cc0", "CC0"],
          ["commercial", "Commercially usable"],
          ["attribution", "Attribution required"],
          ["unknown", "Unknown / check source"],
          ["restricted", "Restrictions / check source"],
        ].map(([value, label]) => (
          <label className="check-row" key={value}>
            <input
              type="checkbox"
              checked={q.rights.includes(value)}
              onChange={() => toggle("rights", value)}
            />
            {label}
          </label>
        ))}
      </details>
      <details>
        <summary>
          Material type <span>{q.types.length || "All"}</span>
        </summary>
        {MATERIALS.map((t) => (
          <label className="check-row" key={t}>
            <input
              type="checkbox"
              checked={q.types.includes(t)}
              onChange={() => toggle("types", t)}
            />
            {t}
          </label>
        ))}
      </details>
      <details>
        <summary>Image format</summary>
        <label className="field-label">
          Orientation
          <select
            value={q.orientation}
            onChange={(e) => set({ ...q, orientation: e.target.value })}
          >
            {["any", "portrait", "landscape", "square", "panoramic"].map(
              (v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ),
            )}
          </select>
        </label>
        <label className="field-label">
          Minimum longest edge
          <select
            value={q.minimumSize}
            onChange={(e) => set({ ...q, minimumSize: Number(e.target.value) })}
          >
            {[0, 2000, 3000, 4000, 6000, 8000].map((v) => (
              <option key={v} value={v}>
                {v ? `${v.toLocaleString()}px+` : "Any size"}
              </option>
            ))}
          </select>
        </label>
        <p className="small-note">
          Size and orientation filters use verified pixel dimensions. Unknown
          sizes are excluded.
        </p>
      </details>
      <details open>
        <summary>
          Source archives{" "}
          <span>
            {q.providers.length} / {PROVIDERS.length}
          </span>
        </summary>
        {PROVIDERS.map((p) => (
          <label className="check-row source-row" key={p.id}>
            <input
              type="checkbox"
              checked={q.providers.includes(p.id)}
              onChange={() =>
                set({
                  ...q,
                  providers: q.providers.includes(p.id)
                    ? q.providers.filter((id) => id !== p.id)
                    : [...q.providers, p.id],
                })
              }
            />
            <span>
              {p.name}
              <small>
                {statuses[p.id]?.status === "needs-key"
                  ? "API key required"
                  : statuses[p.id]?.status === "unavailable"
                    ? "Temporarily unavailable"
                    : p.code}
              </small>
            </span>
            <i
              className={`source-dot ${statuses[p.id]?.status || "idle"}`}
              title={statuses[p.id]?.status || "Not searched"}
            />
          </label>
        ))}
      </details>
    </div>
  );
}
