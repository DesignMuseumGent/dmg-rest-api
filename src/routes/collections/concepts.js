import { fetchPaginatedConcepts } from "../../utils/parsers.js";

export function requestConcepts(app, BASE_URI) {
    app.get("/v1/id/concepts/", async (req, res) => {
        try {
            // Step 1: Extract query parameters
            let { pageNumber = 1, itemsPerPage = 20, full = false } = req.query;
            pageNumber = Math.max(Number(pageNumber), 1); // Ensure positive page number
            itemsPerPage = Math.max(Number(itemsPerPage), 1); // Ensure positive items per page
            full = full === "true"; // Convert string to boolean

            const from = (pageNumber - 1) * itemsPerPage;
            const to = pageNumber * itemsPerPage - 1;

            // Step 2: Fetch paginated data and total count from helper
            const { data: concepts, total } = await fetchPaginatedConcepts(from, to);

            if (!concepts || concepts.length === 0) {
                return res.status(404).json({ error: "No concepts found for the requested page." });
            }

            // Step 3: Process fetched data based on `full` query parameter
            const filteredConcepts = full
                ? concepts.map((concept) => concept.LDES_raw.object)
                : concepts.map((concept) => ({
                    "@context": [
                        {
                            skos: "http://www.w3.org/2004/02/skos/core#",
                        },
                    ],
                    "@id": `${BASE_URI}id/concept/${concept.id}`,
                    "@type": "skos:concept",
                    "skos:preLabel": concept.LDES_raw.object["skos:prefLabel"],

                    // rgb(249 112 67)
                }));

            // Step 4: Compute pagination metadata
            const totalPages = Math.ceil(total / itemsPerPage);

            // Step 5: Build and send the response
            res.status(200).json({
                "@context": [
                    "https://data.vlaanderen.be/doc/applicatieprofiel/generiek-basis/zonderstatus/2019-07-01/context/generiek-basis.jsonld",
                    {
                        hydra: "http://www.w3.org/ns/hydra/context.jsonld",
                    },
                ],
                "@id": `${BASE_URI}id/concepts`,
                "hydra:totalItems": total,
                "hydra:view": {
                    "@id": `${BASE_URI}id/concepts?pageNumber=${pageNumber}`,
                    "@type": "PartialCollectionView",
                    "hydra:first": `${BASE_URI}id/concepts?pageNumber=1&itemsPerPage=${itemsPerPage}`,
                    "hydra:last": `${BASE_URI}id/concepts?pageNumber=${totalPages}&itemsPerPage=${itemsPerPage}`,
                    "hydra:previous":
                        pageNumber > 1
                            ? `${BASE_URI}id/concepts?pageNumber=${pageNumber - 1}&itemsPerPage=${itemsPerPage}`
                            : null,
                    "hydra:next":
                        pageNumber < totalPages
                            ? `${BASE_URI}id/concepts?pageNumber=${pageNumber + 1}&itemsPerPage=${itemsPerPage}`
                            : null,
                },
                "GecureerdeCollectie.curator": "Design Museum Gent",
                "GecureerdeCollectie.bestaatUit": filteredConcepts,
            });
        } catch (error) {
            console.error("Error in requestConcepts:", error);
            res.status(500).json({ error: "Internal server error." });
        }
    });
}