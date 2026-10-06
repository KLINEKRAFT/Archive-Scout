# Archive Scout

A visual research tool for historical imagery. Paper, ink, archive red; live multi-archive search, evidence-based rights labels, perceptual palette search, and locally saved research boards.

## Run

Requires Node.js 22.12+ (validated on Node 24).

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Open http://127.0.0.1:3000. Twelve providers work without credentials. Add `DPLA_API_KEY`, `SMITHSONIAN_API_KEY`, and `EUROPEANA_API_KEY` to `.env.local` to enable the three key-required sources. `DIGITALNZ_API_KEY` is optional but recommended for identified API access. Keys are used only in server route handlers and never returned to the browser. Restart the server after changing keys.

```sh
npm test
npm run typecheck
npm run build
npm start
```

`npm run smoke` runs optional, network-dependent searches from the build brief. Archive outages or throttling are reported as unavailable, not simulated successes. It is intentionally separate from deterministic tests.

## V1 experience

- Editorial discovery page, predefined subject/era searches, and palette entry points.
- Fifteen interchangeable adapters. Searches run concurrently in the browser against server endpoints and merge as each source responds. New searches cancel superseded requests.
- Shareable URL state for media type, era, archive country, sources, material, rights, orientation, verified image size, palette, matching strength, and sort.
- Image/video/all discovery, video badges, native controls, playable-file links, and browser metadata checks before video admission. No autoplay.
- Masonry and uniform image grids, native lazy loading, detail dialog, keyboard `/`, Escape, and previous/next arrows.
- Source-linked file choices with archive-supplied dimensions and sizes. Original files go directly to their institutions without re-encoding. A bounded preview fallback handles failed browser embeds.
- Rights evidence, original record links, citation copy, and conservative unknown/restricted classifications.
- Up to five colors, custom HEX/native color picker, progressive enhancement for screen eyedropper, saved palettes, and “Search this palette.”
- Preview-only color extraction, LAB distance, percentage-weighted ranking, any-color/palette modes, three tolerances, and a versioned cache. Unsupported image hosts show unavailable analysis.
- Research boards and palettes in versioned browser storage. No accounts, billing, social features, or simulated AI. Related imagery uses metadata and colors through a replaceable similarity interface.
- Warm dark mode and a full-screen mobile filter sheet.

## Architecture

```
app/api/search     per-provider server boundary, timeout and query cache
app/api/item       detailed source records
app/api/palette    cached preview analysis
app/api/image      bounded allowlisted fallback for failed image embeds
lib/providers/     one adapter per institution, normalized ArchiveItem output
lib/types.ts       provider, item, rights, search, board and palette contracts
lib/rights.ts      evidence-based rights classification
lib/color.ts       LAB distance, weighted palette scores, extraction
lib/image-analysis.ts  safe image fetch, small thumbnail decode, versioned cache
lib/search.ts      filtering, deduplication, ranking, similarity abstraction
lib/storage.ts     replaceable browser-local research persistence
components/        research surface, filters, detail dialog and image grid
```

Providers preserve their original API payload on `originalMetadata`. Saved boards omit that potentially large payload but retain normalized attribution, rights evidence, identifiers, images and source links. Material mapping is intentionally conservative; original terms remain in the source metadata.

## Source behavior

| Provider                 | Search and images                                                      | Rights evidence                                                            |
| ------------------------ | ---------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Library of Congress      | Photos API; nested catalog records; archive-provided image derivatives | Per-item rights and advisory; “no known restrictions” remains Check source |
| DPLA                     | API key; contributing institution, source record, thumbnail            | `sourceResource.rights`; never infer rights from aggregation               |
| Smithsonian              | API key; selected online image                                         | Selected media `usage.access`; metadata CC0 is insufficient                |
| Wikimedia Commons        | MediaWiki search and file `imageinfo`                                  | `LicenseShortName` and `LicenseUrl`                                        |
| Art Institute of Chicago | Search DSL and IIIF derivatives                                        | Explicit `is_public_domain`, copyright notice                              |
| Cleveland Museum of Art  | Search and web/print/full image options                                | Explicit `share_license_status`                                            |
| The Met                  | Paginated `/v1.1/search`, bounded object fetches                       | Explicit `isPublicDomain`                                                  |

