import { plain, safeUrl, years } from "../normalize";
import { videoYears } from "../video-policy";

export function values(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return value.flatMap(values);
  if (typeof value === "object") return Object.values(value).flatMap(values);
  return [plain(value)].filter(Boolean);
}
export function mediaUrl(value: unknown): string {
  const url = safeUrl(value);
  if (!url) return "";
  const parsed = new URL(url);
  if (parsed.username || parsed.password) return "";
  // Modern pages cannot embed HTTP assets; verify the HTTPS counterpart in-browser.
  parsed.protocol = "https:";
  return parsed.href;
}
export function directVideo(value: unknown): string {
  return (
    values(value)
      .map(mediaUrl)
      .find((url) => {
        if (!url) return false;
        return /\.(mp4|webm)$/i.test(new URL(url).pathname);
      }) || ""
  );
}
export function catalogDate(value: unknown, video: boolean) {
  const dates = [...new Set(values(value))];
  const parsed = dates.map((date) => (video ? videoYears(date) : years(date)));
  if (
    !dates.length ||
    parsed.some(
      (date) => date.yearStart === undefined || date.yearEnd === undefined,
    )
  )
    return { dateDisplay: dates.join("; ") || "Date unknown" };
  const yearStart = Math.min(...parsed.map((date) => date.yearStart!));
  const yearEnd = Math.max(...parsed.map((date) => date.yearEnd!));
  // Standardize explicit video ranges for the shared policy's strict recheck.
  return {
    yearStart,
    yearEnd,
    dateDisplay: video
      ? yearStart === yearEnd
        ? String(yearStart)
        : `${yearStart}–${yearEnd}`
      : dates.join("; "),
  };
}
