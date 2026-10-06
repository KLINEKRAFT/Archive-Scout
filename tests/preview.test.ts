import test from "node:test";
import assert from "node:assert/strict";
import {
  firstWorkingPreview,
  previewCandidates,
  previewKey,
} from "../lib/preview";
import type { ArchiveItem } from "../lib/types";
const record = {
  id: "test",
  thumbnailUrl: "https://example.org/thumb.jpg",
  previewUrl: "https://example.org/large.jpg",
} as ArchiveItem;

test("unavailable images are excluded after all derivatives fail", async () => {
  assert.equal(
    await firstWorkingPreview(previewCandidates(record), async () => false),
    null,
  );
});
test("blocked direct images recover through the proxy", async () => {
  const tried: string[] = [];
  const result = await firstWorkingPreview(
    previewCandidates(record),
    async (url) => {
      tried.push(url);
      return url.startsWith("/api/image?");
    },
  );
  assert.equal(
    result,
    `/api/image?url=${encodeURIComponent(record.thumbnailUrl)}`,
  );
  assert.equal(tried.length, 2);
});
test("broken large preview falls back to a working thumbnail", async () => {
  assert.equal(
    await firstWorkingPreview(
      previewCandidates(record, true),
      async (url) => url === record.thumbnailUrl,
    ),
    record.thumbnailUrl,
  );
});
test("a failed thumbnail can recover with another archive derivative", async () => {
  assert.equal(
    await firstWorkingPreview(previewCandidates(record), async (url) => {
      if (url === record.thumbnailUrl) throw new Error("network error");
      return url === record.previewUrl;
    }),
    record.previewUrl,
  );
});
test("verification identity follows image URLs, not metadata or palette edits", () => {
  assert.equal(
    previewKey(record),
    previewKey({ ...record, title: "Updated title" }),
  );
  assert.notEqual(
    previewKey(record),
    previewKey({ ...record, thumbnailUrl: "https://example.org/new.jpg" }),
  );
  assert.deepEqual(
    previewCandidates({ ...record, previewUrl: record.thumbnailUrl }),
    [
      record.thumbnailUrl,
      `/api/image?url=${encodeURIComponent(record.thumbnailUrl)}`,
    ],
  );
});

test("LOC group icons do not count as previews", () => {
  assert.deepEqual(
    previewCandidates({
      ...record,
      thumbnailUrl: "https://memory.loc.gov/pp/grp.gif",
      previewUrl: "",
    }),
    [],
  );
});
