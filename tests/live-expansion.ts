import { providers } from "../lib/providers";
import { defaultQuery } from "../lib/query";
import type { ProviderId, SearchQuery } from "../lib/types";
const checks: [ProviderId, string, Partial<SearchQuery>][] = [
  ["tulsa", "advertising", {}],
  ["oklahoma", "Tulsa", {}],
  ["nasa", "Apollo", { mediaType: "image", yearStart: 1960, yearEnd: 1969 }],
  ["nasa", "Apollo", { mediaType: "video" }],
  [
    "internetarchive",
    "advertising",
    { mediaType: "video", yearStart: 1960, yearEnd: 1969 },
  ],
  ["internetarchive", "Tulsa", { mediaType: "image" }],
];
void Promise.all(
  checks.map(async ([id, textQuery, extra]) => {
    try {
      const start = Date.now();
      const r = await providers[id].search(
        { ...defaultQuery, textQuery, ...extra },
        AbortSignal.timeout(18000),
      );
      console.log(
        JSON.stringify({
          provider: id,
          query: textQuery,
          media: extra.mediaType,
          status: r.status,
          count: r.items.length,
          total: r.total,
          elapsed: Date.now() - start,
          first: r.items[0] && {
            id: r.items[0].providerItemId,
            title: r.items[0].title,
            image: r.items[0].thumbnailUrl,
            video: r.items[0].videoUrl,
            date: r.items[0].dateDisplay,
          },
        }),
      );
    } catch (error) {
      console.log(
        JSON.stringify({
          provider: id,
          query: textQuery,
          error: String(error),
        }),
      );
      process.exitCode = 1;
    }
  }),
);
