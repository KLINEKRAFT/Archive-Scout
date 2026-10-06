import type { ArchiveProvider, ProviderId } from "../types";
import { item, list, material, plain, years } from "../normalize";
import { classifyRights } from "../rights";
import { providerText } from "../query";
import { json } from "./http";
import { mapRecords } from "./batch";

type Config = {
  id: ProviderId;
  host: string;
  collections: Record<string, string>;
};
const value = (v: unknown) =>
  typeof v === "string" || typeof v === "number" ? plain(v) : "";
export function contentdm(config: Config): ArchiveProvider {
  const base = `https://${config.host}`;
  const api = (path: string, signal: AbortSignal) =>
    json(`${base}/digital/bl/dmwebservices/index.php?q=${path}`, signal);
  function identity(id: string) {
    const [alias, pointer] = id.split(":");
    if (
      !Object.hasOwn(config.collections, alias) ||
      !/^\d+$/.test(pointer || "")
    )
      throw new Error("Invalid collection record");
    return { alias, pointer };
  }
  async function resolve(r: any, signal: AbortSignal) {
    const alias = String(r.collection).replace(/^\//, "");
    const { pointer } = identity(`${alias}:${r.pointer}`);
    const compound = r.filetype === "cpd" || /\.cpd$/i.test(value(r.find));
    if (compound) {
      const manifest = await json(
        `${base}/iiif/2/${alias}:${pointer}/manifest.json`,
        signal,
      );
      const resource =
        manifest.sequences?.[0]?.canvases?.[0]?.images?.[0]?.resource;
      const service = resource?.service?.["@id"];
      // Extract only the identifier; all requests remain on the configured archive.
      const imageId = service?.match(/\/iiif\/2\/([\w-]+:\d+)$/)?.[1];
      if (!imageId) throw new Error("No image canvas");
      return { ...r, imageId, width: resource.width, height: resource.height };
    }
    if (!/\.(jpe?g|jp2|tiff?|png|gif)$/i.test(value(r.find)))
      throw new Error("Not an image");
    return { ...r, imageId: `${alias}:${pointer}` };
  }
  const provider: ArchiveProvider = {
    id: config.id,
    normalizeItem(r) {
      const alias = value(r.collection).replace(/^\//, "");
      const id = `${alias}:${r.pointer}`;
      const image = (width: string) =>
        r.imageId
          ? `${base}/iiif/2/${r.imageId}/full/${width}/0/default.jpg`
          : "";
      const date = value(r.date);
      const rights = value(r.rights);
      return item(config.id, r, {
        providerItemId: id,
        title: value(r.title),
        description: value(r.descri),
        creator: value(r.creato || r.photog),
        subjects: list(r.subjec),
        dateDisplay: date || "Date unknown",
        ...years(date),
        objectType: material(
          `${value(r.title)} ${value(r.type)} ${config.collections[alias] || ""}`,
        ),
        collection: config.collections[alias],
        thumbnailUrl: image("400,"),
        previewUrl: image("1000,"),
        width: r.width,
        height: r.height,
        sourceUrl: `${base}/digital/collection/${alias}/id/${r.pointer}`,
        ...classifyRights(
          rights,
          /^https?:\/\//.test(rights) ? rights : "",
          undefined,
          "Institutional item rights; digitization does not imply public domain.",
        ),
        downloadOptions: r.imageId
          ? [
              { label: "Web image · 1000px", url: image("1000,") },
              { label: "Full image", url: image("full") },
            ]
          : [],
      });
    },
    async search(q, signal) {
      const term = providerText(q).replace(/[!^/]/g, " ").trim();
      const search = `CISOSEARCHALL^${encodeURIComponent(term).replace(/%20/g, "+")}^all^and`;
      const aliases = Object.keys(config.collections);
      const perCollection = Math.max(1, Math.floor(24 / aliases.length));
      const responses = await mapRecords(aliases, async (alias) => {
        const response = await api(
          `dmQuery/${alias}/${search}/title!date!descri!type!rights/nosort/${perCollection}/${(q.page - 1) * perCollection + 1}/1/0/0/0/0/0/json`,
          signal,
        );
        if (!response.pager || !Array.isArray(response.records))
          throw new Error("Collection search failed");
        return response;
      });
      if (!responses.length) throw new Error("Archive unavailable");
      const raw = Array.from({ length: perCollection }, (_, index) =>
        responses.flatMap((r) => (r.records[index] ? [r.records[index]] : [])),
      ).flat();
      const records = await mapRecords(raw, (r: any) => resolve(r, signal));
      return {
        provider: config.id,
        items: records.map(provider.normalizeItem),
        total: responses.reduce(
          (total, r) => total + Number(r.pager.total || 0),
          0,
        ),
        hasMore: responses.some(
          (r) => q.page * perCollection < Number(r.pager.total || 0),
        ),
        status: "ok",
      };
    },
    async getItem(id, signal) {
      const { alias, pointer } = identity(id);
      const raw = await api(`dmGetItemInfo/${alias}/${pointer}/json`, signal);
      return provider.normalizeItem(
        await resolve({ ...raw, collection: alias, pointer }, signal),
      );
    },
  };
  return provider;
}
export const tulsa = contentdm({
  id: "tulsa",
  host: "digitalcollections.tulsalibrary.org",
  collections: {
    p15020coll1: "Beryl Ford Collection",
    p15020coll4: "Developing Tulsa — Austin Hellwig",
    p15020coll5: "Hello from Oklahoma! Postcards",
    p15020coll6: "1921 Tulsa Race Massacre",
    p15020coll8: "Levorsen Oil Photography",
    p16063coll3: "Maps",
    p16063coll4: "Cosden Legacy",
    p15020coll9: "Tulsa City-County Library",
  },
});
export const oklahoma = contentdm({
  id: "oklahoma",
  host: "digitalprairie.ok.gov",
  collections: {
    okpostcards: "Oklahoma Postcards",
    p16807coll1: "Images of Oklahoma",
  },
});
