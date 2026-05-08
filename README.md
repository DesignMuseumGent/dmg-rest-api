# DESIGN MUSEUM GENT — REST API

> [!WARNING]
> **v1 of this API is deprecated** and will be sunset on **31 December 2026**.
> Please migrate to [v2](https://data.designmuseumgent.be/v2/).
> See the [migration guide](https://data.designmuseumgent.be/v2/migration) for breaking changes.

This **REST API** exposes **linked data** related to [Design Museum Gent](https://data.designmuseumgent.be). It provides access to collection objects, agents, exhibitions and thesaurus concepts as **CIDOC-CRM compliant JSON-LD**. The data is harvested from the [Linked Data Event Streams](https://apidg.gent.be/opendata/adlib2eventstream/v1/) and all URIs are compliant with the [Flemish URI standard](https://joinup.ec.europa.eu/collection/semic-support-centre/document/uri-standard-guidelines-flemish-government).

📖 **Full documentation**: [data.designmuseumgent.be](https://data.designmuseumgent.be)
🔧 **Swagger UI**: [data.designmuseumgent.be/api-docs](https://data.designmuseumgent.be/api-docs)

---

## v2 (current)

### Collections

| Endpoint | URI | Description |
|---|---|---|
| Objects | `GET /v2/id/objects` | Paginated collection of all objects |
| Agents | `GET /v2/id/agents` | Paginated collection of all agents |
| Exhibitions | `GET /v2/id/exhibitions` | Paginated collection of all exhibitions |
| Concepts | `GET /v2/id/concepts` | Paginated collection of the thesaurus |
| Private objects | `GET /v2/id/private/objects` | Authenticated private stream |

All collection endpoints support `?fullRecord=true` for bulk harvesting, `?modifiedSince=YYYY-MM-DD` for incremental updates, `?q=` for full text search, and use **Hydra Core Vocabulary** for pagination with `Link` headers.

### Single entities

| Endpoint | URI | Description |
|---|---|---|
| Object | `GET /v2/id/object/{PID}` | Single collection object |
| Agent | `GET /v2/id/agent/{PID}` | Single agent record |
| Exhibition | `GET /v2/id/exhibition/{PID}` | Single exhibition record |
| Concept | `GET /v2/id/concept/{PID}` | Single thesaurus concept |

All single entity endpoints support `HEAD` requests for lightweight existence checks and cache validation.

### Discovery & index endpoints

| Endpoint | URI | Description |
|---|---|---|
| Colors | `GET /v2/id/colors` | Color index with weighted collection statistics |
| Colors — dominant | `GET /v2/id/colors/dominant` | Objects sorted by color dominance |
| Types | `GET /v2/id/types` | Object type index with counts |
| Materials | `GET /v2/id/materials` | Material index with counts |
| Nationalities | `GET /v2/id/nationalities` | Nationality index with counts |
| Roles | `GET /v2/id/roles` | Agent role index with counts |
| DCAT | `GET /v2/` | Machine-readable data catalog |

### Query parameters

| Parameter | Applies to | Description |
|---|---|---|
| `?fullRecord=true` | all collections | Return full CIDOC-CRM records |
| `?modifiedSince=YYYY-MM-DD` | all collections | Incremental harvest |
| `?q=` | objects, agents, concepts | Full text search |
| `?hasImages=true` | objects | Only objects with a IIIF manifest |
| `?color=` | objects | Filter by base color |
| `?cssColor=` | objects | Filter by CSS color name |
| `?colors=true` | objects (fullRecord) | Include color data |
| `?type=` | objects | Filter by object type |
| `?material=` | objects | Filter by material |
| `?hasParts=true` | objects | Only koepelrecords |
| `?isPartOf=true` | objects | Only components |
| `?onDisplay=true` | objects, types, materials, colors | Only objects in collection presentation |
| `?nationality=` | agents | Filter by nationality |
| `?role=` | agents | Filter by role (designer, producer) |

### Quick start

```bash
# fetch a single object
curl https://data.designmuseumgent.be/v2/id/object/1987-1105

# fetch a single agent
curl https://data.designmuseumgent.be/v2/id/agent/DMG-A-00162

# paginate through all objects
curl "https://data.designmuseumgent.be/v2/id/objects?page=1&itemsPerPage=50&fullRecord=true"

# full text search
curl "https://data.designmuseumgent.be/v2/id/objects?q=roze+glas&hasImages=true"

# filter by color and type
curl "https://data.designmuseumgent.be/v2/id/objects?color=pink&type=vaas&hasImages=true"

# objects currently on display
curl "https://data.designmuseumgent.be/v2/id/objects?onDisplay=true&fullRecord=true"
```

```javascript
// harvest the full collection
async function harvest(url) {
    const res = await fetch(url)
    const data = await res.json()

    // process data["hydra:member"]
    console.log(`fetched ${data["hydra:member"].length} objects`)

    if (data["hydra:view"]["hydra:next"]) {
        await new Promise(r => setTimeout(r, 250)) // polite delay
        await harvest(data["hydra:view"]["hydra:next"])
    } else {
        console.log('harvest complete')
    }
}

harvest('https://data.designmuseumgent.be/v2/id/objects?fullRecord=true&itemsPerPage=50')
```

### What's new in v2

| | v1 | v2 |
|---|---|---|
| **Data model** | Linked Art / OSLO | Pure CIDOC-CRM |
| **Serialization** | JSON-LD (mixed vocabularies) | JSON-LD (strict CIDOC-CRM) |
| **Multilingual** | single language fields | `crm:E41_Appellation` per language |
| **Nationality** | plain string | EU Publications Office URI |
| **Biographies** | `crm:P3_has_note` | `crm:E33_Linguistic_Object` + CC BY-SA |
| **Color data** | separate endpoints | `crm:E36_Visual_Item` inline |
| **Full text search** | — | `?q=` on objects, agents, concepts |
| **Color filters** | — | `?color=`, `?cssColor=` |
| **Color index** | — | `/v2/id/colors` with weighted stats |
| **Type / material filters** | — | `?type=`, `?material=` |
| **Incremental harvest** | — | `?modifiedSince=` |
| **Pagination headers** | — | RFC 8288 `Link` header |
| **HEAD requests** | — | Lightweight existence checks |
| **Base URI** | `/v1/` | `/v2/` |

---

## ~~v1~~ (deprecated — migrate to [v2](https://data.designmuseumgent.be/v2/))

> [!CAUTION]
> v1 is deprecated and will be shut down on **31 December 2026**. The documentation below is archived for reference only. All new integrations should use v2. See the [migration guide](https://data.designmuseumgent.be/v2/migration) for breaking changes.

### Data catalogues

Top level **data catalogues** (DCAT) using the [OSLO standard](https://joinup.ec.europa.eu/collection/oslo-open-standards-local-administrations-flanders):

> https://data.designmuseumgent.be/v1

Collections:
- **objects** (published): https://data.designmuseumgent.be/v1/id/objects
- **objects** (private): https://data.designmuseumgent.be/v1/id/private-objects
- **exhibitions**: https://data.designmuseumgent.be/v1/id/exhibitions
- **billboard series**: https://data.designmuseumgent.be/v1/id/exhibitions/billboardseries
- **exhibition texts**: https://data.designmuseumgent.be/v1/id/texts
- **agents**: https://data.designmuseumgent.be/v1/id/agents
- **concepts**: https://data.designmuseumgent.be/v1/id/concepts

### Single entities
https://data.designmuseumgent.be/v1/id/{type}/{referencenumber}

- **agent**: https://data.designmuseumgent.be/v1/id/agent/DMG-A-00523
- **object**: https://data.designmuseumgent.be/v1/id/object/3471.json
- **exhibition**: https://data.designmuseumgent.be/v1/id/exhibition/TE_1993-009
- **archive**: https://data.designmuseumgent.be/v1/id/archive/TE_2003-010_Affiche
- **concept**: https://data.designmuseumgent.be/v1/id/concept/530006321

ARK-compliant alternative routes are also available:
https://data.designmuseumgent.be/v1/id/ark:/29417/{type}/{referencenumber}

### Curated collections

#### Color API
```
GET /v1/color-api/{color}
GET /v1/color-api/{color}?image=true
```
Example: https://data.designmuseumgent.be/v1/color-api/vanilla?image=true

Full color list: https://data.designmuseumgent.be/v1/colors/

---

## Standards

- [CIDOC-CRM](http://www.cidoc-crm.org/) — core data model (v2)
- [OSLO](https://joinup.ec.europa.eu/collection/oslo-open-standards-local-administrations-flanders) — Flemish government standard (v1)
- [Flemish URI standard](https://joinup.ec.europa.eu/collection/semic-support-centre/document/uri-standard-guidelines-flemish-government) — persistent identifiers
- [Hydra Core Vocabulary](http://www.w3.org/ns/hydra/core#) — pagination
- [PROV-O](https://www.w3.org/TR/prov-o/) — provenance
- [Getty vocabularies](http://vocab.getty.edu/) — AAT, ULAN, TGN
- [EU Publications Office](https://publications.europa.eu/resource/authority/) — language, country, gender authorities
- [RFC 8288](https://www.rfc-editor.org/rfc/rfc8288) — `Link` header pagination

## Support

- 📖 [Documentation](https://data.designmuseumgent.be)
- 🔧 [Swagger UI](https://data.designmuseumgent.be/api-docs)
- 🐛 [GitHub Issues](https://github.com/DesignMuseumGent/dmg-rest-api/issues)
- 📧 [olivier.vandhuynslager@stad.gent](mailto:olivier.vandhuynslager@stad.gent)

---

Development and coordination by [Olivier Van D'huynslager](https://oliviervandhuynslager.net) — [Studio Digitaal](https://www.designmuseumgent.be/en/studios/studio-digitaal), Design Museum Gent