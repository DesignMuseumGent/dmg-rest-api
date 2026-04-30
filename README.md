# DESIGN MUSEUM GENT — REST API

> [!WARNING]
> **v1 of this API is deprecated** and will be sunset on **31 December 2026**.
> Please migrate to [v2](https://data.designmuseumgent.be/v2/).
> v1 will remain available until the sunset date for backwards compatibility.
> v1 documentation is archived below.

This **REST API** exposes **linked data** related to [Design Museum Gent](https://data.designmuseumgent.be). It provides access to collection objects, agents, exhibitions and thesaurus concepts as **CIDOC-CRM compliant JSON-LD**. The data is harvested from the [Linked Data Event Streams](https://apidg.gent.be/opendata/adlib2eventstream/v1/) and all URIs are compliant with the [Flemish URI standard](https://joinup.ec.europa.eu/collection/semic-support-centre/document/uri-standard-guidelines-flemish-government).

📖 **Full documentation**: [data.designmuseumgent.be](https://data.designmuseumgent.be)

---

## v2 (current)

### Collections

| Endpoint | URI | Description |
|---|---|---|
| Objects | `GET /v2/id/objects` | Paginated collection of all objects |
| Agents | `GET /v2/id/agents` | Paginated collection of all agents |
| Exhibitions | `GET /v2/id/exhibitions` | Paginated collection of all exhibitions |
| Concepts | `GET /v2/id/concepts` | Paginated collection of the thesaurus |

All collection endpoints support `?fullRecord=true` for bulk harvesting and use **Hydra Core Vocabulary** for pagination.

### Single entities

| Endpoint | URI | Description |
|---|---|---|
| Object | `GET /v2/id/object/{PID}` | Single collection object |
| Agent | `GET /v2/id/agent/{PID}` | Single agent record |
| Exhibition | `GET /v2/id/exhibition/{PID}` | Single exhibition record |
| Concept | `GET /v2/id/concept/{PID}` | Single thesaurus concept |

### Quick start

```bash
# fetch a single object
curl https://data.designmuseumgent.be/v2/id/object/1987-1105

# fetch a single agent
curl https://data.designmuseumgent.be/v2/id/agent/DMG-A-00162

# paginate through all objects
curl "https://data.designmuseumgent.be/v2/id/objects?page=1&itemsPerPage=50&fullRecord=true"
```

```javascript
// harvest the full collection
async function harvest(url) {
    const res = await fetch(url);
    const data = await res.json();

    // do something with data["hydra:member"]

    if (data["hydra:view"]["hydra:next"]) {
        await harvest(data["hydra:view"]["hydra:next"]);
    }
}

harvest('https://data.designmuseumgent.be/v2/id/objects?fullRecord=true&itemsPerPage=50');
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
| **Base URI** | `/v1/` | `/v2/` |

---

## ~~v1~~ (deprecated — migrate to [v2](https://data.designmuseumgent.be/v2/))

> [!CAUTION]
> v1 is deprecated and will be shut down on **31 December 2026**. The documentation below is archived for reference only. All new integrations should use v2.

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
GET /v1/color-api/{color}
GET /v1/color-api/{color}?image=true
Example: https://data.designmuseumgent.be/v1/color-api/vanilla?image=true

Full color list: https://data.designmuseumgent.be/v1/colors/

---

## Standards

- [CIDOC-CRM](http://www.cidoc-crm.org/) — core data model (v2)
- [OSLO](https://joinup.ec.europa.eu/collection/oslo-open-standards-local-administrations-flanders) — Flemish government standard (v1)
- [Flemish URI standard](https://joinup.ec.europa.eu/collection/semic-support-centre/document/uri-standard-guidelines-flemish-government) — persistent identifiers
- [Hydra Core Vocabulary](http://www.w3.org/ns/hydra/core#) — pagination
- [Getty vocabularies](http://vocab.getty.edu/) — AAT, ULAN, TGN
- [EU Publications Office](https://publications.europa.eu/resource/authority/) — language, country, gender authorities

## Support

- 📖 [Documentation](https://data.designmuseumgent.be)
- 🐛 [GitHub Issues](https://github.com/DesignMuseumGent/dmg-rest-api/issues)
- 📧 [olivier.vandhuynslager@stad.gent](mailto:olivier.vandhuynslager@stad.gent)
- 🔧 [Swagger](https://data.designmuseumgent.be/api-docs)

---

Development and coordination by [Olivier Van D'huynslager](https://oliviervandhuynslager.net) — [Studio Digitaal](https://www.designmuseumgent.be/en/studios/studio-digitaal), Design Museum Gent
