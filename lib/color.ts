import type { Color } from "./types";
export const SWATCHES = [
  ["Christmas red", "#b83a2d"],
  ["Forest green", "#315842"],
  ["Evergreen", "#203e36"],
  ["Cream", "#eee1c4"],
  ["Warm white", "#f5f1e7"],
  ["Mustard", "#c5a03b"],
  ["Ochre", "#af7f2c"],
  ["Burnt orange", "#bb5d34"],
  ["Avocado", "#838642"],
  ["Olive", "#66704a"],
  ["Chocolate", "#604235"],
  ["Sky blue", "#6d9eb6"],
  ["Powder blue", "#adc7cc"],
  ["Cobalt", "#335aa1"],
  ["Navy", "#28394c"],
  ["Teal", "#337777"],
  ["Turquoise", "#58aaa4"],
  ["Dusty pink", "#c59699"],
  ["Coral", "#d67a64"],
  ["Burgundy", "#773d49"],
  ["Lavender", "#a799b7"],
  ["Black", "#232320"],
] as const;
export function hexToLab(hex: string): number[] {
  const v = hex.replace("#", "");
  const rgb = [0, 2, 4]
    .map((i) => parseInt(v.slice(i, i + 2), 16) / 255)
    .map((c) => (c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92));
  const [r, g, b] = rgb;
  const xyz = [
    (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047,
    r * 0.2126729 + g * 0.7151522 + b * 0.072175,
    (r * 0.0193339 + g * 0.119192 + b * 0.9503041) / 1.08883,
  ].map((c) => (c > 0.008856 ? Math.cbrt(c) : 7.787 * c + 16 / 116));
  return [116 * xyz[1] - 16, 500 * (xyz[0] - xyz[1]), 200 * (xyz[1] - xyz[2])];
}
export function colorDistance(a: string, b: string): number {
  const x = hexToLab(a),
    y = hexToLab(b);
  return Math.hypot(...x.map((n, i) => n - y[i]));
}
export function paletteScore(
  colors: Color[],
  selected: string[],
  mode: "any" | "palette" = "palette",
  strength: "loose" | "balanced" | "strict" = "balanced",
): number {
  if (!colors.length || !selected.length) return 0;
  const tolerance = { loose: 55, balanced: 35, strict: 20 }[strength];
  const scores = selected.map((target) =>
    colors.reduce(
      (sum, c) =>
        sum +
        Math.max(0, 1 - colorDistance(target, c.hex) / tolerance) *
          c.percentage,
      0,
    ),
  );
  return mode === "any"
    ? Math.max(...scores)
    : (scores.reduce((a, b) => a + b, 0) / scores.length) *
        (scores.filter((s) => s > 0.025).length / scores.length);
}
export function closestNamedColor(hex: string): string {
  return [...SWATCHES].sort(
    (a, b) => colorDistance(hex, a[1]) - colorDistance(hex, b[1]),
  )[0][0];
}
// Quantize a small RGBA thumbnail. Border-connected near-neutral pixels are downweighted,
// never removed, so paper-colored artwork remains searchable. Source imagery is untouched.
export function extractPalette(
  pixels: Uint8Array,
  width: number,
  height: number,
): Color[] {
  const buckets = new Map<
    string,
    { r: number; g: number; b: number; weight: number }
  >();
  for (let i = 0; i < pixels.length; i += 4) {
    const [r, g, b, a] = pixels.slice(i, i + 4);
    if (a < 128) continue;
    const x = (i / 4) % width,
      y = Math.floor(i / 4 / width);
    const border =
      x < width * 0.07 ||
      x > width * 0.93 ||
      y < height * 0.07 ||
      y > height * 0.93;
    const neutral = Math.max(r, g, b) - Math.min(r, g, b) < 24;
    const weight = border && neutral ? 0.2 : 1;
    const key = [r, g, b].map((v) => Math.floor(v / 24)).join(",");
    const old = buckets.get(key) || { r: 0, g: 0, b: 0, weight: 0 };
    old.r += r * weight;
    old.g += g * weight;
    old.b += b * weight;
    old.weight += weight;
    buckets.set(key, old);
  }
  const hex = (a: number[]) =>
    "#" + a.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
  const all = [...buckets.values()].sort((a, b) => b.weight - a.weight);
  const clusters: { hex: string; weight: number }[] = [];
  for (const b of all) {
    const h = hex([b.r / b.weight, b.g / b.weight, b.b / b.weight]);
    const near = clusters.find((c) => colorDistance(c.hex, h) < 17);
    if (near) near.weight += b.weight;
    else clusters.push({ hex: h, weight: b.weight });
  }
  const total = clusters.reduce((s, c) => s + c.weight, 0);
  return clusters
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 8)
    .map((c) => ({ hex: c.hex, percentage: c.weight / total }));
}
