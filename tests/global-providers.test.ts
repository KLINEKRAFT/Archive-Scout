import test from "node:test";
import assert from "node:assert/strict";
import { digitalnz } from "../lib/providers/digitalnz";
import { europeana } from "../lib/providers/europeana";
import { defaultQuery, parseQuery, serializeQuery } from "../lib/query";
import { allowsHistoricalVideo } from "../lib/video-policy";
import { catalogDate } from "../lib/providers/aggregate-media";
import { allowedImageUrl } from "../lib/image-analysis";

const nz = {
  id: 123,
  title: "Cinema advertising slide",
  category: ["Images"],
  display_date: "1960",
  thumbnail_url: "https://example.org/poster.jpg",
  rights: "Attribution + Noncommercial + ShareAlike",
  is_commercial_use: true,
  source_url: "http://api.digitalnz.org/records/123/source",
};
const eu = {
  id: "/123/poster",
  type: "IMAGE",
  title: ["Travel poster"],
  year: ["1962"],
  edmPreview: ["https://api.europeana.eu/thumbnail/v3/400/test.jpg"],
  edmIsShownBy: ["https://example.org/poster.jpg"],
  edmIsShownAt: ["https://example.org/item/1"],
  dataProvider: ["Example museum"],
  rights: ["http://creativecommons.org/publicdomain/mark/1.0/"],
};

test("global source selections survive URL state", () => {
  const q = { ...defaultQuery, providers: ["europeana", "digitalnz"] as const };
  assert.deepEqual(
    parseQuery(
      new URLSearchParams(
        serializeQuery({ ...q, providers: [...q.providers] }),
      ),
    ).providers,
    q.providers,
  );
});

test("DigitalNZ metadata permission never becomes permission to reuse its images", () => {
  const i = digitalnz.normalizeItem(nz);
  assert.equal(i.commercialUseStatus, "restricted");
  assert.equal(i.sourceUrl, "https://api.digitalnz.org/records/123/source");
  assert.equal(i.objectType, "Advertisement");
  const unknown = digitalnz.normalizeItem({ ...nz, rights: null });
  assert.equal(unknown.commercialUseStatus, "unknown");
  assert.equal(unknown.isPublicDomain, false);
});

test("Europeana search and detailed multilingual records retain institution, rights and images", () => {
  const summary = europeana.normalizeItem(eu);
  assert.equal(summary.yearStart, 1962);
  assert.equal(summary.isPublicDomain, true);
  assert.equal(summary.institution, "Example museum");
  const detail = europeana.normalizeItem({
    object: {
      about: eu.id,
      type: "IMAGE",
      europeanaAggregation: { edmPreview: eu.edmPreview[0] },
      proxies: [
        { europeanaProxy: true, dcTitle: { en: ["Enriched title"] } },
        {
          europeanaProxy: false,
          dcTitle: { en: ["Travel poster"] },
          dcDate: { def: ["1962"] },
          dcCreator: { en: ["Artist"] },
          dcRights: { en: ["All rights reserved"] },
        },
      ],
      aggregations: [
        {
          edmIsShownBy: eu.edmIsShownBy[0],
          edmIsShownAt: eu.edmIsShownAt[0],
          edmDataProvider: { en: ["Example museum"] },
          edmRights: { def: eu.rights },
        },
      ],
    },
  });
  assert.equal(detail.title, "Travel poster");
  assert.equal(detail.previewUrl, summary.previewUrl);
  assert.equal(detail.institution, summary.institution);
  assert.equal(detail.commercialUseStatus, "restricted");
});

test("aggregate video dates include all dates and never use uploaded-at metadata", () => {
  assert.deepEqual(catalogDate(["1979", "1981"], true), {
    yearStart: 1979,
    yearEnd: 1981,
    dateDisplay: "1979–1981",
  });
  for (const source of [
    digitalnz.normalizeItem({
      ...nz,
      category: ["Videos"],
      object_url: "https://example.org/film.mp4",
      display_date: "1980",
      date: ["1980-01-01"],
    }),
    europeana.normalizeItem({
      ...eu,
      type: "VIDEO",
      year: ["1980"],
      edmIsShownBy: ["https://example.org/film.webm"],
    }),
  ]) {
    assert.equal(allowsHistoricalVideo(source), true);
    assert.ok(source.videoUrl);
  }
  assert.equal(
    allowsHistoricalVideo(
      europeana.normalizeItem({ ...eu, type: "VIDEO", year: ["1979", "1981"] }),
    ),
    false,
  );
  const undated = digitalnz.normalizeItem({
    ...nz,
    category: ["Videos"],
    display_date: null,
    date: [],
    created_at: "1960",
    object_url: "https://example.org/film.mp4",
  });
  assert.equal(allowsHistoricalVideo(undated), false);
  assert.equal(
    digitalnz.normalizeItem({
      ...nz,
      category: ["Videos"],
      object_url: "https://example.org/player",
    }).videoUrl,
    undefined,
  );
});

