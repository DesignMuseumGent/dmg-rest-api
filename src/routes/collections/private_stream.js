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

    if(!keys.some((item) => item.key === apiKey)){
      return res.status(401).json({
        error: "Authentication key is missing. this stream is only available via authentication"
      });
    }


    const records = await fetchAllPrivateLDESrecordsObjects()


    res.status(200).json({
      "@context": [...COMMON_CONTEXT, { "hydra": "http://www.w3.org/ns/hydra/context.jsonld" }],
    })

  });
}
