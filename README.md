# DESIGN MUSEUM GENT - REST-API
This **rest-api** exposes **linked-data** related to [Design Museum Gent](https://data.designmuseumgent.be).  It offers a range of information, from metadata and media related to the collection, to details about its programs such as the billboard series and the exhibition archive. The data is harvested from our [Linked Data Event Streams](https://apidg.gent.be/opendata/adlib2eventstream/v1/) and is exposed based on REST principles. Additionally all URIs are compliant with the [Flemish URI standard](https://joinup.ec.europa.eu/collection/semic-support-centre/document/uri-standard-guidelines-flemish-government). 

## QUICK-START

### DATA CATALOGUES
Top level **data-catalogues** or DCAT are exposed on the top-level of the API and make use of the [OSLO standard](https://joinup.ec.europa.eu/collection/oslo-open-standards-local-administrations-flanders): 
>[https://data.designmuseumgent.be/v1](https://data.designmuseumgent.be/v1)

these include various collections: 
* **objects** (published): [https://data.designmuseumgent.be/v1/id/objects](https://data.designmuseumgent.be/v1/id/objects)
* **objects** (private): [https://data.designmuseumgent.be/v1/id/private-objects](https://data.designmuseumgent.be/v1/id/private-objects)
* **exhibitions** (events): [https://data.designmuseumgent.be/v1/id/exhibitions](https://data.designmuseumgent.be/v1/id/exhibitions)
* **billboard series**: [https://data.designmuseumgent.be/v1/id/exhibitions/billboardseries](https://data.designmuseumgent.be/v1/id/exhibitions/billboardseries)
* **exhibition texts**: [https://data.designmuseumgent.be/v1/id/texts](https://data.designmuseumgent.be/v1/id/texts)
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
* **archive**: [https://data.designmuseumgent.be/v1/id/archive/TE_2003-010_Affiche](https://data.designmuseumgent.be/v1/id/archive/TE_2003-010_Affiche)
* **concept**: [https://data.designmuseumgent.be/v1/id/concept/530006321](https://data.designmuseumgent.be/v1/id/concept/530006321)

as this is not yet compliant with the flemish URI standard we have also added alternative routes, compliant to the EUR standard, making use of ARK. Both routes have the same payload. To make use of ARK, refactor the URLs above to the following syntax:
> https://data.designmuseumgent.be/v1/id/ark:/29417/{type}/{referencenumber}

____ 

## CURATED COLLECTIONS
**[studio digitaal](https://digitaal.designmuseumgent.be)** explores new query possibilities on the collection and builds prototypes as demonstrators for the APIs. 

### color-api
the color-api exposes the collection based on colors that objects have. Exploring different _color systems_, the user has the capability to retrieve data on the collection based on a given **color** and using the following syntax:
> https://data.designmuseumgent.be/v1/color-api/{color}

to fetch and retrieve not the entire object but only a list of images with a reference to the physical object, the following query can be used:
> https://data.designmuseumgent.be/v1/color-api/{color}?image=true

example using **vanilla** as input color: 
> [https://data.designmuseumgent.be/v1/color-api/vanilla?image=true](https://data.designmuseumgent.be/v1/color-api/vanilla?image=true)

a full list of the used color system is exposed here:
>https://data.designmuseumgent.be/v1/colors/
