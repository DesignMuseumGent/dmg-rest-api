# DESIGN MUSEUM GENT - REST-API
This **rest-api** exposes data related to the museum. Ranging from metadata, as well as media related to the collection to information on its programs such as the billboard series, and the exhibition archive. 

## QUICK-START
Top level **data-catalogues** or DCAT are exposed on the top-level of the API and make use of the [OSLO standard](https://joinup.ec.europa.eu/collection/oslo-open-standards-local-administrations-flanders): 
>[https://data.designmuseumgent.be/v1](https://data.designmuseumgent.be/v1)

these include various collections: 
* **objects** (published): [https://data.designmuseumgent.be/v1/id/objects](https://data.designmuseumgent.be/v1/id/objects)
* **objects** (private): [https://data.designmuseumgent.be/v1/id/private-objects](https://data.designmuseumgent.be/v1/id/private-objects)
* **exhibitions** (events): [https://data.designmuseumgent.be/v1/id/exhibitions](https://data.designmuseumgent.be/v1/id/exhibitions)
* **agents** (persons and organisations): [https://data.designmuseumgent.be/v1/id/agents](https://data.designmuseumgent.be/v1/id/agents)
* **thesaurus** (concepts): [https://data.designmuseumgent.be/v1/id/concepts](https://data.designmuseumgent.be/v1/id/concepts)

single **entities** can be fetched using appropriate identifies (which are exposed in the top-level DCATs). 

