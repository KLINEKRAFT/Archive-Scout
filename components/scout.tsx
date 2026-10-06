"use client";
import { admitPage } from "@/lib/pagination";
import { InfiniteResults } from "./infinite-results";
import { DISCOVERY_SEARCHES, discoveryMix } from "@/lib/discovery";
import {
  ARCHIVE_COLLECTIONS,
  collectionQuery,
  archiveCollection,
} from "@/lib/collections";
import { uniqueRecords } from "@/lib/duplicates";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Search,
  Sun,
  Moon,
  Bookmark,
  SlidersHorizontal,
  LayoutGrid,
  Columns3,
  Plus,
  X,
  FolderOpen,
  Check,
  Palette,
} from "lucide-react";
import {
  PROVIDERS,
  type ArchiveItem,
  type Board,
  type ProviderResult,
  type SavedPalette,
  type SearchQuery,
  type Color,
} from "@/lib/types";
import {
  defaultQuery,
  parseQuery,
  queryFromText,
  serializeQuery,
} from "@/lib/query";
import { filterAndRank, deduplicate, similarityService } from "@/lib/search";
import { localResearchStorage } from "@/lib/storage";
import { allowsHistoricalVideo } from "@/lib/video-policy";
import { usePreviews } from "./use-previews";
import { ItemGrid } from "./item-grid";
import { Filters } from "./filters";
import { Detail } from "./detail";
import { Dialog } from "./dialog";
const prompts = [
  "1950s Christmas",
  "1960s Advertising",
  "Space Age",
  "Vintage Travel",
  "Department Stores",
  "Roadside America",
  "Vintage Packaging",
  "Tulsa advertising",
];
const editorialPalettes = [
  {
    name: "Mid-century Christmas",
    query: "Christmas illustration",
    colors: ["#b83a2d", "#eee1c4", "#315842", "#adc7cc"],
    label: "01 / HOLIDAY EPHEMERA",
  },
  {
    name: "The atomic age",
    query: "atomic age",
    colors: ["#58aaa4", "#d67a64", "#c5a03b", "#f5f1e7"],
    label: "02 / A BRIGHTER FUTURE",
  },
  {
    name: "Earth tones, 1970s",
    query: "1970s poster",
    colors: ["#66704a", "#bb5d34", "#604235", "#eee1c4"],
    label: "03 / BACK TO THE EARTH",
  },
];
export function Scout() {
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<"home" | "search" | "collections">("home");
  const [query, setQuery] = useState<SearchQuery>(defaultQuery);
  const [input, setInput] = useState("");
  const [items, setItems] = useState<ArchiveItem[]>([]);
  const [statuses, setStatuses] = useState<Record<string, ProviderResult>>({});
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const discoverySeed = useRef(0);
  const seenPages = useRef<Record<string, Set<string>>>({});
  const [layout, setLayout] = useState<"masonry" | "uniform">("masonry");
  const [dark, setDark] = useState(false);
  const [mobileFilters, setMobileFilters] = useState(false);
  const [selected, setSelected] = useState<ArchiveItem | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [palettes, setPalettes] = useState<SavedPalette[]>([]);
  const [activeBoard, setActiveBoard] = useState<string | null>(null);
  const [saveItem, setSaveItem] = useState<ArchiveItem | null>(null);
  const [paletteDialog, setPaletteDialog] = useState(false);
  const [boardDialog, setBoardDialog] = useState(false);
  const [name, setName] = useState("");
  const [toast, setToast] = useState("");
  const [about, setAbout] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const analyzed = useRef(new Map<string, Color[]>());
  const analyzing = useRef(new Set<string>());
  const failedAnalysis = useRef(new Set<string>());
  const [analysisTick, setAnalysisTick] = useState(0);
  const notify = useCallback((s: string) => setToast(s), []);
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    const q = parseQuery(p);
    setQuery(q);
    setInput(q.textQuery);
    if (p.toString()) setView("search");
    setBoards(localResearchStorage.loadBoards());
    setPalettes(localResearchStorage.loadPalettes());
    try {
      setDark(localStorage.getItem("archive-scout:theme") === "dark");
    } catch {}
    discoverySeed.current = Math.floor(Math.random() * 2147483647);
    setReady(true);
    const pop = () => {
      const q = parseQuery(new URLSearchParams(location.search));
      setQuery(q);
      setInput(q.textQuery);
      setView(location.search ? "search" : "home");
      setPage(1);
    };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    if (ready)
      try {
        localStorage.setItem("archive-scout:theme", dark ? "dark" : "light");
      } catch {}
  }, [dark, ready]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        !(e.target as HTMLElement).matches("input,textarea,select") &&
        !document.querySelector("dialog[open]")
      ) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const updateQuery = useCallback((q: SearchQuery) => {
    setQuery(q);
    setPage(1);
    setView("search");
    history.replaceState(null, "", `?${serializeQuery(q)}`);
  }, []);
  function search(text: string, patch: Partial<SearchQuery> = {}) {
    const next = { ...queryFromText(text, defaultQuery), ...patch };
    setInput(text);
    updateQuery(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  const sourceKey = query.providers.join(",");
  const countryKey = query.countries.join(",");
  const textKey = query.textQuery;
  const collectionKey = query.collection;
  const mediaKey = query.mediaType;
  const from = query.yearStart;
  const to = query.yearEnd;
  const isHome = view === "home";
  useEffect(() => {
    if (!ready || view === "collections") return;
    const controller = new AbortController();
    let alive = true;
    setLoading(true);
    if (page === 1) {
      setItems([]);
      setStatuses({});
      seenPages.current = {};
    }
    const timeout = setTimeout(() => {
      const ids = isHome
        ? DISCOVERY_SEARCHES.map((s) => s.provider)
        : query.providers.filter((id) => page === 1 || statuses[id]?.hasMore);
      const q = isHome
        ? {
            ...defaultQuery,
            mediaType: "image" as const,
            yearStart: 1800,
            yearEnd: 1980,
          }
        : query;
      Promise.allSettled(
        ids.map(async (id) => {
          try {
            const p = serializeQuery(
              isHome
                ? {
                    ...q,
                    textQuery: DISCOVERY_SEARCHES.find(
                      (s) => s.provider === id,
                    )!.text,
                  }
                : q,
            );
            const response = await fetch(
              `/api/search?${p}&provider=${id}&page=${page}`,
              { signal: controller.signal },
            );
            if (!response.ok) throw new Error();
            const r: ProviderResult = await response.json();
            if (!alive) return;
            const seen = (seenPages.current[id] ||= new Set<string>());
            const admitted = admitPage(r, seen, page);
            setStatuses((s) => ({ ...s, [id]: admitted }));
            setItems((prev) =>
              uniqueRecords([
                ...prev,
                ...r.items.map((i) => ({
                  ...i,
                  dominantColors:
                    analyzed.current.get(i.thumbnailUrl) || i.dominantColors,
                })),
              ]),
            );
          } catch {
            if (alive)
              setStatuses((s) => ({
                ...s,
                [id]: {
                  provider: id,
                  items: [],
                  total: 0,
                  hasMore: false,
                  status: "unavailable",
                },
              }));
          }
        }),
      ).finally(() => {
        if (alive) setLoading(false);
      });
    }, 180);
    return () => {
      alive = false;
      controller.abort();
      clearTimeout(timeout);
    };
    // Local filters and palette choices do not restart provider requests.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    ready,
    isHome,
    view === "collections",
    textKey,
    collectionKey,
    mediaKey,
    sourceKey,
    countryKey,
    from,
    to,
    page,
    retry,
  ]);
  // Analyze modest previews with bounded concurrency. Each image is analyzed once per session;
  // the server maintains the durable versioned cache. Never send source master files.
  useEffect(() => {
    if (view !== "search" && !selected) return;
    const candidates = selected
      ? [selected, ...(view === "search" ? items : [])]
      : items;
    for (const item of candidates) {
      if (analyzing.current.size >= 3) break;
      const url = item.thumbnailUrl;
      if (
        !url ||
        item.dominantColors.length ||
        analyzed.current.has(url) ||
        analyzing.current.has(url) ||
        failedAnalysis.current.has(url)
      )
        continue;
      analyzing.current.add(url);
      fetch(`/api/palette?url=${encodeURIComponent(url)}`)
        .then(async (r) => {
          if (!r.ok) throw new Error();
          return r.json();
        })
        .then((r) => {
          analyzed.current.set(url, r.colors);
          setItems((prev) =>
            prev.map((i) =>
              i.thumbnailUrl === url
                ? {
                    ...i,
                    dominantColors: r.colors,
                    colorAnalysisVersion: r.version,
                  }
                : i,
            ),
          );
          setSelected((i) =>
            i?.thumbnailUrl === url
              ? {
                  ...i,
                  dominantColors: r.colors,
                  colorAnalysisVersion: r.version,
                }
              : i,
          );
        })
        .catch(() => failedAnalysis.current.add(url))
        .finally(() => {
          analyzing.current.delete(url);
          setAnalysisTick((n) => n + 1);
        });
    }
  }, [items, selected, view, analysisTick]);
  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    fetch(
      `/api/item?provider=${selected.provider}&id=${encodeURIComponent(selected.providerItemId)}`,
      { signal: controller.signal },
    )
      .then(async (r) => {
        if (r.status === 404) {
          setFailedPreviews((prev) => new Set([...prev, selected.id]));
          setSelected((prev) => (prev?.id === selected.id ? null : prev));
          return null;
        }
        if (!r.ok) return null;
        return r.json();
      })
      .then((record: ArchiveItem | null) => {
        if (record && allowsHistoricalVideo(record))
          setSelected((prev) =>
            prev?.id === record.id
              ? {
                  ...record,
                  dominantColors: prev.dominantColors,
                  verifiedPreviewUrl: prev.verifiedPreviewUrl,
                  identityKeys: prev.identityKeys,
                  visualFingerprint: prev.visualFingerprint,
                }
              : prev,
          );
      })
      .catch(() => {});
    return () => controller.abort();
  }, [selected?.id]);
  const [failedPreviews, setFailedPreviews] = useState<Set<string>>(new Set());
  const omitUnavailable = useCallback((item: ArchiveItem) => {
    setFailedPreviews((prev) => new Set([...prev, item.id]));
    setSelected((prev) => (prev?.id === item.id ? null : prev));
  }, []);
  const candidates = useMemo(
    () =>
      (view === "collections"
        ? boards.find((b) => b.id === activeBoard)?.items || []
        : isHome
          ? items
          : filterAndRank(items, query)
      ).filter(
        (item) => allowsHistoricalVideo(item) && !failedPreviews.has(item.id),
      ),
    [items, query, isHome, view, boards, activeBoard, failedPreviews],
  );
  const previews = usePreviews(candidates);
  const visible = isHome
    ? discoveryMix(previews.items, discoverySeed.current).slice(0, 12)
    : previews.items;
  const nextPage = useCallback(() => {
    setLoading(true);
    setPage((p) => p + 1);
  }, []);
  const checkingImages = loading || previews.pending;
  const saved = useMemo(
    () => new Set(boards.flatMap((b) => b.items.map((i) => i.id))),
    [boards],
  );
  const selectedCurrent = selected
    ? items.find((i) => i.id === selected.id)?.dominantColors.length
      ? {
          ...selected,
          dominantColors: items.find((i) => i.id === selected.id)!
            .dominantColors,
        }
      : selected
    : null;
  function persistBoards(next: Board[]) {
    try {
      localResearchStorage.saveBoards(next);
      setBoards(next);
      return true;
    } catch {
      notify("Storage is full or disabled. The collection could not be saved.");
      return false;
    }
  }
  function addToBoard(id: string) {
    if (!saveItem) return;
    const compact = { ...saveItem, originalMetadata: {} };
    const next = boards.map((b) =>
      b.id === id ? { ...b, items: deduplicate([...b.items, compact]) } : b,
    );
    if (persistBoards(next)) {
      setSaveItem(null);
      notify("Saved to your collection.");
    }
  }
  function createBoard() {
    if (!name.trim()) return;
    const b: Board = {
      id: crypto.randomUUID(),
      name: name.trim(),
      items: saveItem ? [{ ...saveItem, originalMetadata: {} }] : [],
      colors: query.selectedColors,
      createdAt: new Date().toISOString(),
    };
    if (persistBoards([...boards, b])) {
      setName("");
      setSaveItem(null);
      setBoardDialog(false);
      notify("Collection created.");
    }
  }
  function savePalette() {
    if (!name.trim() || !query.selectedColors.length) return;
    const next = [
      ...palettes,
      {
        id: crypto.randomUUID(),
        name: name.trim(),
        colors: query.selectedColors,
      },
    ];
    try {
      localResearchStorage.savePalettes(next);
      setPalettes(next);
      setPaletteDialog(false);
      setName("");
      notify("Palette saved on this device.");
    } catch {
      notify("The palette could not be saved. Browser storage may be full.");
    }
  }
  function usePalette() {
    if (!selectedCurrent) return;
    const colors = selectedCurrent.dominantColors.slice(0, 5).map((c) => c.hex);
    setSelected(null);
    setInput("");
    updateQuery({ ...defaultQuery, selectedColors: colors, sort: "color" });
  }
  const good = Object.values(statuses).filter((s) => s.status === "ok").length;
  const done = Object.keys(statuses).length;
  const board = boards.find((b) => b.id === activeBoard);
  const filters = (
    <Filters
      query={query}
      setQuery={updateQuery}
      statuses={statuses}
      savePalette={() => {
        setName("");
        setPaletteDialog(true);
      }}
      palettes={palettes}
    />
  );
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <button
          className="brand"
          aria-label="Archive Scout home"
          onClick={() => {
            setView("home");
            setQuery(defaultQuery);
            setInput("");
            setPage(1);
            history.pushState(null, "", "/");
          }}
        >
          <span className="brand-mark">
            <i />
            <i />
            <i />
            <i />
          </span>
          <span>
            ARCHIVE
            <br />
            SCOUT
          </span>
        </button>
        <nav aria-label="Main navigation">
          <button
            className={view !== "collections" ? "active" : ""}
            onClick={() => {
              setView("home");
              setPage(1);
              history.pushState(null, "", "/");
            }}
          >
            Discover
          </button>
          <button
            className={view === "collections" ? "active" : ""}
            onClick={() => {
              setView("collections");
              setActiveBoard(null);
            }}
          >
            Collections <span>{boards.length.toString().padStart(2, "0")}</span>
          </button>
          <button onClick={() => setAbout(true)}>
            About the archive <ArrowUpRight size={12} />
          </button>
        </nav>
        <div className="header-end">
          <span className="header-caption">An index of the visual past</span>
          <button
            className="icon-button theme-toggle"
            aria-label={dark ? "Use paper mode" : "Use dark research mode"}
            onClick={() => setDark(!dark)}
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>
      <main id="main">
        {view === "home" ? (
          <>
            <section className="hero">
              <div className="hero-heading">
                <h1>
                  Search the
                  <br />
                  <span>visual past.</span>
                  <span className="hero-asterisk">✳</span>
                </h1>
              </div>
              <form
                className="hero-search"
                onSubmit={(e) => {
                  e.preventDefault();
                  search(input);
                }}
              >
                <Search size={24} />
                <input
                  ref={searchRef}
                  aria-label="Search the archives"
                  placeholder="Christmas morning 1958, roadside America, atomic design…"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                />
                <kbd>/</kbd>
                <button type="submit">
                  Search archives <ArrowRight size={19} />
                </button>
              </form>
              <div className="discovery-prompts">
                <span className="eyebrow">Start somewhere</span>
                <button
                  onClick={() =>
                    search("advertising", {
                      mediaType: "video",
                      providers: ["internetarchive"],
                      yearStart: 1960,
                      yearEnd: 1969,
                    })
                  }
                >
                  1960s TV &amp; film <ArrowUpRight size={12} />
                </button>
                {prompts.map((p) => (
                  <button
                    key={p}
                    onClick={() =>
                      search(
                        p === "Tulsa advertising" ? "advertising" : p,
                        p === "Tulsa advertising"
                          ? { providers: ["tulsa"] }
                          : {},
                      )
                    }
                  >
                    {p}
                    <ArrowUpRight size={12} />
                  </button>
                ))}
              </div>
            </section>
            <section className="home-discovery">
              <div className="section-heading">
                <div>
                  <span className="eyebrow red">The open drawer / 01</span>
                  <h2>A little serendipity.</h2>
                </div>
                <p>
                  People, places, unexpected details.
                  <br />A starting point for your next idea.
                </p>
                <button
                  className="text-button"
                  onClick={() => {
                    discoverySeed.current = Math.floor(
                      Math.random() * 2147483647,
                    );
                    setRetry((n) => n + 1);
                  }}
                >
                  Shuffle discoveries <ArrowRight size={16} />
                </button>
              </div>
              {visible.length ? (
                <ItemGrid
                  onUnavailable={omitUnavailable}
                  items={visible.slice(0, 8)}
                  layout="masonry"
                  onOpen={(i) => {
                    setSelected(i);
                  }}
                  onSave={(i) => {
                    setName("");
                    setSaveItem(i);
                  }}
                  saved={saved}
                />
              ) : checkingImages ? (
                <div
                  className="skeleton-grid"
                  aria-label="Loading archive images"
                >
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} />
                  ))}
                </div>
              ) : (
                <div className="quiet-empty">
                  The archive drawer is taking a moment.{" "}
                  <button
                    onClick={() => {
                      setPage(1);
                      setRetry((n) => n + 1);
                    }}
                  >
                    Try again ↗
                  </button>
                </div>
              )}
              <div className="home-caption">
                <span className="eyebrow">
                  Live photographs / mixed archives
                </span>
                <span>Every image leads back to its source.</span>
              </div>
            </section>
            <section className="historical-collections">
              <div className="section-heading">
                <div>
                  <span className="eyebrow red">Browse a collection</span>
                  <h2>Print, history &amp; film.</h2>
                </div>
                <p>1800–1980 · Original sources and working previews.</p>
              </div>
              <div className="collection-shortcuts">
                {ARCHIVE_COLLECTIONS.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => search(c.query, collectionQuery(c.id))}
                  >
                    <strong>
                      {c.title}
                      <ArrowUpRight size={16} />
                    </strong>
                    <span>{c.description}</span>
                  </button>
                ))}
              </div>
            </section>
            <section className="palette-editorial">
              <div className="section-heading">
                <div>
                  <span className="eyebrow red">A different way in / 02</span>
                  <h2>Follow a color.</h2>
                </div>
                <p>
                  Search for what an image feels like.
                  <br />
                  Build a palette. Find a new direction.
                </p>
              </div>
              <div className="editorial-palettes">
                {editorialPalettes.map((p) => (
                  <button
                    key={p.name}
                    onClick={() =>
                      search(p.query, { selectedColors: p.colors })
                    }
                  >
                    <div className="palette-blocks">
                      {p.colors.map((c) => (
                        <i key={c} style={{ background: c }} />
                      ))}
                    </div>
                    <div>
                      <span>
                        <small className="eyebrow">{p.label}</small>
                        <strong>{p.name}</strong>
                      </span>
                      <ArrowUpRight size={22} />
                    </div>
                  </button>
                ))}
              </div>
            </section>
            <section className="era-editorial">
              <span className="eyebrow">Turn back the years</span>
              <div>
                {[1920, 1930, 1940, 1950, 1960, 1970].map((y) => (
                  <button key={y} onClick={() => search(`${y}s design`)}>
                    {y}
                    <span>s ↗</span>
                  </button>
                ))}
              </div>
            </section>
          </>
        ) : view === "search" ? (
          <>
            <div className="search-toolbar">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const q = queryFromText(input, query);
                  updateQuery(q);
                }}
              >
                <Search size={20} />
                <input
                  ref={searchRef}
                  aria-label="Search the archives"
                  placeholder="Search the visual past…"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                />
                <button aria-label="Submit search">
                  <ArrowRight size={20} />
                </button>
              </form>
              <div className="search-toolbar-caption eyebrow">
                Across the public archives
              </div>
            </div>
            <div className="research-layout">
              <aside className="desktop-filters">{filters}</aside>
              <section className="results">
                <div className="results-heading">
                  <div>
                    <span className="eyebrow red">
                      Your research /{" "}
                      {query.selectedColors.length
                        ? "Color + subject"
                        : "Subject index"}
                    </span>
                    <h1>
                      {archiveCollection(query.collection)?.title ||
                        query.textQuery ||
                        "A study in color"}
                      <span>.</span>
                    </h1>
                  </div>
                  <button
                    className="outline mobile-filter-button"
                    onClick={() => setMobileFilters(true)}
                  >
                    <SlidersHorizontal size={15} />
                    Filters
                  </button>
                </div>
                <div className="results-controls">
                  <div className="results-count" aria-live="polite">
                    <strong>{visible.length.toLocaleString()}</strong>{" "}
                    {query.mediaType === "video"
                      ? "videos"
                      : query.mediaType === "image"
                        ? "images"
                        : "results"}{" "}
                    in view{" "}
                    <span>
                      ·{" "}
                      {checkingImages
                        ? `${good} archives returned`
                        : `${good} of ${query.providers.length} archives searched`}
                    </span>
                  </div>
                  <div className="sort-layout">
                    <label className="sr-only" htmlFor="sort">
                      Sort results
                    </label>
                    <select
                      id="sort"
                      value={query.sort}
                      onChange={(e) =>
                        updateQuery({ ...query, sort: e.target.value })
                      }
                    >
                      <option value="relevance">Relevance</option>
                      {query.selectedColors.length > 0 && (
                        <option value="color">Best color match</option>
                      )}
                      <option value="oldest">Oldest</option>
                      <option value="newest">Newest</option>
                      <option value="largest">Largest image</option>
                      {items.some((i) => i.addedAt) && (
                        <option value="recent">Recently added</option>
                      )}
                      <option value="random">Random order</option>
                    </select>
                    <button
                      className={`icon-button ${layout === "masonry" ? "selected" : ""}`}
                      aria-label="Masonry layout"
                      aria-pressed={layout === "masonry"}
                      onClick={() => setLayout("masonry")}
                    >
                      <Columns3 size={17} />
                    </button>
                    <button
                      className={`icon-button ${layout === "uniform" ? "selected" : ""}`}
                      aria-label="Uniform grid layout"
                      aria-pressed={layout === "uniform"}
                      onClick={() => setLayout("uniform")}
                    >
                      <LayoutGrid size={17} />
                    </button>
                  </div>
                </div>
                {query.selectedColors.length > 0 && (
                  <div className="palette-search-strip">
                    <Palette size={14} />
                    <span className="eyebrow">Palette in play</span>
                    {query.selectedColors.map((c) => (
                      <button
                        key={c}
                        style={{ background: c }}
                        aria-label={`Remove ${c}`}
                        title={c}
                        onClick={() =>
                          updateQuery({
                            ...query,
                            selectedColors: query.selectedColors.filter(
                              (x) => x !== c,
                            ),
                          })
                        }
                      />
                    ))}
                    <span className="small-note">
                      {items.filter((i) => i.dominantColors.length).length} /{" "}
                      {items.length} previews analyzed
                    </span>
                  </div>
                )}
                {!loading && done > 0 && good < query.providers.length && (
                  <details className="source-notice">
                    <summary>
                      {query.providers.length - good} archives need attention
                    </summary>
                    {Object.values(statuses)
                      .filter((s) => s.status !== "ok")
                      .map((s) => (
                        <p key={s.provider}>
                          {PROVIDERS.find((p) => p.id === s.provider)?.name}:{" "}
                          {s.message || "Temporarily unavailable"}
                        </p>
                      ))}
                    <button
                      className="text-button"
                      onClick={() => {
                        setPage(1);
                        setRetry((n) => n + 1);
                      }}
                    >
                      Retry search ↗
                    </button>
                  </details>
                )}
                {visible.length ? (
                  <ItemGrid
                    onUnavailable={omitUnavailable}
                    items={visible}
                    layout={layout}
                    onOpen={setSelected}
                    onSave={(i) => {
                      setName("");
                      setSaveItem(i);
                    }}
                    saved={saved}
                    showColors={query.selectedColors.length > 0}
                  />
                ) : checkingImages ? (
                  <div
                    className="skeleton-grid"
                    aria-label="Searching the archives"
                  >
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <div key={i} />
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <span className="eyebrow red">
                      Nothing in the files / yet
                    </span>
                    <h2>Widen the search.</h2>
                    <p>
                      Try a broader year range, another subject, or a looser
                      color match.
                      <br />
                      Filters apply to the records loaded from each archive.
                    </p>
                    {query.colorTolerance === "strict" && (
                      <button
                        className="primary"
                        onClick={() =>
                          updateQuery({ ...query, colorTolerance: "balanced" })
                        }
                      >
                        Relax color match
                      </button>
                    )}
                    <div>
                      {[
                        "Christmas",
                        "Travel poster",
                        "Santa Claus",
                        "Winter",
                        "Department store",
                      ].map((p) => (
                        <button
                          className="text-button"
                          key={p}
                          onClick={() => search(p)}
                        >
                          {p} ↗
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <InfiniteResults
                  key={serializeQuery(query)}
                  enabled={Object.values(statuses).some((s) => s.hasMore)}
                  busy={loading || previews.pending}
                  page={page}
                  onNext={nextPage}
                />
              </section>
            </div>
          </>
        ) : (
          <section className="collections-page">
            <div className="section-heading">
              <div>
                <span className="eyebrow red">
                  Your research / kept together
                </span>
                <h1>{board ? board.name : "The things you keep."}</h1>
              </div>
              <button
                className="primary"
                onClick={() => {
                  setName("");
                  setBoardDialog(true);
                }}
              >
                <Plus size={16} />
                New collection
              </button>
            </div>
            <p className="storage-note">
              Saved on this browser. Original credits and source links stay with
              every image.
            </p>
            {board ? (
              <>
                <button
                  className="text-button"
                  onClick={() => setActiveBoard(null)}
                >
                  ← All collections
                </button>
                {board.colors.length > 0 && (
                  <button
                    className="text-button"
                    onClick={() => {
                      setInput("");
                      updateQuery({
                        ...defaultQuery,
                        selectedColors: board.colors,
                      });
                    }}
                  >
                    Search collection palette ↗
                  </button>
                )}
                <ItemGrid
                  onUnavailable={omitUnavailable}
                  items={visible}
                  layout={layout}
                  onOpen={setSelected}
                  onSave={(i) => {
                    setName("");
                    setSaveItem(i);
                  }}
                  saved={saved}
                />
                {board.items.length > 0 && (
                  <details className="manage-board">
                    <summary>Manage saved items</summary>
                    {board.items.map((i) => (
                      <div key={i.id}>
                        <span>{i.title}</span>
                        <button
                          onClick={() =>
                            persistBoards(
                              boards.map((b) =>
                                b.id === board.id
                                  ? {
                                      ...b,
                                      items: b.items.filter(
                                        (x) => x.id !== i.id,
                                      ),
                                    }
                                  : b,
                              ),
                            )
                          }
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </details>
                )}
                {!board.items.length && (
                  <div className="empty-state">
                    <FolderOpen size={32} />
                    <h2>Your next discovery goes here.</h2>
                    <button
                      className="text-button"
                      onClick={() => search("poster")}
                    >
                      Explore the archives ↗
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                {boards.length ? (
                  <div className="boards-grid">
                    {boards.map((b) => (
                      <button
                        className="board-card"
                        key={b.id}
                        onClick={() => setActiveBoard(b.id)}
                      >
                        <div className="board-cover">
                          {b.items.slice(0, 4).map((i) => (
                            <div
                              key={i.id}
                              style={{
                                backgroundImage: `url("${i.thumbnailUrl.replaceAll('"', "%22")}")`,
                              }}
                            />
                          ))}
                          {!b.items.length && <FolderOpen size={36} />}
                        </div>
                        <h2>
                          {b.name}
                          <ArrowUpRight size={18} />
                        </h2>
                        <span className="eyebrow">
                          {b.items.length} saved records
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <Bookmark size={30} />
                    <h2>Make room for an idea.</h2>
                    <p>
                      Save images into collections as you explore.
                      <br />A moodboard, a reference library, a place to begin.
                    </p>
                    <button
                      className="primary"
                      onClick={() => {
                        discoverySeed.current = Math.floor(
                          Math.random() * 2147483647,
                        );
                        setRetry((n) => n + 1);
                      }}
                    >
                      Find your first image <ArrowRight size={16} />
                    </button>
                  </div>
                )}
                <div className="saved-palettes-section">
                  <span className="eyebrow red">Your color library</span>
                  <h2>Saved palettes</h2>
                  {palettes.length ? (
                    <div className="saved-palettes">
                      {palettes.map((p) => (
                        <div key={p.id}>
                          <button
                            onClick={() => {
                              setInput("");
                              updateQuery({
                                ...defaultQuery,
                                selectedColors: p.colors,
                              });
                            }}
                          >
                            <span className="palette-strip">
                              {p.colors.map((c) => (
                                <i key={c} style={{ background: c }} />
                              ))}
                            </span>
                            {p.name} ↗
                          </button>
                          <button
                            className="icon-button"
                            aria-label={`Delete ${p.name} palette`}
                            onClick={() => {
                              const next = palettes.filter(
                                (x) => x.id !== p.id,
                              );
                              try {
                                localResearchStorage.savePalettes(next);
                                setPalettes(next);
                              } catch {
                                notify("Could not update saved palettes.");
                              }
                            }}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p>
                      Choose colors in search, then save a palette for later.
                    </p>
                  )}
                </div>
              </>
            )}
          </section>
        )}
      </main>
      <footer className="site-footer">
        <span>
          ARCHIVE SCOUT <i>© {new Date().getFullYear()}</i>
        </span>
        <p>The past is full of possibilities.</p>
        <button className="text-button" onClick={() => setAbout(true)}>
          Sources & rights <ArrowUpRight size={12} />
        </button>
      </footer>
      {mobileFilters && (
        <Dialog
          title="Search filters"
          onClose={() => setMobileFilters(false)}
          className="filter-dialog"
        >
          {filters}
          <button className="primary" onClick={() => setMobileFilters(false)}>
            Show {visible.length} results <ArrowRight size={16} />
          </button>
        </Dialog>
      )}
      {selectedCurrent && (
        <Detail
          item={selectedCurrent}
          onUnavailable={omitUnavailable}
          onClose={() => setSelected(null)}
          onSave={() => {
            setName("");
            setSaveItem(selectedCurrent);
          }}
          onPalette={usePalette}
          onSimilar={() => {
            const q = {
              ...defaultQuery,
              ...similarityService.related(selectedCurrent),
            };
            setSelected(null);
            setInput(q.textQuery);
            updateQuery(q);
            notify("Related search uses metadata and detected colors.");
          }}
          onMove={(d) => {
            const list = visible;
            const idx = list.findIndex((i) => i.id === selectedCurrent.id);
            if (list.length)
              setSelected(list[(idx + d + list.length) % list.length]);
          }}
          notify={notify}
        />
      )}
      {(saveItem || boardDialog) && (
        <Dialog
          title={saveItem ? "Save to collection" : "New collection"}
          onClose={() => {
            setSaveItem(null);
            setBoardDialog(false);
          }}
          className="small-dialog"
        >
          <span className="eyebrow red">Your research library</span>
          <h2>{saveItem ? "Keep this discovery." : "Start a collection."}</h2>
          {saveItem && (
            <>
              <p>{saveItem.title}</p>
              <div className="board-options">
                {boards.map((b) => (
                  <button key={b.id} onClick={() => addToBoard(b.id)}>
                    <FolderOpen size={17} />
                    {b.name}
                    <span>
                      {b.items.some((i) => i.id === saveItem.id) ? (
                        <Check size={16} />
                      ) : (
                        <Plus size={16} />
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createBoard();
            }}
          >
            <label className="field-label">
              New collection name
              <input
                autoFocus
                placeholder="e.g. Mid-century Christmas"
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <button className="primary" disabled={!name.trim()}>
              Create {saveItem ? "& save" : ""}
              <Plus size={16} />
            </button>
          </form>
        </Dialog>
      )}
      {paletteDialog && (
        <Dialog
          title="Save palette"
          onClose={() => setPaletteDialog(false)}
          className="small-dialog"
        >
          <span className="eyebrow red">Your color library</span>
          <h2>Give it a name.</h2>
          <div className="palette-strip">
            {query.selectedColors.map((c) => (
              <i key={c} style={{ background: c }} />
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              savePalette();
            }}
          >
            <label className="field-label">
              Palette name
              <input
                autoFocus
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Atomic diner"
              />
            </label>
            <button className="primary" disabled={!name.trim()}>
              Save palette <ArrowRight size={16} />
            </button>
          </form>
        </Dialog>
      )}
      {about && (
        <Dialog
          title="About Archive Scout"
          onClose={() => setAbout(false)}
          className="small-dialog about-dialog"
        >
          <span className="eyebrow red">A field guide, not a vault</span>
          <h2>
            The image belongs
            <br />
            to its history.
          </h2>
          <p>
            Archive Scout brings public archive records into one visual research
            space. Images and descriptions remain connected to their original
            institutions. Video results include playback and archive file links.
          </p>
          <p>
            Public domain and CC0 labels are based on explicit source metadata.
            Uncertain records say “Check source.” Open the rights details and
            original record before using an image.
          </p>
          <p>
            Search and filters work on the records loaded so far. Color analysis
            uses preview images; it is a visual aid, not a historical color
            standard.
          </p>
          <div className="about-sources">
            {PROVIDERS.map((p) => (
              <span key={p.id}>
                <i>{p.code}</i>
                {p.name}
              </span>
            ))}
          </div>
          <p className="small-note">
            Tulsa Library, Oklahoma Digital Prairie, Internet Archive, and NASA
            need no API keys. DPLA and Smithsonian require server API keys.
            Collections and palettes are stored only in this browser. Related
            searches use metadata and colors; no image embedding service is
            configured.
          </p>
        </Dialog>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={15} />
          {toast}
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </>
  );
}
