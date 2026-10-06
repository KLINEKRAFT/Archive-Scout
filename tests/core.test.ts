import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyRights } from "../lib/rights";
import { extractPalette, colorDistance, paletteScore } from "../lib/color";
import {
  parseQuery,
  serializeQuery,
  queryFromText,
  defaultQuery,
} from "../lib/query";
import { filterAndRank, deduplicate } from "../lib/search";
import { item, iiif } from "../lib/normalize";
import { aic } from "../lib/providers/aic";
import { cma } from "../lib/providers/cma";
import { commons } from "../lib/providers/commons";
import { smithsonian } from "../lib/providers/smithsonian";
import { allowedImageUrl } from "../lib/image-analysis";
test("rights never promote uncertainty or restrictions to open use", () => {
  for (const s of [
    "No known restrictions",
    "Public domain status unverified",
    "Not public domain",
    "CC BY-NC 4.0",
    "This archive includes public domain material",
    "",
  ])
    assert.equal(classifyRights(s).isPublicDomain, false);
  assert.equal(
    classifyRights("CC BY-NC 4.0").commercialUseStatus,
    "restricted",
  );
  assert.equal(classifyRights("Public domain").isPublicDomain, true);
  assert.equal(classifyRights("CC0").isCC0, true);
  assert.equal(
    classifyRights(
      "CC BY-SA 4.0",
      "https://creativecommons.org/licenses/by-sa/4.0/",
    ).requiresAttribution,
    true,
  );
  assert.equal(
    classifyRights(
      "CC BY-SA 4.0",
      "https://creativecommons.org/licenses/by-sa/4.0/",
    ).commercialUseStatus,
    "allowed",
  );
});
test("archive flags are image-specific, not metadata licensing", () => {
  assert.equal(
    aic.normalizeItem({ id: 1, title: "Test", is_public_domain: false })
      .isPublicDomain,
    false,
  );
  assert.equal(
    cma.normalizeItem({ id: 1, title: "Test", share_license_status: "CC0" })
      .isCC0,
    true,
  );
  assert.equal(
    commons.normalizeItem({
      pageid: 1,
      title: "File:X",
      imageinfo: [
        {
          extmetadata: {
            LicenseShortName: { value: "CC BY-SA 4.0" },
            LicenseUrl: {
              value: "https://creativecommons.org/licenses/by-sa/4.0/",
            },
          },
        },
      ],
    }).requiresAttribution,
    true,
  );
  assert.equal(
    smithsonian.normalizeItem({
      id: "1",
      title: "Test",
      content: {
        descriptiveNonRepeating: {
          metadata_usage: { access: "CC0" },
          online_media: {
            media: [
              { type: "Images", usage: { access: "Usage conditions apply" } },
            ],
          },
        },
      },
    }).isCC0,
    false,
  );
});
test("perceptual color distance and coverage affect ranking", () => {
  assert.equal(colorDistance("#ff0000", "#ff0000"), 0);
  assert.ok(
    colorDistance("#ff0000", "#f00000") < colorDistance("#ff0000", "#00ff00"),
  );
  assert.ok(
    paletteScore([{ hex: "#ff0000", percentage: 0.35 }], ["#ff0000"]) >
      paletteScore([{ hex: "#ff0000", percentage: 0.005 }], ["#ff0000"]),
  );
  assert.ok(
    paletteScore(
      [{ hex: "#ff0000", percentage: 0.5 }],
      ["#ff0000", "#00ff00"],
      "palette",
    ) <
      paletteScore(
        [{ hex: "#ff0000", percentage: 0.5 }],
        ["#ff0000", "#00ff00"],
        "any",
      ),
  );
});
test("palette extraction ignores transparent pixels and retains meaningful colors", () => {
  const data = new Uint8Array(10 * 10 * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 200;
    data[i + 1] = 40;
    data[i + 2] = 30;
    data[i + 3] = 255;
  }
  data[3] = 0;
  const p = extractPalette(data, 10, 10);
  assert.equal(p[0].hex, "#c8281e");
  assert.equal(p[0].percentage, 1);
});
test("query URLs preserve filters and parse natural decades", () => {
  const q = {
    ...queryFromText("1950s Christmas"),
    selectedColors: ["#b83a2d"],
    types: ["Poster"],
    providers: ["aic"] as const,
  };
  const parsed = parseQuery(
    new URLSearchParams(serializeQuery({ ...q, providers: [...q.providers] })),
  );
  assert.equal(parsed.yearStart, 1950);
  assert.equal(parsed.yearEnd, 1959);
  assert.deepEqual(parsed.selectedColors, ["#b83a2d"]);
  assert.deepEqual(parsed.providers, ["aic"]);
  assert.equal(parseQuery(new URLSearchParams("page=-2&color=bad")).page, 1);
  assert.equal(
    parseQuery(new URLSearchParams("page=-2&color=bad")).selectedColors.length,
    0,
  );
});
test("filters exclude unknown dimensions, unknown dates, and unmatched strict colors", () => {
  const a = item(
    "aic",
    {},
    {
      providerItemId: "1",
      title: "A",
      yearStart: 1954,
      yearEnd: 1955,
      width: 4000,
      height: 3000,
      ...classifyRights("Public domain"),
    },
  );
  const b = item("aic", {}, { providerItemId: "2", title: "B" });
  assert.equal(
    filterAndRank([a, b], { ...defaultQuery, minimumSize: 3000 }).length,
    1,
  );
  assert.equal(
    filterAndRank([a, b], { ...defaultQuery, yearStart: 1950, yearEnd: 1959 })
      .length,
    1,
  );
  assert.equal(
    filterAndRank([a, b], {
      ...defaultQuery,
      selectedColors: ["#ff0000"],
      colorTolerance: "strict",
    }).length,
    0,
  );
  assert.equal(deduplicate([a, a, b]).length, 2);
});
test("analysis fetches allowlisted HTTPS images only", () => {
  assert.equal(
    allowedImageUrl(
      "https://www.artic.edu/iiif/2/test/full/400,/0/default.jpg",
    ),
    true,
  );
  for (const u of [
    "http://127.0.0.1/x",
    "https://www.artic.edu.evil.test/x",
    "https://user:pass@www.artic.edu/x",
    "https://www.artic.edu:9999/x",
    "file:///etc/passwd",
  ])
    assert.equal(allowedImageUrl(u), false);
});
test("IIIF derivatives are explicit", () => {
  assert.match(
    iiif("https://www.artic.edu/iiif/2", "abc", 400),
    /\/full\/400,\/0\/default.jpg$/,
  );
});

