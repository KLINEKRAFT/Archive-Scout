# V1 validation — 6 October 2026

- `npm test`: 10 deterministic tests passed (rights evidence, image-specific licensing, LAB distance/coverage, transparent pixel handling, query serialization, combined filters, SSRF host checks, IIIF URLs, and LOC envelope normalization).
- `npm run typecheck`: passed.
- `npm run build`: passed on Next.js 16.3.8 / Node 24.16.0.
- `npm audit --omit=dev`: zero known vulnerabilities.
- Browser: desktop discovery, live decade search, palette selection/save, image detail and download choices, collection create/save, mobile filter sheet, and 390px results layout inspected. At 390px, document width equals viewport width. Dialogs use native modal focus handling.
- Production build is served separately from the development server for final inspection.

## Live archive checks

The test script ran all eleven subject searches from the brief against LOC and AIC. The main `1950s Christmas` check also exercised CMA, Met, Commons, and the two key-required states. LOC returned records for ten searches and was temporarily unavailable for `vintage motel`. AIC requests succeeded, with honest zero-result responses for several narrow subjects. The app preserves results from healthy sources.

For `1950s Christmas`, AIC returned 12 candidate records, LOC 24 (22 overlapping the requested era), Commons 24 (10 overlapping the era); CMA returned zero. Met returned a valid search page but its first batch contained no image-bearing records. Further pages remain available. Counts vary with archive updates and indexing.

DPLA and Smithsonian adapters have not been tested with real keys. Their disabled/configuration states are verified; live integration must be checked when credentials are available.

No public deployment, embedding backend, account synchronization, or full-corpus color index is claimed. The README describes the operational requirements for a public deployment.

## Preview availability regression — 2026-10-06

- Reproduced 11 unavailable-preview cards on the production Christmas search; all were AIC records. A sampled production image-proxy request returned 502.
- Results now require successful browser image loading before admission to home/search/collection grids. Counts and detail navigation use admitted records only. Checks run with six workers and an eight-second deadline per candidate; failed checks remain omitted for this mounted session.
- Large details retain the verified thumbnail while testing larger derivatives. A subsequent rendering failure removes the card; collection storage is preserved.
- Local production build, real Christmas search: 43 visible records, zero failed image elements, no unavailable-preview cards. Local provider access differs from Vercel and does not have the two optional keys.
- Controlled browser fixture: three source records (working thumbnail/broken large image; broken thumbnail/working alternate; both broken) yield exactly two visible cards. Opening the first retains a loaded thumbnail despite its broken large image.
- 16 unit tests and production build (including TypeScript) pass.

## Regional archives and video — 2026-10-06

- Confirmed PR #2 is deployed on the stable production alias. Live `1960s Advertising` search: 24 viewable results, zero failed image elements, no unavailable-preview cards. The original user-supplied deployment URL refers to the earlier build.
- Added Tulsa City-County Library, Oklahoma Digital Prairie, NASA, and Internet Archive. Direct API smoke tests include image/video/date-filtered searches and regional compound-object manifests. These four sources need no new keys.
- Balanced CONTENTdm pages across selected visual collections to prevent a large text collection from crowding out photographs. Known dates are preserved; unknown dates remain unknown.
- Local browser: Tulsa query yielded six viewable cards; Oklahoma/Tulsa query yielded 23 with loaded previews; NASA/Apollo/video yielded 12 browser-validated video records. No failed image elements in the inspected regional grid.
- Internet Archive advertising/1960–1969 yielded 12 playable video cards. Opened “Thrill dishwashing soap vintage ad 1963”; native playback progressed through the entire 60.09-second clip with no playback error. Verified video-file actions and rights metadata in the detail dialog.
- Internet Archive also produced an intermittent upstream 502 and timeout during repeated live API tests. Those failures use the existing source-unavailable/retry UI without affecting other providers.
- Verified the new homepage Tulsa shortcut, the eleven-source count, and no horizontal overflow at the default desktop viewport.
- 22 deterministic tests and final production build/TypeScript pass. The browser checks use live archive data, not fixtures. Video verification preloads metadata only; full playback begins on user interaction.

## Historical video cutoff

- 26 deterministic tests passed; production build and TypeScript passed.
- Boundary checks include 1980, 1981, undated videos, 1980s decade, ranges spanning 1980, ambiguous shorthand dates, source date precedence, All-media searches, and newer still images.
- Mock upstream tests verify query caps and rejection of newer records even when an upstream response ignores its filter.
- Browser review of the production build on localhost:3033: `advertising`, Internet Archive, Video, 1960–1969 returned 11 verified video preview cards. The persistent 1980 cutoff notice is visible beside the media controls.
- Global archive research is documented in GLOBAL-ARCHIVES.md; those additional institutions are not presented as implemented providers.

## Europeana and DigitalNZ integrations

- 32 deterministic tests pass; production build and TypeScript pass.
- Tests cover both response envelopes, Europeana multilingual record details, header-only credential transport, authenticated redirect rejection, missing-key behavior, source-ID validation, metadata-versus-media rights, multi-date video cutoff enforcement, and omission of external-player-only video records.
- Real DigitalNZ search and record endpoints were checked without credentials. Browser verification of `advertising`, Images, 1960–1969 displayed 18 loaded image previews and no “Preview unavailable” text.
- Europeana requires the Vercel-configured key for live verification. No key values are downloaded or included in the source tree.
