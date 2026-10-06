import type { ProviderResult } from "./types";
// Some APIs silently clamp out-of-range page numbers. Never loop on a repeated page.
export function admitPage(
  result: ProviderResult,
  seen: Set<string>,
  page: number,
): ProviderResult {
  const repeated =
    page > 1 &&
    result.items.length > 0 &&
    result.items.every((i) => seen.has(i.id));
  for (const item of result.items) seen.add(item.id);
  return repeated ? { ...result, hasMore: false } : result;
}
