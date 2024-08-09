import {
  fetchAllLDESrecordsObjects,
} from "../../utils/parsers.js";

const COMMON_CONTEXT = [
  "https://data.vlaanderen.be/doc/applicatieprofiel/cultureel-erfgoed-object/erkendestandaard/2021-04-22/context/cultureel-erfgoed-object-ap.jsonld",
  "https://data.vlaanderen.be/doc/applicatieprofiel/cultureel-erfgoed-event/erkendestandaard/2021-04-22/context/cultureel-erfgoed-event-ap.jsonld",
  "https://data.vlaanderen.be/doc/applicatieprofiel/generiek-basis/zonderstatus/2019-07-01/context/generiek-basis.jsonld",
];

const CC_LICENSES = {
  "CC0": "https://creativecommons.org/publicdomain/zero/1.0/",
  "CC-BY-NC-ND":   "https://creativecommons.org/licenses/by-nc-nd/4.0/",
  "CC-BY-SA": "",
  "ALL": "ALL",
  "IC": "http://rightsstatements.org/vocab/InC/1.0/"
}


export function requestObjects(app, BASE_URI) {
  app.get("/v1/id/objects/", async (req, res) => {

    const records = await fetchAllLDESrecordsObjects();
    const filteredObjects = [];

    // pagination
    let { pageNumber = 1, itemsPerPage = 20, license = "ALL" } = req.query
    pageNumber = Number(pageNumber)
    itemsPerPage = Number(itemsPerPage)

    let allMatchedRecords = []

    for (let i = 0; i < records.length; i++) {
      const record = records[i];

      // query for licenses
      if(license !== "ALL" && (!record["CC_Licenses"] || !record["CC_Licenses"].includes(CC_LICENSES[license]))) {
        continue;
      }

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
      allMatchedRecords.push(object);
    }

    const totalPages = Math.ceil(allMatchedRecords.length / itemsPerPage);
    for(let j = (pageNumber - 1) * itemsPerPage; j < pageNumber * itemsPerPage; j++) {
      if (j >= allMatchedRecords.length) break;
      filteredObjects.push(allMatchedRecords[j]);
    }

    res.status(200).json({
      "@context": [...COMMON_CONTEXT, { "hydra": "http://www.w3.org/ns/hydra/context.jsonld" }],
      "@type": "GecureerdeCollectie",
      "@id": `${BASE_URI}id/objects?license=${license}`,
      "hydra:totalItems": allMatchedRecords.length,
      "hydra:view": {
        "@id": `${BASE_URI}id/objects?license=${license}&pageNumber=${pageNumber}`,
        "@type": "PartialCollectionView",
        "hydra:first": `${BASE_URI}id/objects?license=${license}&pageNumber=1`,
        "hydra:last": `${BASE_URI}id/objects?license=${license}&pageNumber=${totalPages}`,
        "hydra:previous": pageNumber > 1 ? `${BASE_URI}id/objects?license=${license}&pageNumber=${pageNumber - 1}` : null,
        "hydra:next": pageNumber < totalPages ? `${BASE_URI}id/objects?license=${license}&pageNumber=${pageNumber + 1}` : null,
      },
      "GecureerdeCollectie.curator": "Design Museum Gent",
      "GecureerdeCollectie.bestaatUit": filteredObjects
    });

  })
}