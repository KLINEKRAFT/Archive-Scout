import { aic } from "./aic";
import { cma } from "./cma";
import { met } from "./met";
import { loc } from "./loc";
import { commons } from "./commons";
import { dpla } from "./dpla";
import { smithsonian } from "./smithsonian";
import type { ArchiveProvider, ProviderId } from "../types";
export const providers: Record<ProviderId, ArchiveProvider> = {
  aic,
  cma,
  met,
  loc,
  commons,
  dpla,
  smithsonian,
};
