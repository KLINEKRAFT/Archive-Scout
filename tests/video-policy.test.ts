import test from "node:test";
import assert from "node:assert/strict";
import { allowsHistoricalVideo, videoYears } from "../lib/video-policy";
import { internetArchive } from "../lib/providers/internet-archive";
import { nasa } from "../lib/providers/nasa";
import { defaultQuery } from "../lib/query";
import { filterAndRank } from "../lib/search";

function film(date?: string) {
  return internetArchive.normalizeItem({
    metadata: {
      identifier: "test",
      mediatype: "movies",
      title: "1960s footage",
      date,
    },
    files: [{ name: "film.mp4" }],
  });
}

test("video cutoff includes 1980 and rejects newer, undated, uncertain and crossing ranges", () => {
  for (const date of ["1963", "1980", "1980-12-31", "1960s", "1970–1980"])
    assert.equal(allowsHistoricalVideo(film(date)), true, date);
  for (const date of [
    undefined,
    "1981",
    "1979–1982",
    "1980s",
    "circa 1980",
    "1980?",
    "1979-82",
    "1980–1970",
  ])
    assert.equal(allowsHistoricalVideo(film(date)), false, String(date));
  assert.equal(
    allowsHistoricalVideo({ ...film("1979"), dateDisplay: "1979-82" }),
    false,
  );
  assert.deepEqual(videoYears("1969-07-20T00:00:00Z"), {
    yearStart: 1969,
    yearEnd: 1969,
  });
});

test("all-media and video searches cannot override the cutoff; recent images remain", () => {
  const old = {
    ...film("1980"),
    id: "old",
    sourceUrl: "https://example.org/old",
  };
  const recent = {
    ...film("1981"),
    id: "new",
    sourceUrl: "https://example.org/new",
  };
  const image = {
    ...recent,
    id: "image",
    sourceUrl: "https://example.org/image",
    mediaType: "image" as const,
  };
  assert.deepEqual(
    filterAndRank([old, recent, image], defaultQuery).map((i) => i.id),
    ["old", "image"],
  );
  assert.equal(
    filterAndRank([recent], {
      ...defaultQuery,
      mediaType: "video",
      yearEnd: 2026,
    }).length,
    0,
  );
  assert.equal(
    filterAndRank([image], { ...defaultQuery, yearStart: 1981 }).length,
    1,
  );
});

test("Internet Archive uses production dates, never upload timestamps or title years", () => {
  assert.equal(
    allowsHistoricalVideo(
      internetArchive.normalizeItem({
        metadata: {
          identifier: "test",
          mediatype: "movies",
          title: "1960 commercial",
          addeddate: "1960-01-01",
        },
      }),
    ),
    false,
  );
  const item = internetArchive.normalizeItem({
    metadata: {
      identifier: "test",
      mediatype: "movies",
      proddate: "1971",
      date: "2020",
    },
  });
  assert.equal(item.yearStart, 1971);
  assert.equal(allowsHistoricalVideo(item), true);
  const modernNASA = nasa.normalizeItem({
    data: [
      {
        nasa_id: "test",
        title: "Apollo 1969",
        media_type: "video",
        date_created: "2020-01-01",
      },
    ],
  });
  assert.equal(allowsHistoricalVideo(modernNASA), false);
});

test("provider queries cap videos and enforce metadata dates even if upstream ignores the query", async () => {
  const original = globalThis.fetch;
  const queries: URL[] = [];
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    queries.push(url);
    if (url.pathname.endsWith("advancedsearch.php"))
      return Response.json({
        response: { docs: [{ identifier: "modern" }], numFound: 1 },
      });
    if (url.pathname.startsWith("/metadata/"))
      return Response.json({
        metadata: { identifier: "modern", mediatype: "movies", date: "1981" },
        files: [{ name: "film.mp4" }],
      });
    return Response.json({ collection: { items: [] } });
  };
  try {
    const signal = new AbortController().signal;
    const results = await internetArchive.search(
      { ...defaultQuery, mediaType: "video", yearEnd: 2026 },
      signal,
    );
    assert.equal(results.items.length, 0);
    assert.match(queries[0].searchParams.get("q")!, /TO 1980/);
    await internetArchive.search(defaultQuery, signal);
    const allQuery = queries
      .find((u) => u.searchParams.get("q")?.includes("mediatype:image"))!
      .searchParams.get("q")!;
    assert.match(allQuery, /mediatype:movies AND year:\[1800 TO 1980\]/);
    await nasa.search(
      { ...defaultQuery, mediaType: "video", yearEnd: 2026 },
      signal,
    );
    assert.equal(queries.at(-1)!.searchParams.get("year_end"), "1980");
    const count = queries.length;
    for (const provider of [nasa, internetArchive]) {
      const empty = await provider.search(
        { ...defaultQuery, mediaType: "video", yearStart: 1981 },
        signal,
      );
      assert.equal(empty.items.length, 0);
    }
    assert.equal(queries.length, count);
  } finally {
    globalThis.fetch = original;
  }
});
