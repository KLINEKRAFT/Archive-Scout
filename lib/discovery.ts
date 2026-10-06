import type { ArchiveItem } from "./types";
export const DISCOVERY_SEARCHES = [
  { provider: "aic", text: "photography" },
  { provider: "cma", text: "photography" },
  { provider: "loc", text: "street photography" },
  { provider: "nasa", text: "Apollo" },
] as const;
export function discoveryMix(
  items: ArchiveItem[],
  seed: number,
): ArchiveItem[] {
  const score = (id: string) => {
    let n = seed;
    for (const c of id) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
    return n >>> 0;
  };
  const groups = DISCOVERY_SEARCHES.map((s) =>
    items
      .filter((i) => i.provider === s.provider)
      .sort((a, b) => score(a.id) - score(b.id)),
  );
  const output: ArchiveItem[] = [];
  for (let row = 0; groups.some((g) => row < g.length); row++)
    for (const g of groups) if (g[row]) output.push(g[row]);
  return output;
}
