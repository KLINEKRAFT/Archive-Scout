# Historical film and print discovery — 6 October 2026

## Integrated in this update

These are collection scopes within existing providers, not duplicate provider adapters. All displayed items retain their original record link and item-specific rights evidence. Cover previews represent print items; PDFs and original archive readers provide full-page access.

- **WPA posters** — [Library of Congress collection](https://www.loc.gov/collections/works-progress-administration-posters/about-this-collection/). Federal Art Project posters, 1936–1943. Uses the collection-specific JSON endpoint rather than keyword-only search.
- **WWI posters** — [Library of Congress collection](https://www.loc.gov/collections/world-war-i-posters/about-this-collection/). Shortcut is limited to 1914–1918; the original collection also contains post-war material.
- **WWII posters** — dated 1939–1945 searches through LOC and Europeana. This is a thematic search, not a claim of a dedicated combined institutional collection.
- **National Screening Room** — [LOC films](https://www.loc.gov/collections/national-screening-room/) with documented [JSON endpoints](https://www.loc.gov/apis/json-and-yaml/requests/endpoints/). The adapter now recognizes movies, extracts archive-supplied MP4s, and requires known production dates no later than 1980 plus playable browser metadata.
- **Prelinger** — [Internet Archive collection](https://archive.org/details/prelinger), searched with an explicit collection scope through the existing [Internet Archive APIs](https://archive.org/developers/). Advertising, industrial, educational and home movies; no blanket rights assumption.
- **WWI / WWII film** — thematic LOC and Internet Archive searches dated 1914–1918 and 1939–1945. Modern documentaries about those wars are excluded by production date.
- **Trade catalogs** — Internet Archive texts with the trade-catalog subject, 1800–1980. Live results include the Caroline Simpson Library / Museums of History NSW. Smithsonian also confirms its [digitized books are hosted at Internet Archive](https://library.si.edu/digital-library/FAQ), including trade literature. Original contributor rights remain authoritative.
- **Comics** — Internet Archive scanned texts with the comics subject, 1800–1980; cover preview, original reader link and available public PDF/EPUB files. Modern uploads do not change the cataloged original date.
- **Printed matter** — public Internet Archive text scans dated 1800–1980, with working covers and accessible document files. Undated, newer and access-restricted print items are excluded.

## Additional archival film sources found

- **National Archives (NARA), United States:** substantial institutional [WWI film holdings](https://www.archives.gov/research/motion-pictures/ww1) and [WWII film holdings](https://www.archives.gov/research/motion-pictures/ww2). Its current [Catalog API requires an issued API key](https://www.archives.gov/research/catalog/help/api-getting-started). Not integrated or represented as playable results in this update. This is the next strongest source for wartime footage once access is available.
- **NYPL:** [Digital Collections API](https://api.repo.nypl.org/) offers institutional image and metadata discovery, including digitized print collections. [NYPL's collection overview](https://digitalcollections.nypl.org/about) also links bulk public-domain data. Not integrated in this update.
- Other international film discovery links and their integration limits remain documented in [GLOBAL-ARCHIVES.md](GLOBAL-ARCHIVES.md).

## Loading behavior

Searches automatically fetch the next page near the bottom of the result grid, only after the current batch and preview checks settle. Exhausted sources stop being queried; repeated upstream pages stop that source rather than cycling forever. The previous page-100 clamp is removed. Loading is incremental, not an up-front request for every archive record. Filters, known archive limits, outages and preview availability still determine what can be displayed. Cross-source and cross-page duplicate suppression remains active.

## Verification

- 45 deterministic tests pass; optimized production build passes.
- Home browser rendered eight decoded photos from all four discovery providers. Removed hero copy and source band are absent.
- WPA browser results increased from 23 to 47 cards solely through scrolling; all 47 image URLs were distinct and the manual load button was absent.
- National Screening Room admitted 23 film previews. Opened the 1918 film Last known home of Czar Nicholas; its MP4 reached readyState 4, 1440-pixel width and 115.875-second duration in the native player.
- Trade catalogs displayed 11 cover previews with no Preview unavailable cards.
- Live adapters returned WPA posters, Screening Room films, Prelinger movies, trade catalogs and comics. Catalog/comic scans expose public PDF/EPUB options and exclude private files.
