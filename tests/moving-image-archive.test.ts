import { test } from "node:test";
import assert from "node:assert/strict";
import {
  movingImageArchive as provider,
  sourceClips,
  MOVING_IMAGE_HOST,
} from "../lib/providers/moving-image-archive";
import { allowsHistoricalVideo } from "../lib/video-policy";
import { deduplicate } from "../lib/duplicates";
import { defaultQuery } from "../lib/query";
const clip = {
  id: "a5157c83-f43b-5311-b711-e2ff8bf1d561",
  sourceSlug: "three-little-kittens",
  sourceTitle: "Three Little Kittens",
  sourceYear: 1938,
  position: 0,
  startSeconds: 0,
  endSeconds: 2.936,
  durationSeconds: 2.936,
  videoUrl: `https://${MOVING_IMAGE_HOST}/sources/kittens/clips/first.mp4`,
  thumbnailUrl: `https://${MOVING_IMAGE_HOST}/sources/kittens/thumbnails/first.jpg`,
};
test("clips require known historical dates and trusted playable media", () => {
  const item = provider.normalizeItem(clip);
  assert.equal(item.yearStart, 1938);
  assert.equal(item.mediaType, "video");
  assert.equal(item.isPublicDomain, false);
  assert.ok(allowsHistoricalVideo(item));
  for (const sourceYear of [null, "1938", 1981, 2007])
    assert.equal(
      allowsHistoricalVideo(provider.normalizeItem({ ...clip, sourceYear })),
      false,
    );
  assert.equal(
    provider.normalizeItem({ ...clip, videoUrl: "https://example.com/a.mp4" })
      .videoUrl,
    "",
  );
  assert.ok(
    allowsHistoricalVideo(
      provider.normalizeItem({ ...clip, sourceYear: 1980 }),
    ),
  );
});
test("duplicate clips collapse while different shots with a shared poster survive", () => {
  const first = provider.normalizeItem(clip);
  const second = provider.normalizeItem({
    ...clip,
    id: "b5157c83-f43b-5311-b711-e2ff8bf1d561",
    position: 1,
    videoUrl: clip.videoUrl.replace("first", "second"),
  });
  assert.equal(deduplicate([first, first, second]).length, 2);
});
test("public source-page data can recover a saved clip without executing scripts", () => {
  const chunk = `1:${JSON.stringify({ clips: [clip] })}\n`;
  const html = `<script>self.__next_f.push([1,${JSON.stringify(chunk)}])</script>`;
  assert.deepEqual(sourceClips(html), [clip]);
  assert.deepEqual(sourceClips("<script>alert('not data')</script>"), []);
});
test("browse/search offsets use raw upstream page sizes and clamp dates", async () => {
  const original = globalThis.fetch;
  const requests: { url: string; init?: RequestInit }[] = [];
  globalThis.fetch = async (url, init) => {
    requests.push({ url: String(url), init });
    return Response.json({
      clips: [clip, { ...clip, sourceYear: 2007 }],
      hasMore: true,
    });
  };
  try {
    const browse = await provider.search(
      { ...defaultQuery, mediaType: "video", page: 2, yearEnd: 2020 },
      AbortSignal.timeout(1000),
    );
    assert.equal(browse.items.length, 1);
    assert.equal(browse.hasMore, true);
    assert.match(requests[0].url, /offset=100/);
    assert.match(requests[0].url, /yearMax=1980/);
    await provider.search(
      {
        ...defaultQuery,
        mediaType: "video",
        textQuery: "advertising",
        page: 2,
      },
      AbortSignal.timeout(1000),
    );
    assert.equal(requests[1].init?.method, "POST");
    assert.equal(JSON.parse(String(requests[1].init?.body)).offset, 24);
    const image = await provider.search(
      { ...defaultQuery, mediaType: "image" },
      AbortSignal.timeout(1000),
    );
    assert.equal(image.items.length, 0);
    assert.equal(requests.length, 2);
  } finally {
    globalThis.fetch = original;
  }
});
