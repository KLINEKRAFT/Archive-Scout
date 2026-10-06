export const PROVIDERS = [
  {
    id: "movingimagearchive",
    name: "The Moving Image Archive",
    code: "MIA / 16",
  },
  { id: "loc", name: "Library of Congress", code: "LOC / 01" },
  { id: "dpla", name: "Digital Public Library of America", code: "DPLA / 02" },
  { id: "smithsonian", name: "Smithsonian", code: "SI / 03" },
  { id: "commons", name: "Wikimedia Commons", code: "WIKI / 04" },
  { id: "aic", name: "Art Institute of Chicago", code: "AIC / 05" },
  { id: "cma", name: "Cleveland Museum of Art", code: "CMA / 06" },
  { id: "met", name: "The Metropolitan Museum of Art", code: "MET / 07" },
  { id: "tulsa", name: "Tulsa City-County Library", code: "TUL / 08" },
  { id: "oklahoma", name: "Oklahoma Digital Prairie", code: "OK / 09" },
  { id: "internetarchive", name: "Internet Archive", code: "IA / 10" },
  { id: "nasa", name: "NASA Image and Video Library", code: "NASA / 11" },
  { id: "europeana", name: "Europeana", code: "EU / 12" },
  { id: "digitalnz", name: "DigitalNZ", code: "NZ / 13" },
  { id: "vam", name: "Victoria and Albert Museum", code: "VA / 14" },
  {
    id: "gallica",
    name: "Gallica · Bibliothèque nationale de France",
    code: "BNF / 15",
  },
] as const;
export type ProviderId = (typeof PROVIDERS)[number]["id"];
export type RightsCategory =
  | "public-domain"
  | "cc0"
  | "commercial"
  | "attribution"
  | "restricted"
  | "unknown";
export interface Rights {
  category: RightsCategory;
  rightsLabel: string;
  rightsDescription: string;
  rightsUrl?: string;
  isPublicDomain: boolean;
  isCC0: boolean;
  commercialUseStatus: "allowed" | "restricted" | "unknown";
  requiresAttribution: boolean;
  licenseName?: string;
  licenseUrl?: string;
  evidence: string;
}
export interface Color {
  hex: string;
  percentage: number;
}
export interface DownloadOption {
  label: string;
  url: string;
  width?: number;
  height?: number;
  bytes?: number;
}
export interface ArchiveItem extends Rights {
  id: string;
  provider: ProviderId;
  providerItemId: string;
  title: string;
  description: string;
  creator?: string;
  contributors: string[];
  dateDisplay: string;
  yearStart?: number;
  yearEnd?: number;
  decade?: number;
  objectType: string;
  medium?: string;
  subjects: string[];
  tags: string[];
  mediaType?: "image" | "video";
  videoUrl?: string;
  duration?: string;
  thumbnailUrl: string;
  verifiedPreviewUrl?: string;
  previewUrl: string;
  fullImageUrl?: string;
  width?: number;
  height?: number;
  aspectRatio?: number;
  archiveCountries?: string[];
  identityKeys?: string[];
  visualFingerprint?: string;
  sourceUrl: string;
  institution: string;
  collection?: string;
  physicalDimensions?: string;
  downloadOptions: DownloadOption[];
  dominantColors: Color[];
  averageColor?: string;
  colorAnalysisVersion?: number;
  addedAt?: string;
  originalMetadata: Record<string, unknown>;
}
export interface SearchQuery {
  collection: string;
  textQuery: string;
  mediaType: "all" | "image" | "video";
  yearStart?: number;
  yearEnd?: number;
  countries: string[];
  types: string[];
  rights: string[];
  providers: ProviderId[];
  orientation: string;
  minimumSize: number;
  selectedColors: string[];
  colorMode: "any" | "palette";
  colorTolerance: "loose" | "balanced" | "strict";
  sort: string;
  page: number;
}
export interface ProviderResult {
  provider: ProviderId;
  items: ArchiveItem[];
  total: number;
  hasMore: boolean;
  status: "ok" | "unavailable" | "needs-key";
  message?: string;
}
export interface ArchiveProvider {
  id: ProviderId;
  search(query: SearchQuery, signal: AbortSignal): Promise<ProviderResult>;
  getItem(id: string, signal: AbortSignal): Promise<ArchiveItem>;
  normalizeItem(record: any): ArchiveItem;
}
export interface Board {
  id: string;
  name: string;
  items: ArchiveItem[];
  colors: string[];
  createdAt: string;
}
export interface SavedPalette {
  id: string;
  name: string;
  colors: string[];
}
export const MATERIALS = [
  "Photography",
  "Comic",
  "Newspaper",
  "Film / Video",
  "Illustration",
  "Advertisement",
  "Poster",
  "Postcard",
  "Packaging",
  "Ephemera",
  "Print",
  "Drawing",
  "Book",
  "Magazine",
  "Catalog",
  "Typography",
  "Map",
  "Object",
  "Other",
];
