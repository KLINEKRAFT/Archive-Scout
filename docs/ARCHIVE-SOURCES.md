# Archive expansion research — 2026-10-06

## Added and live-tested

| Source                                                                    | Relevant holdings                                                                                                                                    | API and preview path                                                                                               | Key  |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ---- |
| [Tulsa City-County Library](https://digitalcollections.tulsalibrary.org/) | Beryl Ford photographs and television advertising slides; Austin Hellwig street photography; Oklahoma postcards; maps; oil industry; library history | CONTENTdm `dmQuery`, `dmGetItemInfo`; IIIF image and presentation APIs                                             | None |
| [Oklahoma Digital Prairie](https://digitalprairie.ok.gov/)                | Images of Oklahoma and Oklahoma Postcards, including Tulsa street scenes                                                                             | CONTENTdm search; compound postcards/books resolve to their first IIIF image and retain the complete source record | None |
| [Internet Archive](https://archive.org/developers/)                       | Images, films, commercials, industrial/educational films, and Prelinger holdings                                                                     | Advanced Search for image/movie metadata; per-item Metadata API for playable MP4/WebM files and originals          | None |
| [NASA Image and Video Library](https://images.nasa.gov/)                  | Spaceflight photography, Apollo-era imagery and archival film                                                                                        | [Search and asset-manifest API](https://images.nasa.gov/docs/images.nasa.gov_api_docs.pdf)                         | None |

The regional APIs were checked directly against the institutions' hosts. The [OCLC server API reference](https://help.oclc.org/Metadata_Services/CONTENTdm_classic_version/Advanced_website_customization/API_Reference/CONTENTdm_classic_version_API/CONTENTdm_classic_version_Server_API_Functions_dmwebservices) documents the search/metadata endpoints; [IIIF support](https://help.oclc.org/Metadata_Services/CONTENTdm_classic_version/Advanced_website_customization/API_Reference/IIIF_API_reference/IIIF_API_support_summary) documents image and manifest patterns.

Tulsa examples returned by the API: Midas Muffler Shop advertising slide, Jack Horner advertising slide, Thrif-T-Wise advertising slide, Tulsa Boosters Club billboard, and Austin Hellwig streets/intersections. Many local images have no catalog date. They remain searchable without an era filter but do not silently acquire an inferred year.

Internet Archive is an aggregator with contributor-supplied metadata and rights. Open access does not imply permission to reuse. Only records with direct playable files are offered as video; browser metadata loading verifies the stream before admission. NASA catalog dates may refer to publication or digitization rather than when historical footage was filmed. [NASA usage guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/) apply; no blanket public-domain label is assigned.

API availability varies. Internet Archive returned successful results and playable files, but also an intermittent 502 and timeout during the live tests. The UI preserves other archives' results and allows retry. No authentication or rate-limit bypass is used.

## Further expansion status

- **[NYPL Digital Collections API](https://api.repo.nypl.org/):** photographs, posters, menus, maps and ephemera. Requires a registered API token. Test a token-backed adapter before enabling it.
- **[Europeana APIs](https://www.europeana.eu/en/apis):** cross-institution European cultural collections. [API-key registration](https://www.europeana.eu/en/how-to-register-for-and-manage-an-api-key) is available through a Europeana account. Now implemented; media availability and licenses vary by contributing institution.
- **[DigitalNZ](https://digitalnz.org/developers/api-docs-v3):** a promising additional national aggregator. Current documentation says public content no longer requires a key; the adapter is now implemented with optional DIGITALNZ_API_KEY authentication and conservative media-rights mapping.
- **[Trove](https://trove.nla.gov.au/sites/default/files/attachments/2023-05/Introducing%20Trove%20API%20v3_0%20-%20Release%202.pdf):** Australian collections and historical newspapers; the official v3 documentation describes key-based access. Verify current account eligibility before implementation.
- **[Tulsa Historical Society & Museum](https://www.tulsahistory.org/learn/collections-research/):** substantial photographic and film holdings. I did not find a documented public search API in the reviewed institutional material, so this is not represented as an API provider. [Their photograph page](https://www.tulsahistory.org/learn/collections-research/photographs/) describes image requests and permissions. Some Beryl Ford material is already reachable through the library integration.

## Deployment address

Use https://archive-scout-ivory.vercel.app/ for the current production version. The originally shared `archive-scout-9aty9qw44-…vercel.app` address identifies an older immutable deployment. PR #2 was merged and deployed as main commit `2fa13f9`; its live 1960s Advertising search showed 24 working previews and no unavailable cards during this review.
