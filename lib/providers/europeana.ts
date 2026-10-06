import { COUNTRIES, countryCodes } from "../countries";
import type { ArchiveProvider } from "../types";
import { item, material } from "../normalize";
import { classifyRights } from "../rights";
import { providerText } from "../query";
import { allowsHistoricalVideo, VIDEO_YEAR_LIMIT } from "../video-policy";
import { json, params } from "./http";
import { catalogDate, directVideo, mediaUrl, values } from "./aggregate-media";
const base = "https://api.europeana.eu/record/v2";
const headers = () => {
  const key = process.env.EUROPEANA_API_KEY?.trim();
  if (!key) throw new Error("Europeana key not configured");
  return { "X-Api-Key": key };
};
const identifier = (id: string) => {
  if (
    !/^\/[^/?#]+\/[^/?#]+$/.test(id) ||
    id.split("/").some((v) => v === "." || v === "..")
  )
    throw new Error("Invalid Europeana identifier");
  return id.split("/").map(encodeURIComponent).join("/");
};
export const europeana: ArchiveProvider = {
  id: "europeana",
  normalizeItem(raw) {
    const r = raw.object || raw;
    const id = r.id || r.about;
    identifier(id);
    const aggregations = r.aggregations || [];
    const proxies = (r.proxies || []).filter((p: any) => !p.europeanaProxy);
    const field = (name: string) =>
      proxies.flatMap((p: any) => values(p[name]));
    const aggregate = (name: string) =>
      aggregations.flatMap((a: any) => values(a[name]));
    const video = String(r.type).toUpperCase() === "VIDEO";
    const title = values(r.title).length ? values(r.title) : field("dcTitle");
    const dates = field("dcDate").length ? field("dcDate") : values(r.year);
    const shownBy = [...values(r.edmIsShownBy), ...aggregate("edmIsShownBy")]
      .map(mediaUrl)
      .filter(Boolean);
    const views = aggregate("hasView");
    const thumbnail =
      [
        ...values(r.edmPreview),
        ...values(r.europeanaAggregation?.edmPreview),
        ...aggregate("edmObject"),
      ]
        .map(mediaUrl)
        .find(Boolean) || "";
    const videoUrl = video ? directVideo([...shownBy, ...views]) : "";
    const rights = [
      ...values(r.rights),
      ...aggregate("edmRights"),
      ...field("dcRights"),
    ];
    const rightsUrl =
      rights
        .map((v) => (/^https?:/.test(v) ? mediaUrl(v) : ""))
        .find(Boolean) || "";
    const image = video ? "" : shownBy[0] || "";
    return item("europeana", r, {
      archiveCountries: countryCodes(
        values(r.country || r.europeanaAggregation?.edmCountry),
      ),
      providerItemId: id,
      title: title.join("; "),
      description: [...values(r.dcDescription), ...field("dcDescription")].join(
        " ",
      ),
      creator: [...values(r.dcCreator), ...field("dcCreator")].join("; "),
      ...catalogDate(dates, video),
      mediaType: video ? "video" : "image",
      objectType: video
        ? "Film / Video"
        : material([...field("dcType"), ...title].join(" ")),
      subjects: [...values(r.edmConceptPrefLabel), ...field("dcSubject")],
      institution:
        [...values(r.dataProvider), ...aggregate("edmDataProvider")].join(
          "; ",
        ) || "Europeana contributor",
      collection: values(r.edmDatasetName || r.europeanaCollectionName).join(
        "; ",
      ),
      thumbnailUrl: thumbnail,
      previewUrl: image || thumbnail,
      fullImageUrl: image || undefined,
      videoUrl: videoUrl || undefined,
      sourceUrl:
        [...values(r.edmIsShownAt), ...aggregate("edmIsShownAt")]
          .map(mediaUrl)
          .find(Boolean) || `https://www.europeana.eu/item${id}`,
      ...classifyRights(
        rights.join("; "),
        rightsUrl,
        undefined,
        "Europeana provider media rights (edm:rights) and source dc:rights; metadata CC0 is not a media license.",
      ),
      downloadOptions: videoUrl
        ? [{ label: "Source video", url: videoUrl }]
        : image
          ? [{ label: "Source file", url: image }]
          : [],
    });
  },
  async search(q, signal) {
    if (!process.env.EUROPEANA_API_KEY?.trim())
      return {
        provider: "europeana",
        items: [],
        total: 0,
        hasMore: false,
        status: "needs-key",
        message: "Requires EUROPEANA_API_KEY",
      };
    if (q.mediaType === "video" && (q.yearStart ?? 0) > VIDEO_YEAR_LIMIT)
      return {
        provider: "europeana",
        items: [],
        total: 0,
        hasMore: false,
        status: "ok",
      };
    const query = new URLSearchParams(
      params({
        query: providerText(q),
        rows: 24,
        start: (q.page - 1) * 24 + 1,
        profile: "standard",
        thumbnail: "true",
      }),
    );
    const video = `TYPE:VIDEO AND YEAR:[${q.yearStart ?? 1800} TO ${Math.min(q.yearEnd ?? VIDEO_YEAR_LIMIT, VIDEO_YEAR_LIMIT)}]`;
    const image = `TYPE:IMAGE${q.yearStart !== undefined || q.yearEnd !== undefined ? ` AND YEAR:[${q.yearStart ?? "*"} TO ${q.yearEnd ?? "*"}]` : ""}`;
    query.append(
      "qf",
      q.mediaType === "video"
        ? video
        : q.mediaType === "image" || (q.yearStart ?? 0) > VIDEO_YEAR_LIMIT
          ? image
          : `(${image}) OR (${video})`,
    );
    if (q.countries.length)
      query.append(
        "qf",
        `COUNTRY:(${q.countries.map((c) => `"${COUNTRIES.find(([code]) => code === c)?.[1] || c}"`).join(" OR ")})`,
      );
    const r = await json(`${base}/search.json?${query}`, signal, headers());
    if (r.success === false || !Array.isArray(r.items)) {
      if (r.success !== false && r.totalResults === 0)
        return {
          provider: "europeana",
          items: [],
          total: 0,
          hasMore: false,
          status: "ok",
        };
      throw new Error("Europeana search unavailable");
    }
    return {
      provider: "europeana",
      items: r.items
        .filter(
          (r: any) =>
            ["IMAGE", "VIDEO"].includes(r.type) && !r.previewNoDistribute,
        )
        .map(europeana.normalizeItem)
        .filter(
          (i: any) =>
            i.thumbnailUrl &&
            allowsHistoricalVideo(i) &&
            (i.mediaType !== "video" || i.videoUrl),
        ),
      total: r.totalResults || 0,
      hasMore: q.page * 24 < (r.totalResults || 0),
      status: "ok",
    };
  },
  async getItem(id, signal) {
    const r = await json(`${base}${identifier(id)}.json`, signal, headers());
    if (!r.object || r.success === false)
      throw new Error("Europeana record unavailable");
    return europeana.normalizeItem(r);
  },
};
