import { test } from "node:test";
import assert from "node:assert/strict";
import { item } from "../lib/normalize";
import {
  canonicalAssetUrl,
  deduplicate,
  uniqueRecords,
} from "../lib/duplicates";
import { filterAndRank } from "../lib/search";
import { defaultQuery, parseQuery, serializeQuery } from "../lib/query";
import { vam } from "../lib/providers/vam";
import { gallica, parseGallica } from "../lib/providers/gallica";
const image = (id: string, extra = {}) =>
  item("vam", {}, { providerItemId: id, title: "Advertising", ...extra });
test("cross-source aliases merge transitively in any order and survive saving", () => {
  const a = image("a", {
    sourceUrl: "https://collections.vam.ac.uk/item/O123/title",
    thumbnailUrl: "https://img.test/one.jpg",
  });
  const b = image("b", {
    sourceUrl: "http://collections.vam.ac.uk/item/O123/?utm_source=eu",
    thumbnailUrl: "https://img.test/two.jpg",
  });
  const c = image("c", { thumbnailUrl: "https://img.test/two.jpg" });
  for (const records of [
    [a, b, c],
    [c, a, b],
    [b, c, a],
  ])
    assert.equal(deduplicate(records).length, 1);
  assert.equal(deduplicate([...deduplicate([a, b]), c]).length, 1);
});
test("IIIF derivatives and Gallica ARKs share identity but separate images remain separate", () => {
  assert.equal(
    canonicalAssetUrl(
      "https://framemark.vam.ac.uk/collections/123/full/!400,400/0/default.jpg",
    ),
    canonicalAssetUrl(
      "https://framemark.vam.ac.uk/collections/123/full/!800,800/0/default.jpg",
    ),
  );
  assert.equal(
    canonicalAssetUrl("https://gallica.bnf.fr/ark:/12148/btv123.thumbnail"),
    canonicalAssetUrl(
      "https://gallica.bnf.fr/iiif/ark:/12148/btv123/f1/full/400,/0/native.jpg",
    ),
  );
  assert.equal(deduplicate([image("a"), image("b")]).length, 2);
  assert.equal(
    deduplicate([
      image("a", { thumbnailUrl: "https://img.test/?id=1" }),
      image("b", { thumbnailUrl: "https://img.test/?id=2" }),
    ]).length,
    2,
  );
});
test("repeated pages merge IDs but retain working alternatives until validation", () => {
  const broken = image("a", { sourceUrl: "https://source.test/record" });
  const good = image("b", {
    sourceUrl: "https://source.test/record",
    verifiedPreviewUrl: "https://img.test/good",
  });
  assert.equal(uniqueRecords([broken, good, good]).length, 2);
  assert.equal(
    deduplicate([broken, good].filter((i) => i.verifiedPreviewUrl)).length,
    1,
  );
  assert.equal(
    deduplicate([broken, good].filter((i) => i.verifiedPreviewUrl))[0].id,
    good.id,
  );
});
test("identical pixels deduplicate images, never different videos with a shared poster", () => {
  assert.equal(
    deduplicate([
      image("a", { visualFingerprint: "same" }),
      image("b", { visualFingerprint: "same" }),
    ]).length,
    1,
  );
  assert.equal(
    deduplicate([
      image("a", {
        mediaType: "video",
        visualFingerprint: "same",
        thumbnailUrl: "https://img.test/poster",
      }),
      image("b", {
        mediaType: "video",
        visualFingerprint: "same",
        thumbnailUrl: "https://img.test/poster",
      }),
    ]).length,
    2,
  );
});
test("country filtering precedes dedup and persists in URLs", () => {
  const q = { ...defaultQuery, countries: ["FR"] };
  assert.deepEqual(
    parseQuery(new URLSearchParams(serializeQuery(q))).countries,
    ["FR"],
  );
  const records = [
    image("gb", { sourceUrl: "https://img.test/common" }),
    image("fr", {
      archiveCountries: ["FR"],
      sourceUrl: "https://img.test/common",
    }),
  ];
  assert.equal(deduplicate(filterAndRank(records, q))[0].providerItemId, "fr");
});
test("V&A keeps catalog date bounds and never substitutes accession year or grants image rights", () => {
  const r = vam.normalizeItem({
    record: {
      systemNumber: "O123",
      titles: [{ title: "Poster" }],
      images: ["2000AB12"],
      accessionYear: 2003,
      productionDates: [
        {
          date: { text: "1965", earliest: "1965-01-01", latest: "1965-12-31" },
        },
      ],
    },
  });
  assert.equal(r.yearStart, 1965);
  assert.deepEqual(r.archiveCountries, ["GB"]);
  assert.equal(r.commercialUseStatus, "unknown");
  assert.equal(
    vam.normalizeItem({ record: { systemNumber: "O124", accessionYear: 2003 } })
      .yearStart,
    undefined,
  );
});
test("Gallica parses repeated Dublin Core fields, rejects entities, and retains reuse caveat", () => {
  const r = parseGallica(
    "<srw:searchRetrieveResponse><srw:numberOfRecords>1</srw:numberOfRecords><srw:records><srw:record><srw:recordData><oai_dc:dc><dc:identifier>https://gallica.bnf.fr/ark:/12148/btv123</dc:identifier><dc:title>Poster</dc:title><dc:date>1968</dc:date><dc:subject>Design</dc:subject><dc:subject>France</dc:subject><dc:rights>public domain</dc:rights></oai_dc:dc></srw:recordData></srw:record></srw:records></srw:searchRetrieveResponse>",
  );
  const normalized = gallica.normalizeItem(r.records[0]);
  assert.equal(normalized.yearStart, 1968);
  assert.deepEqual(normalized.subjects, ["Design", "France"]);
  assert.notEqual(normalized.commercialUseStatus, "allowed");
  assert.throws(() => parseGallica('<!DOCTYPE x [<!ENTITY a "test">]><x/>'));
});
