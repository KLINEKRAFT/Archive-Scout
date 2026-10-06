import { countryCodes } from "./countries";
import { PROVIDERS, type SearchQuery, type ProviderId } from "./types";
export const defaultQuery: SearchQuery = {
  textQuery: "",
  mediaType: "all",
  countries: [],
  types: [],
  rights: [],
  providers: PROVIDERS.map((p) => p.id),
  orientation: "any",
  minimumSize: 0,
  selectedColors: [],
  colorMode: "palette",
  colorTolerance: "balanced",
  sort: "relevance",
  page: 1,
};
export function parseQuery(p: URLSearchParams): SearchQuery {
  const number = (k: string) =>
    p.get(k) && Number.isFinite(Number(p.get(k)))
      ? Number(p.get(k))
      : undefined;
  return {
    ...defaultQuery,
    textQuery: (p.get("q") ?? "").slice(0, 200),
    yearStart: number("from"),
    yearEnd: number("to"),
    mediaType:
      p.get("media") === "video"
        ? "video"
        : p.get("media") === "image"
          ? "image"
          : "all",
    countries: countryCodes(p.getAll("country")),
    types: p.getAll("type"),
    rights: p.getAll("rights"),
    providers: p.has("sources")
      ? (p
          .get("sources")!
          .split(",")
          .filter((id) => PROVIDERS.some((s) => s.id === id)) as ProviderId[])
      : defaultQuery.providers,
    orientation: p.get("orientation") ?? "any",
    minimumSize: number("size") ?? 0,
    selectedColors: p
      .getAll("color")
      .map((c) => `#${c.replace("#", "")}`)
      .filter((c) => /^#[0-9a-f]{6}$/i.test(c))
      .slice(0, 5),
    colorMode: p.get("mode") === "any" ? "any" : "palette",
    colorTolerance: ["loose", "strict"].includes(p.get("match") ?? "")
      ? (p.get("match") as "loose" | "strict")
      : "balanced",
    sort: p.get("sort") ?? "relevance",
    page: Math.min(100, Math.max(1, number("page") ?? 1)),
  };
}
export function serializeQuery(q: SearchQuery): string {
  const p = new URLSearchParams();
  if (q.mediaType !== "all") p.set("media", q.mediaType);
  if (q.textQuery) p.set("q", q.textQuery);
  if (q.yearStart !== undefined) p.set("from", String(q.yearStart));
  if (q.yearEnd !== undefined) p.set("to", String(q.yearEnd));
  q.countries.forEach((c) => p.append("country", c));
  q.types.forEach((t) => p.append("type", t));
  q.rights.forEach((r) => p.append("rights", r));
  if (q.providers.length !== PROVIDERS.length)
    p.set("sources", q.providers.join(","));
  q.selectedColors.forEach((c) => p.append("color", c.slice(1)));
  if (q.orientation !== "any") p.set("orientation", q.orientation);
  if (q.minimumSize) p.set("size", String(q.minimumSize));
  if (q.colorMode !== "palette") p.set("mode", q.colorMode);
  if (q.colorTolerance !== "balanced") p.set("match", q.colorTolerance);
  if (q.sort !== "relevance") p.set("sort", q.sort);
  return p.toString();
}
export function queryFromText(
  text: string,
  previous = defaultQuery,
): SearchQuery {
  const decade = text.match(/\b(1[89]\d0|20[012]0)s\b/);
  const exact = text.match(/\b(1[89]\d{2}|20[012]\d)\b/);
  const year = decade
    ? Number(decade[1])
    : exact
      ? Number(exact[1])
      : undefined;
  return {
    ...previous,
    textQuery: text.trim(),
    yearStart: year,
    yearEnd: year === undefined ? undefined : year + (decade ? 9 : 0),
    page: 1,
  };
}
export function providerText(q: SearchQuery): string {
  return (
    q.textQuery
      .replace(/\b(?:1[89]\d{2}|20[012]\d)s?\b/g, "")
      .replace(/\s+/g, " ")
      .trim() || "design"
  );
}
