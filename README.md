# DESIGN MUSEUM GENT — REST API

This **REST API** exposes **linked data** related to [Design Museum Gent](https://data.designmuseumgent.be). It provides access to collection objects, agents, exhibitions and thesaurus concepts as **CIDOC-CRM compliant JSON-LD**. The data is harvested from the [Linked Data Event Streams](https://apidg.gent.be/opendata/adlib2eventstream/v1/) and all URIs are compliant with the [Flemish URI standard](https://joinup.ec.europa.eu/collection/semic-support-centre/document/uri-standard-guidelines-flemish-government).

**Full documentation**: [api.designmuseumgent.be](https://api.designmuseumgent.be)
**Swagger UI**: [data.designmuseumgent.be/v2/api-docs](https://data.designmuseumgent.be/v2/api-docs)
**Changelog**: [CHANGELOG.md](CHANGELOG.md)

> [!NOTE]
> **Scope.** The API serves the objects that have been **published** through it — around ten thousand of the twenty-four thousand the museum holds. Which objects have been published, and in what order, is a decision made by people, and it shapes every count and statistic these endpoints return. This matters most for the index endpoints: a figure such as "grey accounts for half the collection palette" describes the published catalogue, not the collection.

---

## Collections

| Endpoint | URI | Description |
|---|---|---|
| Objects | `GET /v2/id/objects` | Paginated collection of all objects |
| Agents | `GET /v2/id/agents` | Paginated collection of all agents |
| Exhibitions | `GET /v2/id/exhibitions` | Paginated collection of all exhibitions |
| Concepts | `GET /v2/id/concepts` | Paginated collection of the thesaurus |
| Private objects | `GET /v2/id/private/objects` | Authenticated private stream |

All collection endpoints support `?fullRecord=true` for bulk harvesting, `?modifiedSince=YYYY-MM-DD` for incremental updates, `?q=` for full text search, and use **Hydra Core Vocabulary** for pagination with `Link` headers.

> [!IMPORTANT]
> Records whose persistent URI redirects elsewhere — merged, renumbered or withdrawn — are excluded from the collection listings. They remain individually resolvable at `/v2/id/object/{PID}`, returning `301` or `410`. If you maintain a mirror, reconcile against a full pass periodically: `?modifiedSince=` cannot tell you that a record has *left* the collection.

## Single entities

| Endpoint | URI | Description |
|---|---|---|
| Object | `GET /v2/id/object/{PID}` | Single collection object |
| Agent | `GET /v2/id/agent/{PID}` | Single agent record |
| Exhibition | `GET /v2/id/exhibition/{PID}` | Single exhibition record |
| Concept | `GET /v2/id/concept/{PID}` | Single thesaurus concept |

All single entity endpoints support `HEAD` requests for lightweight existence checks and cache validation.

## Index endpoints

These describe the collection rather than return records from it — what values exist, and in what proportion.

| Endpoint | URI | Description |
|---|---|---|
| Colours | `GET /v2/id/colors` | Colour index with weighted statistics and hex values |
| Colours — dominant | `GET /v2/id/colors/dominant` | Objects sorted by colour dominance |
| Production | `GET /v2/id/production` | When the collection's objects were made, and when it acquired them |
| Types | `GET /v2/id/types` | Object type index with counts |
| Materials | `GET /v2/id/materials` | Material index with counts |
| Nationalities | `GET /v2/id/nationalities` | Nationality index with counts |
| Roles | `GET /v2/id/roles` | Agent role index with counts |
| DCAT | `GET /v2/` | Machine-readable data catalog |

> [!NOTE]
> Index endpoints are rate limited to **20 requests per minute** — far tighter than the collections, because each call aggregates across the whole collection. Cache their responses: the underlying figures change only when the collection is re-harvested.

## Query parameters

### Objects

| Parameter | Description |
|---|---|
| `?fullRecord=true` | Return full CIDOC-CRM records |
| `?modifiedSince=YYYY-MM-DD` | Incremental harvest |
| `?q=` | Full text search on titles, descriptions and object number |
| `?concept=` | Filter by thesaurus concept PID or URI, expanded to narrower concepts |
| `?conceptSearch=` | Search the thesaurus by label (NL/EN/FR) and filter by matching concepts |
| `?agent=` | Filter by agent PID or URI — designer or producer |
| `?date=YYYY/YYYY` | Filter by production span, overlap logic |
| `?dateFrom=`, `?dateTo=` | Same, as open-ended bounds |
| `?type=`, `?material=` | Filter by type or material label. Comma-separated for AND |
| `?color=`, `?cssColor=` | Filter by base colour or named tone |
| `?colors=true` | Include colour data (requires `fullRecord=true`) |
| `?hasImages=true` | Only objects with a IIIF manifest |
| `?hasColors=true` | Only objects processed by the colour tagger |
| `?hasParts=true` | Only koepelrecords |
| `?isPartOf=true` | Only set members |
| `?koepels=exclude` | Hide koepelrecords |
| `?language=NLD\|FRA\|ENG` | Only objects with a title in that language |
| `?onDisplay=` | **Tri-state.** Omit for all objects, `true` for on display, `false` for *not* on display |
| `?sortBy=`, `?sortOrder=` | `objectNumber`, `modified`, `titleNL/FR/EN`, `dateBegin`, `dateEnd` |

### Agents

| Parameter | Description |
|---|---|
| `?q=` | Full text search on name and agent ID |
| `?nationality=` | Filter by nationality |
| `?role=` | Filter by role (designer, producer) |
| `?type=` | `individual`, `organisation` or `unknown` |

### Index endpoints

| Parameter | Applies to | Description |
|---|---|---|
| `?onDisplay=true` | colors, production, types, materials | Restrict to objects in the collection presentation |
| `?minCount=` | colors | Minimum objects a colour must appear on to be listed |
| `?swatchesPerBase=` | colors | How many constituent tones each base colour returns |
| `?bucket=` | production | Bucket size in years (5–100, default 10) |
| `?yearFrom=`, `?yearTo=` | production | Axis range |
| `?q=` | production | Narrow both measures to a search |

## Quick start

```bash
# fetch a single object
curl https://data.designmuseumgent.be/v2/id/object/1987-1105

# fetch a single agent
curl https://data.designmuseumgent.be/v2/id/agent/DMG-A-00162

# paginate through all objects
curl "https://data.designmuseumgent.be/v2/id/objects?page=1&itemsPerPage=50&fullRecord=true"

# full text search
curl "https://data.designmuseumgent.be/v2/id/objects?q=roze+glas&hasImages=true"

# search the thesaurus in any of three languages
curl "https://data.designmuseumgent.be/v2/id/objects?conceptSearch=chaise"

# filter by colour and type
curl "https://data.designmuseumgent.be/v2/id/objects?color=pink&type=vaas&hasImages=true"

# filter by production period
curl "https://data.designmuseumgent.be/v2/id/objects?date=1950/1969&hasImages=true"

# objects currently on display
curl "https://data.designmuseumgent.be/v2/id/objects?onDisplay=true&fullRecord=true"

# the collection's palette, with renderable hex values
curl "https://data.designmuseumgent.be/v2/id/colors"

# when the collection was made, and when it was collected
curl "https://data.designmuseumgent.be/v2/id/production?bucket=10&yearFrom=1600"
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

---

## v1 has been retired

v1 no longer serves requests. Its URIs return HTTP **`410 Gone`** rather than `404`, with headers pointing at the successor:

```http
HTTP/1.1 410 Gone
Deprecation: true
Sunset: Wed, 01 Jul 2026 00:00:00 GMT
Link: <https://data.designmuseumgent.be/v2/>; rel="successor-version"
```

`410` rather than `404` is deliberate: these URIs existed and were published, so the honest answer is that the resource is deliberately gone, not that it never existed.

### What changed in v2

| | v1 | v2 |
|---|---|---|
| **Data model** | Linked Art / OSLO | Pure CIDOC-CRM |
| **Serialization** | JSON-LD (mixed vocabularies) | JSON-LD (strict CIDOC-CRM) |
| **Multilingual** | single language fields | `crm:E41_Appellation` per language |
| **Nationality** | plain string | EU Publications Office URI |
| **Biographies** | `crm:P3_has_note` | `crm:E33_Linguistic_Object` + CC BY-SA |
| **Colour data** | separate endpoints | `crm:E36_Visual_Item` inline |
| **Colour API** | `/v1/color-api/{color}` | `?color=` / `?cssColor=` filters, plus `/v2/id/colors` |
| **Full text search** | — | `?q=` on objects, agents, concepts |
| **Concept search** | — | `?concept=`, `?conceptSearch=` with hierarchy expansion |
| **Date filters** | — | `?date=`, `?dateFrom=`, `?dateTo=` |
| **Index endpoints** | — | colours, production, types, materials, nationalities, roles |
| **Incremental harvest** | — | `?modifiedSince=` |
| **Pagination headers** | — | RFC 8288 `Link` header |
| **HEAD requests** | — | Lightweight existence checks |
| **ARK routes** | `/v1/id/ark:/29417/…` | Not carried over |
| **Base URI** | `/v1/` | `/v2/` |

---

## Standards

- [CIDOC-CRM](http://www.cidoc-crm.org/) — core data model
- [Flemish URI standard](https://joinup.ec.europa.eu/collection/semic-support-centre/document/uri-standard-guidelines-flemish-government) — persistent identifiers
- [Hydra Core Vocabulary](http://www.w3.org/ns/hydra/core#) — pagination
- [PROV-O](https://www.w3.org/TR/prov-o/) — provenance
- [SKOS](https://www.w3.org/TR/skos-reference/) — thesaurus labels and hierarchy
- [Getty vocabularies](http://vocab.getty.edu/) — AAT, ULAN, TGN
- [EU Publications Office](https://publications.europa.eu/resource/authority/) — language, country, gender authorities
- [RFC 8288](https://www.rfc-editor.org/rfc/rfc8288) — `Link` header pagination
- [IIIF](https://iiif.io/) — image delivery

## Support

- 📖 [Documentation](https://api.designmuseumgent.be)
- 🔧 [Swagger UI](https://data.designmuseumgent.be/v2/api-docs)
- 🐛 [GitHub Issues](https://github.com/DesignMuseumGent/dmg-rest-api/issues)
- 📧 [olivier.vandhuynslager@stad.gent](mailto:olivier.vandhuynslager@stad.gent)

---

Development and coordination by [Olivier Van D'huynslager](https://oliviervandhuynslager.net) — [Studio Digitaal](https://www.designmuseumgent.be/en/studios/studio-digitaal), Design Museum Gent