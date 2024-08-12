import {
  fetchAllPrivateLDESrecordsObjects,
  fetchAuthentication,
} from "../../utils/parsers.js";

const COMMON_CONTEXT = [
  "https://data.vlaanderen.be/doc/applicatieprofiel/cultureel-erfgoed-object/erkendestandaard/2021-04-22/context/cultureel-erfgoed-object-ap.jsonld",
  "https://data.vlaanderen.be/doc/applicatieprofiel/cultureel-erfgoed-event/erkendestandaard/2021-04-22/context/cultureel-erfgoed-event-ap.jsonld",
  "https://data.vlaanderen.be/doc/applicatieprofiel/generiek-basis/zonderstatus/2019-07-01/context/generiek-basis.jsonld",
];

export function requestPrivateObjects(app) {
  app.get("id/private-objects/", async (req, res) => {
    // AUTHENTICATION

    let keys = await fetchAuthentication();
    let apiKey = req.query.apiKey || "none";
    let filteredObjects = [];

    if(!keys.some((item) => item.key === apiKey)){
      return res.status(401).json({
        error: "Authentication key is missing. this stream is only available via authentication"
      });
    }

    const records = await fetchAllPrivateLDESrecordsObjects()

    // pagination
    let { pageNumber = 1, itemsPerPage = 20, license = "ALL" } = req.query
    pageNumber = Number(pageNumber)
    itemsPerPage = Number(itemsPerPage)

    const totalPages = Math.ceil(allMatchedRecords.length / itemsPerPage);
    for(let j = (pageNumber - 1) * itemsPerPage; j < pageNumber * itemsPerPage; j++) {
      if (j >= allMatchedRecords.length) break;
      filteredObjects.push(allMatchedRecords[j]);
    }

    res.status(200).json({
      "@context": [...COMMON_CONTEXT, { "hydra": "http://www.w3.org/ns/hydra/context.jsonld" }],
      "@type": "GecureerdeCollectie",
      "@id": `${BASE_URI}/id/private-objects`,
      "hydra:view": {
        "@id": `${BASE_URI}id/private-objects?pageNumber=${pageNumber}`,
        "@type": "PartialCollectionView",
        "hydra:first": `${BASE_URI}id/private-objects?pageNumber=1`,
        "hydra:last": `${BASE_URI}id/private-objects?pageNumber=${totalPages}`,
        "hydra:previous": pageNumber > 1 ? `${BASE_URI}id/private-objects?pageNumber=${pageNumber - 1}` : null,
        "hydra:next": pageNumber < totalPages ? `${BASE_URI}id/private-objects?pageNumber=${pageNumber + 1}` : null,
      },
      "GecureerdeCollectie.curator": "Design Museum Gent",
      "GecureerdeCollectie.bestaatUit": filteredObjects
    })
  });
}
