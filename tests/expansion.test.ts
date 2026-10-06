import test from "node:test";
import assert from "node:assert/strict";
import { defaultQuery, parseQuery, serializeQuery } from "../lib/query";
import { PROVIDERS } from "../lib/types";
import { filterAndRank } from "../lib/search";
import { nasa } from "../lib/providers/nasa";
import { internetArchive } from "../lib/providers/internet-archive";
import { tulsa, contentdm } from "../lib/providers/contentdm";
import { classifyRights } from "../lib/rights";
import { previewKey } from "../lib/preview";

test("media filters and seven-source subsets survive URL round trips after expansion", () => {
  assert.equal(PROVIDERS.length, 11);
  const query = {
    ...defaultQuery,
    mediaType: "video" as const,
    providers: defaultQuery.providers.slice(0, 7),
  };
  const parsed = parseQuery(new URLSearchParams(serializeQuery(query)));
  assert.equal(parsed.mediaType, "video");
  assert.deepEqual(parsed.providers, query.providers);
});

test("NASA video files use HTTPS, separate posters, and conservative rights", () => {
  const video = nasa.normalizeItem({
    data: [
      {
        nasa_id: "Apollo test",
        media_type: "video",
        title: "Apollo film",
        date_created: "1969-01-01",
        center: "JSC",
      },
    ],
    links: [
      {
        rel: "preview",
        render: "image",
        href: "https://images-assets.nasa.gov/video/test/thumb.jpg",
      },
    ],
    assets: [
      { href: "http://images-assets.nasa.gov/video/test/test~medium.mp4" },
    ],
  });
  assert.equal(
    video.videoUrl,
    "https://images-assets.nasa.gov/video/test/test~medium.mp4",
  );
  assert.equal(video.mediaType, "video");
  assert.equal(video.isPublicDomain, false);
  assert.equal(
    filterAndRank([video], { ...defaultQuery, mediaType: "image" }).length,
    0,
  );
  assert.equal(
    filterAndRank([video], { ...defaultQuery, mediaType: "video" }).length,
    1,
  );
  assert.notEqual(
    previewKey(video),
    previewKey({ ...video, videoUrl: "https://example.org/new.mp4" }),
  );
});

test("Internet Archive uses public playable derivatives and item-specific licenses", () => {
  const video = internetArchive.normalizeItem({
    metadata: {
      identifier: "film-test",
      mediatype: "movies",
      title: "Advertisement",
      licenseurl: "https://creativecommons.org/licenses/by-nc/4.0/",
      date: "1966",
      runtime: "01:10",
    },
    files: [
      { name: "private.mp4", private: true, size: "1" },
      { name: "film.mp4", size: "12000", format: "h.264" },
      { name: "small clip.mp4", size: "9000", format: "MPEG4" },
    ],
  });
  assert.match(video.videoUrl!, /small%20clip.mp4$/);
  assert.equal(video.downloadOptions.length, 2);
  assert.equal(video.commercialUseStatus, "restricted");
  assert.equal(video.yearStart, 1966);
  assert.equal(video.duration, "01:10");
});

test("Tulsa missing dates remain unknown and rights are retained", () => {
  const image = tulsa.normalizeItem({
    collection: "/p15020coll1",
    pointer: 17133,
    title: "Thrif-T-Wise advertising slide",
    descri: "Television advertising slide",
    date: {},
    rights: "Copyright may apply. Credit the Beryl Ford Collection.",
    imageId: "p15020coll1:17133",
  });
  assert.equal(image.yearStart, undefined);
  assert.equal(image.dateDisplay, "Date unknown");
  assert.equal(image.objectType, "Advertisement");
  assert.match(image.sourceUrl, /collection\/p15020coll1\/id\/17133$/);
  assert.equal(image.isPublicDomain, false);
  assert.match(image.rightsDescription, /Beryl Ford/);
});

test("CONTENTdm resolves compound objects to their actual first image, not a placeholder", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes("dmQuery"))
      return Response.json({
        pager: { total: 1 },
        records: [
          {
            collection: "/photos",
            pointer: 99,
            filetype: "cpd",
            title: "Street Scene",
            date: "1907",
            rights: "Check source",
          },
        ],
      });
    if (url.endsWith("manifest.json"))
      return Response.json({
        sequences: [
          {
            canvases: [
              {
                images: [
                  {
                    resource: {
                      width: 800,
                      height: 521,
                      service: {
                        "@id": "https://institution.example/iiif/2/photos:97",
                      },
                    },
                  },
                ],
              },
            ],
          },
        ],
      });
    throw new Error("Unexpected URL");
  };
  try {
    const source = contentdm({
      id: "tulsa",
      host: "institution.example",
      collections: { photos: "Photographs" },
    });
    const r = await source.search(defaultQuery, new AbortController().signal);
    assert.equal(r.items.length, 1);
    assert.match(r.items[0].thumbnailUrl, /photos:97\/full\/400,/);
    assert.match(r.items[0].sourceUrl, /id\/99$/);
    assert.equal(r.items[0].width, 800);
    await assert.rejects(
      source.getItem("other:12", new AbortController().signal),
      /Invalid collection/,
    );
  } finally {
    globalThis.fetch = original;
  }
});

test("regional In Copyright rights statements are restrictions", () => {
  assert.equal(
    classifyRights("", "https://rightsstatements.org/page/InC-EDU/1.0/")
      .commercialUseStatus,
    "restricted",
  );
});
