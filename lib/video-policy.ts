import type { ArchiveItem } from "./types";

export const VIDEO_YEAR_LIMIT = 1980;

// Never infer a film's production year from its title or upload timestamp.
export function videoYears(value: unknown): {
  yearStart?: number;
  yearEnd?: number;
} {
  const date = String(value ?? "").trim();
  const exact = date.match(
    /^(\d{4})(?:-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])(?:T.*)?)?$/,
  );
  if (exact) return { yearStart: Number(exact[1]), yearEnd: Number(exact[1]) };
  const decade = date.match(/^(\d{3}0)s$/);
  if (decade)
    return { yearStart: Number(decade[1]), yearEnd: Number(decade[1]) + 9 };
  const range = date.match(/^(\d{4})\s*[-–/]\s*(\d{4})$/);
  if (range) return { yearStart: Number(range[1]), yearEnd: Number(range[2]) };
  // Approximate, open-ended, abbreviated and unrecognized dates remain unknown.
  return {};
}

export function allowsHistoricalVideo(item: ArchiveItem): boolean {
  if (item.mediaType !== "video") return true;
  // Recheck display dates so older saved records cannot bypass stricter parsing.
  const parsed = videoYears(item.dateDisplay);
  if (
    parsed.yearStart === undefined ||
    parsed.yearEnd === undefined ||
    parsed.yearEnd > VIDEO_YEAR_LIMIT
  )
    return false;
  const start = item.yearStart;
  const end = item.yearEnd ?? start;
  return (
    Number.isInteger(start) &&
    Number.isInteger(end) &&
    start! >= 1800 &&
    end! >= start! &&
    end! <= VIDEO_YEAR_LIMIT
  );
}
