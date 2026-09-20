# Changelog

All notable changes to the Design Museum Gent API are documented here.
This project follows [Semantic Versioning](https://semver.org): `MAJOR.MINOR.PATCH`.

- **MAJOR** — breaking changes (new version required)
- **MINOR** — new features, backwards compatible
- **PATCH** — bug fixes, backwards compatible


## [v2.7.0] — 2026-09-19

### Added

- `GET /v2/id/object/{PID}/similar` — objects whose photographs sit nearest to a given object's in embedding space
  - Backed by 12,325 CLIP image embeddings (`ViT-L-14-openai`, 768 dimensions, L2-normalised) covering 7,307 published objects
  - **Nothing here is catalogued.** The model was never shown this collection and has no access to any record — it compares pictures. The twelve nearest objects to `1975-0061`, a tile painted with a sea creature, are all decorative tiles and almost all depict sea creatures, across different designs and centuries, at similarities of 0.92–0.95. No cataloguer recorded "sea creature" as a category
  - Parameters: `?limit=` (1–50, default 12), `?minSimilarity=` (0–1, default 0)
  - Each member carries `similarity` alongside the usual images and manifest reference
  - Backed by new `get_similar_objects()` RPC (migration 014)

- `palette` on `GET /v2/id/colors/dominant` members — every colour measured in the object, not only the one queried
  - Up to ten entries with `hex`, `css`, `base` and `percentage`, ordered by share
  - Read from the **first image only**, because the thumbnail served alongside is the first image; a palette averaged across every view would describe a different picture
  - Backed by the `colors` column now returned from the dominance RPCs (migration 013)

- `?minCount=` and `?swatchesPerBase=` are now actually applied on `GET /v2/id/colors`. Both were documented in v2.6.0 but never read by the handler, so `?swatchesPerBase=40` silently returned the default six

### Fixed

- **Thumbnails were broken for every image on `beeldbank-temp.stad.gent`.** Thumbnail URLs were built by rewriting the size segment to `400,`, which that server rejects with `400 Invalid size requested` — it declares `"profile": "level0"` and accepts only a fixed set of named sizes. Thumbnails there now use `thm`
  - Note this makes `thumbnail` **200px wide on that host** and 400px on `api.collectie.gent`. Anything sizing a grid on the assumption of 400px will get softer images for the former
  - Full-resolution URLs were never affected
  - The rewrite now operates on path position rather than matching known suffixes, so images with a non-default rotation, quality or format get a thumbnail too — previously they silently got none

- Malformed `@id` on `GET /v2/id/colors/dominant` members: the URI was built as `${BASE_URI}/id/object/…` where `BASE_URI` already ends in a slash, emitting `/v2//id/object/1999-0068`

- `GET /v2/id/colors/dominant` now excludes unhealthy and non-canonical records. It was the last collection endpoint that did not, so withdrawn objects and records whose URI redirects elsewhere could appear in results

### Changed

- Expect the dominant colour results to shift slightly with the health and canonicity filters applied. Nothing that disappears was correct to show

### Documentation

- New reference page for `/v2/id/object/{PID}/similar`, including what CLIP measures, what it cannot know, and how to walk a thread without getting stuck between mutual nearest neighbours
- `thumbnail` described as a small derivative whose width varies by image server, rather than as 400px

### Notes

- All changes are additive within v2. No field removed or renamed
- Three in ten published objects have no image embedding. `/similar` returns an empty collection with `200` for those — the object exists, the question is simply unanswerable for it

## [v2.6.0] — 2026-09-18

### Added

- `GET /v2/id/production` — new time index endpoint. Returns two measures of time per bucket of years: how much of the published collection was being made then, and how many objects entered the collection then
  - **Weighted, not a histogram.** Only about a quarter of dated objects carry an exact year; the rest are spans, 362 of them over a century wide. Each object contributes a total weight of exactly 1, spread evenly across the years of its span, so precisely dated objects concentrate and vaguely dated ones spread thin. Total area equals the number of dated objects, making each bucket's `weight` a genuine share of the collection
  - Four measures per bucket: `weight` (the distributed measure), `object_count` (spans merely touching the bucket — sums to far more than the collection and is not a share of anything), `exact_count` (objects dated to a single year) and `spread_factor` (`object_count / weight`, a measure of how vaguely a period is dated)
  - **Acquisition is counted, not weighted.** An acquisition date is a point — the museum took the object on one day — so `acquired` is a plain count. It is deliberately spiky: collections grow in events, and 173 objects share a single acquisition date of 1990-02-16. It begins in 1904, a year after the museum was founded
  - Coverage: 9,809 of 10,238 published objects carry a production span; 7,481 carry an acquisition year
  - Parameters: `?bucket=` (5–100 years, default 10), `?yearFrom=`, `?yearTo=`, `?onDisplay=`, `?q=`
  - Each bucket carries a ready-to-use `filter` URL listing the objects **produced** in that period. There is no equivalent filter for acquisition year, so `acquired` cannot currently be clicked through
  - Backed by new `acquisition_year` column and `get_time_index()` RPC

- `acquisition_year` column on `dmg_objects_LDES`, extracted from `crm:P24i_changed_ownership_through` → `crm:P4_has_time-span`. Internal — it does not appear in any response; acquisition dates continue to be served from the JSON-LD as before

- `hex` on every entry of `GET /v2/id/colors` — a renderable hex value for each base colour and named tone
  - Computed as a weighted centroid of every occurrence of that tone, weighted by how much of each image the colour covered
  - Averaged in **linear light** rather than on gamma-encoded sRGB, which avoids the darkening and desaturation that channel-wise hex averaging produces
  - Necessary because the names in `css_colors` are from the extended Wikipedia/xkcd lists, not CSS keywords — `Davy's grey`, `Grullo`, `Tuscan tan` cannot be passed to a stylesheet

- `swatches` on `base_colors` — the constituent named tones that make up each base colour, heaviest first, each with its own hex, object count and weight
  - A base colour is a bucket, not a tone: `orange` spans `#5a3f29` to `#b79585`, so a single averaged colour lands on an unrepresentative muddy brown

- `?minCount=` on `GET /v2/id/colors` — minimum number of objects a colour must appear on to be listed. Default `1` (no-op)
- `?swatchesPerBase=` on `GET /v2/id/colors` — how many constituent tones each base colour returns. Default `6`, max `100`

- Landing page at `https://data.designmuseumgent.be/` with content negotiation
  - `Accept: text/html` returns a human-readable page; RDF types (`application/ld+json`, `application/rdf+xml`, `text/turtle`, …) return `303 See Other` to the DCAT catalog at `/v2/`
  - The catalog keeps one canonical URI — the root points at it rather than becoming a second place it lives
  - `Vary: Accept` on every response

### Fixed

- **Production dates were NULL on every object.** `production_year_begin` and `production_year_end` were empty on all 10,238 healthy records, which silently disabled `?date=`, `?dateFrom=`, `?dateTo=` and `sortBy=dateBegin` / `dateEnd` — all four were documented and all four returned nothing. Two separate faults in the extraction:
  - `crm:P108i_was_produced_by` and `crm:P94i_was_created_by` are arrays; using `->` with a text key on an array returns NULL on every row
  - `crm:P82a_begin_of_the_begin` is an object (`{"@type": "xsd:gYear", "@value": "1898"}`), so `->>` serialised the whole object rather than reading the year
  - Also corrected the digit handling: `"1858-03-25"` was becoming `18580325` rather than `1858`
  - Coverage after the fix: 9,809 of 10,238 healthy objects carry a usable span

- **French concept search returned nothing.** `?conceptSearch=chaise` returned 0 results while `chair` and `stoel` returned ~900 each. The thesaurus vector was built with the French stemmer (`chaise` → `chais`) while the endpoint queries with the `simple` config (`chaise`), so the two never met. Dutch and English worked only by luck, for words their stemmers leave unchanged
  - Fixed by adding unstemmed (`simple`) copies alongside the stemmed vectors on both `dmg_thesaurus_LDES` and `dmg_objects_LDES`
  - The same fault affected `?q=` against English and French titles, which are indexed with their own stemmers but queried with `dutch`
  - Note: this restores exact-word matching in all three languages but not plurals — `chaises` still will not find `chaise`

- Records whose persistent URI redirects elsewhere are now excluded from `GET /v2/id/objects`
  - A record that was merged, renumbered or withdrawn stays fully resolvable at `/v2/id/object/{PID}` — returning `301` or `410` — but no longer appears in the collection listing
  - Backed by a new generated `is_canonical` column comparing `PURI` against `RESOLVES_TO`
  - Affects 58 objects that were healthy but redirecting

- `MASTER_RESYNC` no longer aborts on a single malformed record. A set-returning function in a `FROM` list is evaluated **before** the `WHERE` clause filters anything, so `jsonb_typeof(...) = 'array'` in a WHERE never protected `jsonb_array_elements(...)` beside it. One object-shaped record was enough to stop the entire table update. Type checks moved inside the function arguments throughout

### Changed

- Production and creation dates are now combined rather than prioritised. `production_year_begin` takes the earliest begin and `production_year_end` the latest end across **both** `crm:P108i_was_produced_by` and `crm:P94i_was_created_by`. An object designed in 1898 and produced in 1902 now spans 1898–1902 rather than reporting 1902 alone
  - No consumer has seen the previous behaviour, since the columns were always NULL

### Documentation

- New reference page for `/v2/id/production`, including why the weighting exists and how to read `spread_factor`
- `?onDisplay=` corrected: it is **tri-state**, not boolean. Omitting it returns all objects; `onDisplay=false` actively selects objects *not* on display, which is a different and much smaller set
- `css_colors` values documented as extended Wikipedia/xkcd names rather than CSS keywords
- Base colour list corrected to **twelve** categories — `beige` exists in the data and was missing from the documented list of eleven
- Scope stated explicitly across the documentation: these endpoints describe the objects published through the API — around ten thousand of the twenty-four thousand the museum holds. Which objects have been published is itself a decision that shapes every figure returned

### Notes

- All changes are additive within v2. No existing field has been removed or renamed, and `production_year_*` are internal columns that never appeared in any response — the JSON-LD structure is unchanged
- The date filters change behaviour from "returns nothing" to "returns results", which cannot break a consumer that was relying on the documented behaviour
## [v2.5.3] — 2026-06-05

### Added

- Exhibition installation views (zaalzichten) from Supabase storage bucket (`exhibition_views/{exh_PID}/`) are now exposed on exhibition records as `crm:P138i_has_representation`, typed as Getty AAT `300210730` (exhibition view) — all images in the subfolder matching the exhibition PID are included
- Exhibition poster images from Supabase storage bucket (`posters`) are now exposed on exhibition records as `crm:P65_shows_visual_item`, typed as Getty AAT `300027221` (poster) — filename pattern `TE_YYYY-NNN.jpeg` matches the exhibition PID

- Publications on exhibition records — `crm:P129i_is_subject_of`
  - Library records and catalogues linked to exhibitions are now exposed via the API
  - Typed using Getty AAT `300048715` (publication) as `crm:E73_Information_Object`
  - Includes title (`crm:P102_has_title`), year (`crm:P4_has_time-span`) and library URL (`@id`)
  - Sourced from new `dmg_exhibitions_publications` table, managed via admin UI
  - Multiple publications per exhibition are supported

- Curator on exhibition records — `crm:P14_carried_out_by`
  - When a curator is known, the curator's name is exposed as a `crm:E39_Actor` node
  - Stored in the `curator` column on `dmg_tentoonstelling_LDES`, editable via admin UI


- `?concept=` filter on `/v2/id/objects` — filter by thesaurus concept PID or URI
  - Matches objects tagged with the concept as type (`crm:P2_has_type`), material (`crm:P45_consists_of`), technique (`crm:P32_used_general_technique`) or sub-collection (`crm:P106i_forms_part_of`)
  - Automatically expands to include all narrower concepts from the thesaurus hierarchy via recursive CTE
  - Accepts PID (`530000049`) or full URI
  - Backed by indexed `concept_uris text[]` column with trigger-based sync on harvest

- `?conceptSearch=` filter on `/v2/id/objects` — search the thesaurus by label and filter objects by matching concepts
  - Searches the thesaurus full text index and returns objects tagged with any matching concept
  - Also expands to include narrower concepts recursively — searching `"stoel"` also returns objects tagged with `"armstoel"`, `"kinderstoel"` etc.
  - Complements exact `?concept=` URI matching

### Fixed

- Exhibition records missing `@id` are now excluded from the `/v2/id/exhibitions` collection response
  - Records without an `exh_PID` were returned without an `@id` field, breaking imports that use `@id` as a unique identifier
  - Fixed by requiring `exh_PID IS NOT NULL` in the collection query

- Date filter (`?dateFrom=`, `?dateTo=`, `?date=`) now correctly excludes objects with no production date
  - Previously, objects with `NULL` production dates were included in date-filtered results because `NULL >= value` evaluates to NULL in PostgreSQL, not false
  - Fixed by explicitly excluding NULL date rows when any date filter is active

- Fix exhibitions API: remove extraneous slashes in exhibition `@id` and identifier URIs.

### Changed

- Swagger version bumped to `2.8.0`

---

## [v2.5.2] — 2026-06-03

- `?date=YYYY/YYYY`, `?dateFrom=` and `?dateTo=` filters on `/v2/id/objects` — filter by production date range using EDTF interval notation; stored as indexed integer columns `production_year_begin` and `production_year_end`
- `?conceptSearch=` filter on `/v2/id/objects` — search the thesaurus by label and filter objects by matching concepts; complements exact `?concept=` URI matching

## [v2.5.1] — 2026-06-01

### Added

- `?language=NLD/FRA/ENG` filter on `/v2/id/objects` — returns only objects that have a title in the specified language, useful for identifying incomplete translations
- `?language=NLD/FRA/ENG` filter extended to `/v2/id/concepts` and `/v2/id/exhibitions` — returns only records with content in the specified language
- `?hasColors=true` filter on `/v2/id/objects` — returns only objects processed by the color tagger, independent of `?colors=true` which includes color data in the response
- `?agent=DMG-A-XXXXX` filter on `/v2/id/objects` — returns all objects linked to a specific agent as designer (`crm:P94i_was_created_by`) or producer (`crm:P108i_was_produced_by`)

## [v2.5.0] — 2026-05-27

### Added

- Creative projects (`crm:P15i_was_motivation_of`) and media (`crm:P129i_is_subject_of`) enrichment on object records sourced from `dmg_objects_projects` and `dmg_objects_media` tables
- `crm:P106i_forms_part_of` — sub-collection and provenance group membership on object records
  - Sourced from `collectie` field in the erfgoed API
  - Typed as `crm:E78_Curated_Holding` — distinct from physical koepelrecord relationships (`crm:P46i_forms_part_of`)
  - Resolved to internal DMG concept URIs where available, with `owl:sameAs` pointing to the external Stad Gent URI
  - Example: `"legaat Havermans"`, `"Val-Saint-Lambert"`

- Media and audio on object records — `crm:P129i_is_subject_of`
  - Video and audio resources from `dmg_objects_media` table are now included alongside the IIIF manifest
  - Typed using Getty AAT: `300263419` (video), `300263472` (audio), title and year are included.
  - Non-breaking — IIIF manifest remains unchanged, media nodes are added to the existing array

- `prov:generatedAtTime` documented in API reference for all entity endpoints
  - Explains the timestamp as the last harvest date, not the object creation date
  - Links to `?modifiedSince=` and `ETag`/`Last-Modified` headers for incremental sync workflows

- Wikipedia thumbnail on agent records — `crm:P65_shows_visual_item`
  - When a Wikipedia thumbnail is available it is exposed as a `crm:E36_Visual_Item` with pixel dimensions
  - Licensed under CC BY-SA 4.0 with source link
  - First available thumbnail across Dutch, English and French Wikipedia is used

### Notes

- Stad Gent URIs (`stad.gent/id/...`) used in `owl:sameAs` throughout the API are persistent identifiers but **do not currently resolve** — documented in the API reference
- All changes are non-breaking within v2 — no existing fields removed or renamed

## [v2.4.0] — 2026-05-19

### Added

- `crm:P138i_has_representation` on `GET /v2/id/object/{PID}` and on each `hydra:member` of `GET /v2/id/colors/dominant` — array of `crm:E38_Image` blocks with direct, validated IIIF image URIs, in canvas order
  - Each `crm:E38_Image` carries `@id` (full-resolution IIIF URI), `thumbnail` (400px-wide IIIF derivative), `crm:P3_has_note` (attribution string) and `crm:P104_is_subject_to` → `crm:E30_Right` (rights statement URI)
  - Lets clients render images without dereferencing the IIIF manifest first
  - Omitted when an object has no validated images

- `image` convenience field alongside `crm:P138i_has_representation` on the same endpoints — repeats the first image as a single object for clients that only need a thumbnail
  - Not a CIDOC property — purely a developer shortcut, equivalent to `crm:P138i_has_representation[0]`
  - JSON-LD consumers doing triple processing should ignore this field

- Per-image rights and attribution on every image block
  - `crm:P104_is_subject_to` resolves to the canonical rights URI (rightsstatements.org / Creative Commons)
  - `crm:P3_has_note` carries the photographer / source / rightsholder string as recorded in the IIIF manifest

### Changed

- Image URIs returned by the API are now HEAD-validated against the IIIF image server — only URIs returning 2xx/3xx are included. Forbidden (`403`) and missing (`404`) images are pruned, so the image fields contain working links by construction.

### Notes

- Existing responses remain backwards compatible. Clients that read only `crm:P129i_is_subject_of` (the IIIF manifest reference) continue to work unchanged — the manifest link is still returned alongside the new fields.

---

## [v2.3.0] — 2026-05-07

### Added

- `?nationality=` query parameter on `GET /v2/id/agents` — filter by nationality
  - Comma-separated for multiple values (AND)
  - Use `/v2/id/nationalities` to discover available values
  - Example: `GET /v2/id/agents?nationality=België`

- `?hasParts=true` query parameter on `GET /v2/id/objects` — only return koepelrecords
  - Example: `GET /v2/id/objects?hasParts=true&fullRecord=true`

- `?isPartOf=true` query parameter on `GET /v2/id/objects` — only return components
  - Example: `GET /v2/id/objects?isPartOf=true`

- `Link` header on all collection endpoints following RFC 8288
  - Exposes Hydra pagination (`first`, `last`, `next`, `prev`) as HTTP headers
  - Allows clients to paginate without parsing the JSON-LD body
  - Example: `Link: <...?page=1>; rel="first", <...?page=2>; rel="next"`


- `GET /v2/id/colors` — new color index endpoint listing all available base colors and CSS color names with object counts
  - Returns two lists: `base_colors` (11 base categories) and `css_colors` (900+ named colors)
  - Each entry includes the color value, object count, and a ready-to-use filter URL
  - Useful for building color picker UIs without guessing what values exist in the collection
  - Example: `GET /v2/id/colors`

- `color` query parameter on the objects collection (`/v2/id/objects`) — filter by base color
  - Accepts one or more comma-separated base colors
  - Available values: `red`, `orange`, `yellow`, `green`, `blue`, `purple`, `pink`, `brown`, `grey`, `black`, `white`
  - Example: `GET /v2/id/objects?color=pink`
  - Example: `GET /v2/id/objects?color=pink,grey`

- Weighted color statistics on `GET /v2/id/colors`
  - `collection_share_pct` — percentage of the total collection palette each color represents
  - `avg_dominance_pct` — average dominance of a color when it appears in an object
  - Both statistics available for base colors and CSS color names
  - Each entry includes a `dominant` link to the new dominant endpoint

- `GET /v2/id/colors/dominant` — new endpoint returning objects sorted by color dominance
  - Supports both `?color=` (base color) and `?cssColor=` (CSS color name)
  - `?limit=` parameter (default 20, max 100)
  - Each result includes `dominance_pct` — the percentage of the object covered by that color
  - Example: `GET /v2/id/colors/dominant?color=black` returns the blackest objects in the collection

- `cssColor` query parameter on the objects collection — filter by CSS color name
  - Accepts one or more comma-separated CSS color names from the 900+ color lookup table
  - Example: `GET /v2/id/objects?cssColor=Old rose`
  - Example: `GET /v2/id/objects?cssColor=English lavender,Mountbatten pink`

- Both filters can be combined with each other and with existing filters (`hasImages`, `modifiedSince`, `fullRecord`, `colors`)
  - Example: `GET /v2/id/objects?color=pink&hasImages=true&fullRecord=true`
  - All active filters are preserved in Hydra pagination links

- `q` query parameter on objects and agents collection endpoints — full text search
  - Supports single words, phrases, AND/OR operators and negation
  - Objects: searches titles (NL/FR/EN), descriptions (NL/FR/EN) and object number
  - Agents: searches agent name and agent ID
  - Titles and object numbers are weighted higher than descriptions
  - Compatible with all existing filters
  - Example: `GET /v2/id/objects?q=roze glas&hasImages=true`
  - Example: `GET /v2/id/agents?q=Sabino`
  
## [v2.1.0] — 2026-05-04

### Added

- `modifiedSince` query parameter on all collection endpoints (`/v2/id/objects`, `/v2/id/agents`, `/v2/id/exhibitions`, `/v2/id/concepts`) — filter records modified on or after a given date
    - Format: `YYYY-MM-DD`
    - Example: `GET /v2/id/objects?modifiedSince=2026-05-01&fullRecord=true`
    - Invalid date format returns `400 Bad Request`
    - Parameter is preserved in all Hydra pagination links

- Incremental harvesting in all harvesters — each harvester now records the timestamp of its last successful run in a new `dmg_harvest_log` Supabase table and uses `modifiedSince` on subsequent runs
    - Full harvest on first run (no previous timestamp)
    - Subsequent runs fetch only records modified since the last harvest date
    - Harvest log can be reset per endpoint to force a full re-harvest

- `colors` query parameter on the object endpoint (`/v2/id/object/{PID}`) and objects collection (`/v2/id/objects`) — include full color data in the response
  - Hidden by default to keep payloads small
  - Enable with `?colors=true`
  - Example: `GET /v2/id/object/1987-1105?colors=true`
  - Example: `GET /v2/id/objects?fullRecord=true&colors=true`
  - Parameter is preserved in all Hydra pagination links

- Enriched color data model — color annotations now stored as structured `colors` column alongside legacy `HEX_values` and `color_names` columns
  - Each color entry includes `hex`, `css`, `base` and `percentage`
  - Modelled in CIDOC-CRM as `crm:E36_Visual_Item` with two `crm:E26_Physical_Feature` nodes per image:
    - `colors/hex` — exact HEX values with CSS name and percentage as `crm:E54_Dimension`
    - `colors/base` — base colors (red, blue, grey, etc.) grouped and aggregated by percentage
  - Multi-image objects each get their own `crm:E36_Visual_Item` node

- Background removal via `rembg` neural network in the color tagger — foreground pixels only are used for color extraction, preventing white and grey studio backgrounds from skewing results

---

## [v2.0.0] — 2026-04-30

### 🚀 Major release — CIDOC-CRM API

Complete rewrite of the data model using pure CIDOC-CRM compliant JSON-LD. v1 is deprecated and will be sunset on 31 December 2026.

#### Data model
- Replaced mixed Linked Art / OSLO model with strict **CIDOC-CRM**
- All resources serialised as **JSON-LD** with persistent, Flemish URI standard compliant identifiers
- Provenance tracked via **PROV-O** (`prov:generatedAtTime`)
- Authority links via `owl:sameAs` to Getty, Wikidata, Stad Gent datahub

#### Objects — `crm:E22_Human-Made_Object`
- Production modelled as `crm:E12_Production`
- Design/creation modelled as `crm:E65_Creation` — supports multiple creators as array
- Acquisition as `crm:E8_Acquisition`
- Dimensions as `crm:E54_Dimension`
- Physical parts via `crm:P46_has_component`
- Materials as `crm:E57_Material` resolved to internal DMG concept URIs
- Exhibition participation via `crm:P12i_was_present_at`
- Color data as `crm:E36_Visual_Item` with two `crm:E26_Physical_Feature` nodes (HEX + CSS)
- IIIF manifest as `crm:E73_Information_Object`
- Object resolver — merged objects return `301 Moved Permanently`, removed objects return `410 Gone`

#### Agents — `crm:E39_Actor`
- Birth and death events as `crm:E67_Birth` / `crm:E69_Death` with Getty TGN place references
- Nationality via EU Publications Office country authority URI
- Gender via EU Publications Office human sex authority URI
- Wikipedia biographies as `crm:E33_Linguistic_Object` with CC BY-SA 4.0 attribution
- Wikipedia titles as multilingual `crm:E41_Appellation` with source link
- Exhibition participation via `crm:P12i_was_present_at` (from junction table)

#### Exhibitions — `crm:E7_Activity`
- Objects shown via `crm:P16_used_specific_object` with internal DMG URIs
- Multilingual titles as `crm:E41_Appellation` per language
- Multilingual descriptions as `crm:E33_Linguistic_Object`
- Time span via `crm:P4_has_time-span` with ISO 8601 interval

#### Concepts — `crm:E55_Type`
- SKOS labels (`skos:prefLabel`) and scope notes (`skos:scopeNote`) in NL, FR, EN
- Broader/narrower hierarchy enriched with internal DMG URIs via `owl:sameAs`
- Authority links to Getty AAT

#### Collections & pagination
- All entity types available as paginated **Hydra collections**
- `?fullRecord=true` for bulk harvesting
- `?hasImages=true` filter on objects collection
- Max 100 records per page

#### DCAT catalog
- Top-level catalog at `GET /v2/` and `GET /v2/dcat`
- Describes all four datasets with multilingual titles, CIDOC-CRM types and distribution info

#### Multilingual support
- Titles and descriptions available in Dutch, French and English via `crm:E41_Appellation`
- Language tags use EU Publications Office language authority URIs (`NLD`, `ENG`, `FRA`)

#### Lookup maps
- All agent, concept and object URIs resolved to internal DMG URIs at harvest time
- External authority URIs preserved as `owl:sameAs`

#### Deprecation headers on v1
- All v1 responses now include `Deprecation`, `Sunset` and `Link` headers

---

## [v1.x.x] — archived

v1 is deprecated. See the [v1 documentation](https://data.designmuseumgent.be/v1/) for the archived changelog.

---

<!-- 
TEMPLATE FOR NEW RELEASES — copy and fill in above this line

## [vX.Y.Z] — YYYY-MM-DD

### Added
- 

### Changed
- 

### Fixed
- 

### Deprecated
- 

### Removed
- 

-->