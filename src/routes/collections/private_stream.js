import {
  fetchAuthentication,
  fetchPrivateObjectsWithPagination, // Rewritten helper for optimized fetching
} from "../../utils/parsers.js";

const COMMON_CONTEXT = [
  "https://data.vlaanderen.be/doc/applicatieprofiel/cultureel-erfgoed-object/erkendestandaard/2021-04-22/context/cultureel-erfgoed-object-ap.jsonld",
  "https://data.vlaanderen.be/doc/applicatieprofiel/cultureel-erfgoed-event/erkendestandaard/2021-04-22/context/cultureel-erfgoed-event-ap.jsonld",
  "https://data.vlaanderen.be/doc/applicatieprofiel/generiek-basis/zonderstatus/2019-07-01/context/generiek-basis.jsonld",
];

export function requestPrivateObjects(app, BASE_URI) {
  app.get("/v1/id/private-objects/", async (req, res) => {
    try {
      // Step 1: Authenticate the API key
      const keys = await fetchAuthentication();
      const apiKey = req.query.apiKey || "none";

      if (!keys.some((item) => item.key === apiKey)) {
        return res.status(401).json({
          error:
              "Authentication key is missing. This stream is only available via authentication.",
        });
      }

      // Step 2: Handle pagination parameters from query
      let { pageNumber = 1, itemsPerPage = 20 } = req.query;
      pageNumber = Math.max(Number(pageNumber), 1); // Ensure page number is positive
      itemsPerPage = Math.max(Number(itemsPerPage), 1); // Ensure items per page is positive
      const from = (pageNumber - 1) * itemsPerPage;
      const to = pageNumber * itemsPerPage - 1;

      // Step 3: Fetch paginated private objects from the database
      const { data: records, total } = await fetchPrivateObjectsWithPagination(
          from,
          to
      );

      if (!records || records.length === 0) {
        return res.status(404).json({ error: "No data found for the requested page." });
      }

      // Extract filtered objects from the response
      const filteredObjects = records.map((record) => record.object);

      // Step 4: Calculate total pages for pagination
      const totalPages = Math.ceil(total / itemsPerPage);

      // Step 5: Build the hydra view and response structure
      res.status(200).json({
        "@context": [
          ...COMMON_CONTEXT,
          { hydra: "http://www.w3.org/ns/hydra/context.jsonld" },
        ],
        "@type": "GecureerdeCollectie",
        "@id": `${BASE_URI}id/private-objects`,
        "hydra:view": {
          "@id": `${BASE_URI}id/private-objects?pageNumber=${pageNumber}&apiKey=${apiKey}`,
          "@type": "PartialCollectionView",
          "hydra:first": `${BASE_URI}id/private-objects?pageNumber=1&apiKey=${apiKey}`,
          "hydra:last": `${BASE_URI}id/private-objects?pageNumber=${totalPages}&apiKey=${apiKey}`,
          "hydra:previous":
              pageNumber > 1
                  ? `${BASE_URI}id/private-objects?pageNumber=${pageNumber - 1}&apiKey=${apiKey}`
                  : null,
          "hydra:next":
              pageNumber < totalPages
                  ? `${BASE_URI}id/private-objects?pageNumber=${pageNumber + 1}&apiKey=${apiKey}`
                  : null,
        },
        "GecureerdeCollectie.curator": "Design Museum Gent",
        "GecureerdeCollectie.bestaatUit": filteredObjects,
      });
    } catch (error) {
      console.error("Error in requestPrivateObjects:", error);
      res.status(500).json({ error: "Internal server error." });
    }
  });
}