test("LOC search and nested detail envelopes retain image metadata", async () => {
  const { loc } = await import("../lib/providers/loc");
  const record = {
    id: "http://www.loc.gov/item/123/",
    title: "Christmas card",
    image_url: ["https://tile.loc.gov/thumb.jpg"],
    item: {
      id: "123",
      title: "Christmas card",
      date: "12-25-[19]57.",
      genre: ["wood engravings"],
      service_medium: "https://tile.loc.gov/medium.jpg",
      rights_advisory: "No known restrictions",
    },
  };
  for (const raw of [record, { item: record, resources: [] }]) {
    const i = loc.normalizeItem(raw);
    assert.equal(i.yearStart, 1957);
    assert.equal(i.thumbnailUrl, "https://tile.loc.gov/medium.jpg");
    assert.equal(i.objectType, "Print");
    assert.equal(i.isPublicDomain, false);
    assert.equal(i.sourceUrl, "http://www.loc.gov/item/123/");
    assert.ok(
      i.downloadOptions.some(
        (d) => d.url === "https://tile.loc.gov/medium.jpg",
      ),
    );
  }
});

test("combined palette/era/material rights scenarios remain strict about unknown data", () => {
  const colors = [
    { hex: "#b83a2d", percentage: 0.35 },
    { hex: "#eee1c4", percentage: 0.3 },
    { hex: "#315842", percentage: 0.2 },
  ];
  const sample = item(
    "aic",
    {},
    {
      providerItemId: "x",
      title: "Christmas",
      objectType: "Illustration",
      yearStart: 1955,
      yearEnd: 1955,
      dominantColors: colors,
      ...classifyRights("Public domain"),
    },
  );
  const q = {
    ...queryFromText("1950s Christmas"),
    types: ["Illustration"],
    rights: ["public-domain"],
    selectedColors: colors.map((c) => c.hex),
    colorTolerance: "strict" as const,
  };
  assert.equal(filterAndRank([sample], q).length, 1);
  assert.equal(
    filterAndRank([sample], { ...q, selectedColors: ["#335aa1"] }).length,
    0,
  );
  assert.equal(filterAndRank([sample], { ...q, yearStart: 1960 }).length, 0);
});
