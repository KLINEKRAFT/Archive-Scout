import { movingImageArchive } from "./moving-image-archive";
import { vam } from "./vam";
import { gallica } from "./gallica";
import { europeana } from "./europeana";
import { digitalnz } from "./digitalnz";
import { tulsa, oklahoma } from "./contentdm";
import { nasa } from "./nasa";
import { internetArchive } from "./internet-archive";
import { aic } from "./aic";
import { cma } from "./cma";
import { met } from "./met";
import { loc } from "./loc";
import { commons } from "./commons";
import { dpla } from "./dpla";
import { smithsonian } from "./smithsonian";
import type { ArchiveProvider, ProviderId } from "../types";
export const providers: Record<ProviderId, ArchiveProvider> = {
  movingimagearchive: movingImageArchive,
  vam,
  gallica,
  europeana,
  digitalnz,
  tulsa,
  oklahoma,
  nasa,
  internetarchive: internetArchive,
  aic,
  cma,
  met,
  loc,
  commons,
  dpla,
  smithsonian,
};
