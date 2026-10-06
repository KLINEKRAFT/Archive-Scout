import { test } from "node:test";
import assert from "node:assert/strict";
import { discoveryMix } from "../lib/discovery";
import { item } from "../lib/normalize";
import { admitPage } from "../lib/pagination";
import { defaultQuery, parseQuery, serializeQuery } from "../lib/query";
import { collectionQuery } from "../lib/collections";
import { loc } from "../lib/providers/loc";
import { internetArchive } from "../lib/providers/internet-archive";
import { allowsHistoricalVideo } from "../lib/video-policy";
const photo = (id: string) =>
  item("aic", {}, { providerItemId: id, title: "Photo" });
test("discovery interleaves archives and preserves stable shuffled order", () => {
  const a = Array.from({ length: 12 }, (_, i) => photo(String(i)));
  const b = item("nasa", {}, { providerItemId: "moon", title: "Moon" });
  const mixed = discoveryMix([...a, b], 123);
  assert.equal(mixed.length, 13);
  assert.equal(mixed[1].provider, "nasa");
  assert.deepEqual(mixed, discoveryMix([...a, b], 123));
  assert.equal(new Set(mixed.map((i) => i.id)).size, 13);
});
test("pagination stops repeated pages but continues past a filtered empty page", () => {
  const seen = new Set<string>();
  const result = {
    provider: "aic" as const,
    items: [photo("1")],
    total: 400,
    hasMore: true,
    status: "ok" as const,
  };
  assert.equal(admitPage(result, seen, 1).hasMore, true);
  assert.equal(admitPage({ ...result, items: [] }, seen, 2).hasMore, true);
  assert.equal(admitPage(result, seen, 3).hasMore, false);
  assert.equal(parseQuery(new URLSearchParams("page=101")).page, 101);
  assert.equal(parseQuery(new URLSearchParams("page=2.5")).page, 2);
});
test("curated collection scope survives URL state", () => {
  const q = { ...defaultQuery, ...collectionQuery("wpa") };
  const restored = parseQuery(new URLSearchParams(serializeQuery(q)));
  assert.equal(restored.collection, "wpa");
  assert.deepEqual(restored.providers, ["loc"]);
  assert.equal(restored.yearEnd, 1943);
  assert.equal(
    parseQuery(new URLSearchParams("collection=arbitrary-injection"))
      .collection,
    "",
  );
});
test("LOC extracts playable films and rejects modern or undated footage", () => {
  const raw = {
    id: "https://www.loc.gov/item/123/",
    title: "Film",
    date: "1944",
    original_format: ["film, video"],
    image_url: ["https://tile.loc.gov/poster.jpg"],
    resources: [
      { video: "https://tile.loc.gov/film.mp4", duration: 125, files: 1 },
    ],
  };
  const film = loc.normalizeItem(raw);
  assert.equal(film.mediaType, "video");
  assert.equal(film.videoUrl, "https://tile.loc.gov/film.mp4");
  assert.equal(film.duration, "2:05");
  assert.equal(allowsHistoricalVideo(film), true);
  assert.equal(
    allowsHistoricalVideo(loc.normalizeItem({ ...raw, date: "1981" })),
    false,
  );
  assert.equal(
    allowsHistoricalVideo(loc.normalizeItem({ ...raw, date: undefined })),
    false,
  );
});
test("print scans keep public PDF choices and classify catalogs and comics", () => {
  const record = {
    metadata: {
      identifier: "catalog",
      title: "Catalog",
      date: "1898",
      mediatype: "texts",
      subject: ["trade catalogs"],
    },
    files: [
      { name: "scan.pdf", format: "PDF" },
      { name: "private.pdf", private: true },
    ],
  };
  const catalog = internetArchive.normalizeItem(record);
  assert.equal(catalog.objectType, "Catalog");
  assert.equal(catalog.downloadOptions.length, 1);
  assert.ok(catalog.previewUrl);
  assert.equal(catalog.videoUrl, undefined);
  assert.equal(
    internetArchive.normalizeItem({
      ...record,
      metadata: { ...record.metadata, title: "Comic", subject: ["comics"] },
    }).objectType,
    "Comic",
  );
});
test("collection adapters use scoped searches and retain the video cutoff", async () => {
  const original = globalThis.fetch;
  const urls: URL[] = [];
  globalThis.fetch = async (input) => {
    const u = new URL(String(input));
    urls.push(u);
    return Response.json(
      u.hostname === "archive.org"
        ? { response: { docs: [], numFound: 0 } }
        : { results: [], pagination: {} },
    );
  };
  try {
    await loc.search(
      { ...defaultQuery, ...collectionQuery("wpa") },
      new AbortController().signal,
    );
    assert.equal(
      urls[0].pathname,
      "/collections/works-progress-administration-posters/",
    );
    assert.equal(urls[0].searchParams.has("q"), false);
    await loc.search(
      { ...defaultQuery, mediaType: "video", yearEnd: 2026 },
      new AbortController().signal,
    );
    assert.equal(urls[1].searchParams.get("dates"), "1800/1980");
    await internetArchive.search(
      { ...defaultQuery, ...collectionQuery("catalogs") },
      new AbortController().signal,
    );
    assert.match(urls[2].searchParams.get("q")!, /subject:"trade catalogs"/);
    assert.match(urls[2].searchParams.get("q")!, /mediatype:texts/);
  } finally {
    globalThis.fetch = original;
  }
});