API documentation: [LOC](https://www.loc.gov/apis/json-and-yaml/), [DPLA](https://pro.dp.la/developers), [Smithsonian](https://www.si.edu/openaccess/devtools), [MediaWiki](https://www.mediawiki.org/wiki/API:Imageinfo), [AIC](https://api.artic.edu/docs/), [CMA](https://openaccess-api.clevelandart.org/), [Met](https://metmuseum.github.io/).

## Expanded archives

| Source                       | Coverage                                                                                                      | Access                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Tulsa City-County Library    | Beryl Ford advertising slides and photographs, Austin Hellwig, postcards, maps, oil industry, library history | Public CONTENTdm API + IIIF; no key          |
| Oklahoma Digital Prairie     | Images of Oklahoma and Oklahoma Postcards; first image of multi-page items                                    | Public CONTENTdm API + IIIF; no key          |
| Internet Archive             | Still images and moving images, including Prelinger films and advertising                                     | Advanced Search + item metadata; no key      |
| NASA Image and Video Library | Mission photography, space-age assets, archival footage                                                       | Image/video search + asset manifests; no key |

Regional searches distribute a page across the configured collections so a large text collection cannot crowd out photographs. Missing dates remain unknown and do not pass explicit era filters. NASA dates are the library's catalog dates, which may describe digitization rather than original filming. Internet Archive rights come from contributor-supplied item metadata, not a blanket license for the repository. Compound objects preview their first image and link to the complete original record.

Docs: [CONTENTdm APIs](https://help.oclc.org/Metadata_Services/CONTENTdm_classic_version/Advanced_website_customization/API_Reference), [NASA API](https://images.nasa.gov/docs/images.nasa.gov_api_docs.pdf), [Internet Archive](https://archive.org/developers/). Further source research is in `docs/ARCHIVE-SOURCES.md`.

`node --import tsx tests/live-expansion.ts` smoke-tests the four added adapters. Video playback goes directly to the archive; only metadata is preloaded for validation. Color analysis uses the poster image, not frames from the video.

## Practical limits and deployment

This V1 searches live APIs, not a pre-indexed copy of every archive. Counts reflect loaded records. Color, material, rights and size filters rank/filter those records; load more to broaden the candidate pool. Date ranges are pushed to supported APIs and checked locally. Historical date ranges may be approximate and overlap the selected era. Broad Commons searches can include recent photographs; use an era to constrain them.

An archive returning no records is different from a failed archive. Key-required and outage states remain visible. One source failure does not discard results from the others. Some records have no downloadable master, no pixel dimensions, ambiguous dates, or no supported image preview. Missing technical metadata is never invented.

Image embedding similarity and inspiration-image upload are not implemented. The similarity interface explicitly reports `metadata-and-palette`. DPLA and Smithsonian live behavior must be verified once keys are configured. No credentials are bundled.

Deploy as a Node-compatible Next.js app (not a static export). Configure server environment variables in your host. Palette signatures persist in `.cache/palettes` on a writable server; on read-only/serverless hosts, a bounded memory cache is used and may reset between instances. For sustained public traffic, replace local palette/query caches with shared storage, add deployment-level rate limits, and enforce a cache-retention policy. Preview fetches have an exact host allowlist, redirect checks, byte limits, pixel limits and concurrency limits. Originals are never processed for analysis.

Collections live only in the current browser. Clearing site storage removes them; they do not sync between devices. A future account store can implement `ResearchStorage` without changing archive adapters.

Fonts use DM Sans and IBM Plex Mono from Google Fonts with system fallbacks. No external font service is required for the app to remain usable.

## Europeana and DigitalNZ

Set `EUROPEANA_API_KEY` and `DIGITALNZ_API_KEY` in Vercel Production and Preview, then deploy this code. Europeana receives its key through `X-Api-Key`; DigitalNZ uses `Authentication-Token`. The keys remain server-side. Authenticated requests do not follow redirects, and API errors never include request credentials.

Europeana provides cross-institution European images and qualifying video records. DigitalNZ aggregates New Zealand collections, including cinema advertising slides. Both retain contributor attribution, source links and item-level rights. DigitalNZ's `is_commercial_use` is a metadata permission and is never used to label media commercially reusable.

Videos require a direct MP4/WebM, a known date ending by 1980, a working poster and successful browser video-metadata loading. External player pages are not treated as videos. Missing images and Europeana records marked `previewNoDistribute` are omitted. Dates are catalog metadata; no year is inferred from upload time or a title. Many film records therefore remain excluded.

Only verified thumbnail hosts are added to the palette/proxy allowlist. Other institutions' images can still load directly in the browser, but palette analysis may be unavailable. Global results use the existing preview verification before appearing in the grid.

Official docs: [Europeana authentication](https://europeana.atlassian.net/wiki/spaces/EF/pages/2462351393/Accessing+the+APIs), [Europeana search](https://europeana.atlassian.net/wiki/spaces/EF/pages/2385739812/Search), [DigitalNZ API](https://digitalnz.org/developers/api-docs-v3). V&A and Gallica are also enabled without API keys. V&A uses collections search/detail JSON and IIIF; Gallica uses SRU Dublin Core and documented thumbnail/medium derivatives.

## Unique results and archive countries

Results are filtered, then browser-verified, then grouped by provider record IDs, shared canonical record/image URLs, IIIF derivatives, and exact normalized preview pixels when CORS permits. Alias groups merge transitively across providers and loaded pages; saved boards retain those aliases. A broken copy cannot suppress a working alternative. Films never merge merely because they share a poster, and titles alone never merge distinct works.

This does not guarantee identification of every independently scanned, cropped, or recompressed copy. Unrelated URLs without readable pixels may remain unmatched. Country means the supplying archive's location/coverage, not where an object was made or photographed. Unknown countries are excluded by an active country filter. Europeana's country metadata and query facets are used where available.

V&A date bounds may span a century; those broad ranges remain visible as catalogued rather than being relabeled with the selected decade. Gallica keeps original work rights separate from digitization reuse terms. Neither source grants blanket commercial reuse permission.

## Discovery and historical collections

The home page now shows a shuffled, interleaved photo mix from AIC, Cleveland, LOC and NASA, with working-preview validation and a Shuffle discoveries control. Search results load additional pages automatically near the bottom; exhausted sources and repeated pages stop without requiring a Load more button.

Collection shortcuts cover WPA and WWI posters, WWII posters, Prelinger films, the National Screening Room, WWI/WWII films, trade catalogs, comics and other print scans. Internet Archive text scans are limited to known dates from 1800–1980 and public document files. LOC movies require playable MP4s and the existing <=1980 video date policy. See [film and print research](docs/FILM-AND-PRINT-COLLECTIONS.md) for source documentation and additional candidates.
