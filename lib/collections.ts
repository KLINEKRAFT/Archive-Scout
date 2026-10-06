import type { ProviderId, SearchQuery } from "./types";
export const ARCHIVE_COLLECTIONS: {
  id: string;
  title: string;
  description: string;
  providers: ProviderId[];
  mediaType: SearchQuery["mediaType"];
  from: number;
  to: number;
  query: string;
  locPath?: string;
  iaFilter?: string;
}[] = [
  {
    id: "moving-image-archive",
    title: "The Moving Image Archive",
    description: "Searchable film clips · through 1980",
    providers: ["movingimagearchive"],
    mediaType: "video",
    from: 1800,
    to: 1980,
    query: "",
  },
  {
    id: "wpa",
    title: "WPA posters",
    description: "Federal Art Project · 1936–1943",
    providers: ["loc"],
    mediaType: "image",
    from: 1936,
    to: 1943,
    query: "",
    locPath: "collections/works-progress-administration-posters",
  },
  {
    id: "wwi-posters",
    title: "WWI posters",
    description: "Recruitment, relief & the home front",
    providers: ["loc"],
    mediaType: "image",
    from: 1914,
    to: 1918,
    query: "",
    locPath: "collections/world-war-i-posters",
  },
  {
    id: "wwii-posters",
    title: "WWII posters",
    description: "Wartime print · 1939–1945",
    providers: ["loc", "europeana"],
    mediaType: "image",
    from: 1939,
    to: 1945,
    query: "war poster",
  },
  {
    id: "prelinger",
    title: "Prelinger films",
    description: "Advertising, industry & everyday life",
    providers: ["internetarchive"],
    mediaType: "video",
    from: 1800,
    to: 1980,
    query: "",
    iaFilter: "collection:prelinger",
  },
  {
    id: "screening-room",
    title: "National Screening Room",
    description: "Library of Congress films · through 1980",
    providers: ["loc"],
    mediaType: "video",
    from: 1800,
    to: 1980,
    query: "",
    locPath: "collections/national-screening-room",
  },
  {
    id: "wwi-films",
    title: "WWI films",
    description: "Film dated 1914–1918",
    providers: ["loc", "internetarchive"],
    mediaType: "video",
    from: 1914,
    to: 1918,
    query: "world war",
  },
  {
    id: "wwii-films",
    title: "WWII films",
    description: "Film dated 1939–1945",
    providers: ["loc", "internetarchive"],
    mediaType: "video",
    from: 1939,
    to: 1945,
    query: "world war",
  },
  {
    id: "catalogs",
    title: "Trade catalogs",
    description: "Products, packaging & typography · 1800–1980",
    providers: ["internetarchive"],
    mediaType: "image",
    from: 1800,
    to: 1980,
    query: "",
    iaFilter: 'mediatype:texts AND subject:"trade catalogs"',
  },
  {
    id: "comics",
    title: "Comics",
    description: "Scanned comics · 1800–1980",
    providers: ["internetarchive"],
    mediaType: "image",
    from: 1800,
    to: 1980,
    query: "",
    iaFilter: "mediatype:texts AND subject:comics",
  },
  {
    id: "printed-matter",
    title: "Printed matter",
    description: "Books, magazines & pamphlets · 1800–1980",
    providers: ["internetarchive"],
    mediaType: "image",
    from: 1800,
    to: 1980,
    query: "",
    iaFilter: "mediatype:texts",
  },
];
export const archiveCollection = (id: string) =>
  ARCHIVE_COLLECTIONS.find((c) => c.id === id);
export function collectionQuery(id: string): Partial<SearchQuery> {
  const c = archiveCollection(id);
  return c
    ? {
        collection: c.id,
        textQuery: c.query,
        providers: c.providers,
        mediaType: c.mediaType,
        yearStart: c.from,
        yearEnd: c.to,
        types: [],
        countries: [],
        page: 1,
      }
    : { collection: "" };
}
