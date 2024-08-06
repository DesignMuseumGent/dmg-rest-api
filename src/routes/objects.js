import {
  fetchAllLDESrecordsObjects,
} from "../utils/parsers.js";

const COMMON_CONTEXT = [
  "https://data.vlaanderen.be/doc/applicatieprofiel/cultureel-erfgoed-object/erkendestandaard/2021-04-22/context/cultureel-erfgoed-object-ap.jsonld",
  "https://data.vlaanderen.be/doc/applicatieprofiel/cultureel-erfgoed-event/erkendestandaard/2021-04-22/context/cultureel-erfgoed-event-ap.jsonld",
  "https://data.vlaanderen.be/doc/applicatieprofiel/generiek-basis/zonderstatus/2019-07-01/context/generiek-basis.jsonld",
];

export function requestObjects(app, BASE_URI) {
  app.get("/v1/id/objects/", async (req, res) => {

    const records = await fetchAllLDESrecordsObjects();
    const filteredObjects = [];

    // pagination
    let { pageNumber = 1, itemsPerPage = 20 } = req.query
    pageNumber = Number(pageNumber)
    itemsPerPage = Number(itemsPerPage)

    const totalPages = Math.ceil(records.length / itemsPerPage)

    for (let i = (pageNumber - 1) * itemsPerPage; i < pageNumber * itemsPerPage; i++) {
      if (i >= records.length) break;
      const record = records[i];

      let object = {
        "@context": COMMON_CONTEXT,
        "@id": `${BASE_URI}id/object/${record["objectNumber"]}`,
        "@type": "MensgemaaktObject",
        "Object.identificator": [{
          "@type": "Identificator",
          "Identificator.identificator": {
            "@value": record["objectNumber"],
          },
        }],
      };

      filteredObjects.push(object);
    }

    res.status(200).json({
      "@context": [...COMMON_CONTEXT, { "hydra": "http://www.w3.org/ns/hydra/context.jsonld" }],
      "@type": "GecureerdeCollectie",
      "@id": `${BASE_URI}id/objects`,
      "hydra:view": {
        "@id": `${BASE_URI}id/objects?pageNumber=${pageNumber}`,
        "@type": "PartialCollectionView",
        "hydra:first": `${BASE_URI}id/objects?pageNumber=1`,
        "hydra:last": `${BASE_URI}id/objects?pageNumber=${totalPages}`,
        "hydra:previous": pageNumber > 1 ? `${BASE_URI}id/objects?pageNumber=${pageNumber - 1}` : null,
        "hydra:next": pageNumber < totalPages ? `${BASE_URI}id/objects?pageNumber=${pageNumber + 1}` : null,
      },
      "GecureerdeCollectie.curator": "Design Museum Gent",
      "GecureerdeCollectie.bestaatUit": filteredObjects
    });

  })
}