# V&A, Gallica, country filters and duplicate suppression

Validated 6 October 2026.

- 39 deterministic tests pass, including transitive cross-provider matching, repeated pages, same-title distinct assets, image derivatives, saved aliases, country filtering, XML safety, rights handling and the existing <=1980 video rules.
- Production build succeeds.
- Live V&A advertising search, 1960–1969: 24 records on each of two pages, zero repeated record IDs; item detail succeeds. V&A retains its broad catalog date intervals where supplied.
- Live Gallica publicite search, 1960–1969: 545 upstream matches; 24 records on each of two pages, zero repeated record IDs; item detail succeeds.
- Browser: V&A two-page view contains 48 cards with 48 distinct image URLs and no Preview unavailable text. Gallica first page contains 24 admitted image cards and no Preview unavailable text. All admitted previews passed browser decoding before admission; off-screen card elements are separately lazy-loaded.
- Country filtering persists in the URL and excludes mismatched institutions. Europeana uses its COUNTRY facet and supplied country metadata.
- No extra API keys required for these two sources.

Duplicate admission is after filtering and working-preview checks. URLs and source aliases merge transitively; exact decoded preview fingerprints also merge where cross-origin pixel access is allowed. Saved records retain matching aliases. Titles and shared video posters are deliberately insufficient for merging. This does not claim universal matching of independently scanned, cropped, recompressed, or inaccessible-pixel copies.