test("global APIs send credentials only in headers, normalize envelopes, and filter unsupported previews", async () => {
  const fetchBefore = globalThis.fetch;
  const euBefore = process.env.EUROPEANA_API_KEY;
  const nzBefore = process.env.DIGITALNZ_API_KEY;
  process.env.EUROPEANA_API_KEY = "test-europeana-secret";
  process.env.DIGITALNZ_API_KEY = "test-digitalnz-secret";
  const calls: { url: URL; options: RequestInit | undefined }[] = [];
  globalThis.fetch = async (input, options) => {
    const url = new URL(String(input));
    calls.push({ url, options });
    if (url.hostname === "api.europeana.eu")
      return Response.json(
        url.pathname.endsWith("search.json")
          ? {
              success: true,
              totalResults: 4,
              items: [
                eu,
                { ...eu, id: "/123/hidden", previewNoDistribute: true },
                {
                  ...eu,
                  id: "/123/film",
                  type: "VIDEO",
                  year: ["1981"],
                  edmIsShownBy: ["https://example.org/film.mp4"],
                },
                {
                  ...eu,
                  id: "/123/player",
                  type: "VIDEO",
                  edmIsShownBy: ["https://example.org/player"],
                },
              ],
            }
          : { success: true, object: eu },
      );
    return Response.json(
      url.pathname.endsWith("/records.json")
        ? {
            search: {
              result_count: 2,
              results: [nz, { ...nz, id: 124, thumbnail_url: null }],
            },
          }
        : { record: nz },
    );
  };
  try {
    const signal = new AbortController().signal;
    assert.equal(
      (await europeana.search(defaultQuery, signal)).items.length,
      1,
    );
    assert.equal(
      (
        await digitalnz.search(
          { ...defaultQuery, yearStart: 1960, yearEnd: 1962 },
          signal,
        )
      ).items.length,
      1,
    );
    assert.equal(
      (await europeana.getItem(eu.id, signal)).providerItemId,
      eu.id,
    );
    assert.equal(
      (await digitalnz.getItem("123", signal)).providerItemId,
      "123",
    );
    for (const { url, options } of calls) {
      assert.equal(url.href.includes("secret"), false);
      const headers = new Headers(options?.headers);
      assert.equal(
        headers.get(
          url.hostname === "api.europeana.eu"
            ? "X-Api-Key"
            : "Authentication-Token",
        ),
        url.hostname === "api.europeana.eu"
          ? "test-europeana-secret"
          : "test-digitalnz-secret",
      );
      assert.equal(options?.redirect, "error");
    }
    assert.match(
      calls[0].url.searchParams.get("qf")!,
      /TYPE:VIDEO AND YEAR:\[1800 TO 1980\]/,
    );
    assert.deepEqual(calls[1].url.searchParams.getAll("or[year][]"), [
      "1960",
      "1961",
      "1962",
    ]);
    await assert.rejects(europeana.getItem("/../secret", signal), /Invalid/);
    await assert.rejects(digitalnz.getItem("../secret", signal), /Invalid/);
    delete process.env.EUROPEANA_API_KEY;
    assert.equal(
      (await europeana.search(defaultQuery, signal)).status,
      "needs-key",
    );
    delete process.env.DIGITALNZ_API_KEY;
    await digitalnz.search(defaultQuery, signal);
    assert.equal(
      new Headers(calls.at(-1)!.options?.headers).has("Authentication-Token"),
      false,
    );
  } finally {
    globalThis.fetch = fetchBefore;
    if (euBefore === undefined) delete process.env.EUROPEANA_API_KEY;
    else process.env.EUROPEANA_API_KEY = euBefore;
    if (nzBefore === undefined) delete process.env.DIGITALNZ_API_KEY;
    else process.env.DIGITALNZ_API_KEY = nzBefore;
  }
});

test("thumbnail proxy expands to verified hosts only", () => {
  assert.equal(allowedImageUrl(eu.edmPreview[0]), true);
  assert.equal(
    allowedImageUrl("https://d28dhd8eubcyz4.cloudfront.net/preview.jpg"),
    true,
  );
  assert.equal(
    allowedImageUrl("https://attacker.cloudfront.net/preview.jpg"),
    false,
  );
});
