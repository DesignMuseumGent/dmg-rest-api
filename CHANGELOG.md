# Changelog

All notable changes to the Design Museum Gent API are documented here.
This project follows [Semantic Versioning](https://semver.org): `MAJOR.MINOR.PATCH`.

- **MAJOR** — breaking changes (new version required)
- **MINOR** — new features, backwards compatible
- **PATCH** — bug fixes, backwards compatible

## [v2.3.0] — 2026-05-05

### Added

- `color` query parameter on the objects collection (`/v2/id/objects`) — filter by base color
  - Accepts one or more comma-separated base colors
  - Available values: `red`, `orange`, `yellow`, `green`, `blue`, `purple`, `pink`, `brown`, `grey`, `black`, `white`
  - Example: `GET /v2/id/objects?color=pink`
  - Example: `GET /v2/id/objects?color=pink,grey`

- `cssColor` query parameter on the objects collection — filter by CSS color name
  - Accepts one or more comma-separated CSS color names from the 900+ color lookup table
  - Example: `GET /v2/id/objects?cssColor=Old rose`
  - Example: `GET /v2/id/objects?cssColor=English lavender,Mountbatten pink`

- Both filters can be combined with each other and with existing filters (`hasImages`, `modifiedSince`, `fullRecord`, `colors`)
  - Example: `GET /v2/id/objects?color=pink&hasImages=true&fullRecord=true`
  - All active filters are preserved in Hydra pagination links

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