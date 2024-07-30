# DESIGN MUSEUM GENT - REST-API
This **rest-api** exposes data related to [Design Museum Gent](https://data.designmuseumgent.be).  It offers a range of information, from metadata and media related to the collection, to details about its programs such as the billboard series and the exhibition archive. The data is harvested from our [Linked Data Event Streams](https://apidg.gent.be/opendata/adlib2eventstream/v1/) and is exposed based on REST principles. Additionally all URIs are compliant with the [Flemish URI standard](https://joinup.ec.europa.eu/collection/semic-support-centre/document/uri-standard-guidelines-flemish-government). 

## QUICK-START

### DATA CATALOGUES
Top level **data-catalogues** or DCAT are exposed on the top-level of the API and make use of the [OSLO standard](https://joinup.ec.europa.eu/collection/oslo-open-standards-local-administrations-flanders): 
>[https://data.designmuseumgent.be/v1](https://data.designmuseumgent.be/v1)

these include various collections: 
* **objects** (published): [https://data.designmuseumgent.be/v1/id/objects](https://data.designmuseumgent.be/v1/id/objects)
* **objects** (private): [https://data.designmuseumgent.be/v1/id/private-objects](https://data.designmuseumgent.be/v1/id/private-objects)
* **exhibitions** (events): [https://data.designmuseumgent.be/v1/id/exhibitions](https://data.designmuseumgent.be/v1/id/exhibitions)
* **billboard series**: [https://data.designmuseumgent.be/v1/id/exhibitions/billboardseries](https://data.designmuseumgent.be/v1/id/exhibitions/billboardseries)
* **agents** (persons and organisations): [https://data.designmuseumgent.be/v1/id/agents](https://data.designmuseumgent.be/v1/id/agents)
* **thesaurus** (concepts): [https://data.designmuseumgent.be/v1/id/concepts](https://data.designmuseumgent.be/v1/id/concepts)
> to remove stress from the server, some of the collections work with pagination.

____

### SINGLE ENTITIES

single **entities** can be fetched using appropriate identifies (which are exposed in the top-level DCATs) relying on the following syntax: 
> https://data.designmuseumgent.be/v1/id/{type}/{referencenumber}

* **agent** : [https://data.designmuseumgent.be/v1/id/agent/DMG-A-00523](https://data.designmuseumgent.be/v1/id/agent/DMG-A-00523)
* **object**: [https://data.designmuseumgent.be/v1/id/object/3471](https://data.designmuseumgent.be/v1/id/object/3471.json)
* **exhibition**: [https://data.designmuseumgent.be/v1/id/exhibition/TE_1993-009](https://data.designmuseumgent.be/v1/id/exhibition/TE_1993-009)
* **concept**: [https://data.designmuseumgent.be/v1/id/concept/530006321](https://data.designmuseumgent.be/v1/id/concept/530006321)
