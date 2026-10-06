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
