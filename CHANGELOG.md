# Changelog

All notable changes to the Design Museum Gent API are documented here.
This project follows [Semantic Versioning](https://semver.org): `MAJOR.MINOR.PATCH`.

- **MAJOR** — breaking changes (new version required)
- **MINOR** — new features, backwards compatible
- **PATCH** — bug fixes, backwards compatible

## [v2.5.4] — 2026-06-05

### Added 

- Agent type classification — agents are now classified as `individual` (person) or `organisation` and this is reflected in the CIDOC-CRM `@type` field on all agent records and collection stubs
  - `crm:E21_Person` — individual persons
  - `crm:E74_Group` — organisations, studios, collectives and companies
  - `crm:E39_Actor` — agents not yet classified (fallback, unchanged from previous behaviour)
  - Classification sourced from two methods: registrar system export (`naam.soort` field: `persoon` / `instelling`) as primary source, Wikidata `instance of` (`P31`) as fallback for agents with a Wikidata `owl:sameAs` link
  - Stored in new `agent_type` column on `dmg_personen_LDES` with CHECK constraint (`individual`, `organisation`, `unknown`)

- `?type=` filter on `GET /v2/id/agents` — filter agents by classification
  - Accepted values: `individual`, `organisation`, `unknown`
  - Example: `GET /v2/id/agents?type=individual`
  - Example: `GET /v2/id/agents?type=organisation&nationality=België&role=designer`
  - Example: `GET /v2/id/agents?type=unknown` — useful for finding agents that still need manual review
  - Filter is preserved in all Hydra pagination links

### Changed
- Agent type `@type` is now reflected in lightweight stubs on `GET /v2/id/agents` — clients can determine whether an agent is a person or organisation without fetching the full record

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