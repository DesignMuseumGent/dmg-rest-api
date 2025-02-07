import { fetchPaginatedAgents } from "../../utils/parsers.js";

const COMMON_CONTEXT = [
    "https://apidg.gent.be/opendata/adlib2eventstream/v1/context/persoon-basis.jsonld",
    "https://apidg.gent.be/opendata/adlib2eventstream/v1/context/cultureel-erfgoed-object-ap.jsonld",
    "https://apidg.gent.be/opendata/adlib2eventstream/v1/context/cultureel-erfgoed-event-ap.jsonld",
];

export function requestAgents(app, BASE_URI) {
    app.get("/v1/id/agents/", async (req, res) => {
        try {
            // Step 1: Set headers
            res.setHeader("Content-type", "application/ld+json");
            res.setHeader("Content-Disposition", "inline");

            // Step 2: Extract query parameters
            let { pageNumber = 1, itemsPerPage = 20, fullRecord = true } = req.query;
            pageNumber = Math.max(Number(pageNumber), 1); // Ensure positive page number
            itemsPerPage = Math.max(Number(itemsPerPage), 1); // Ensure positive items per page
            fullRecord = fullRecord === "true"; // Convert string to boolean

            const from = (pageNumber - 1) * itemsPerPage;
            const to = pageNumber * itemsPerPage - 1;

            // Step 3: Fetch paginated data from the database
            const { data: agentsData, total } = await fetchPaginatedAgents(from, to);

            if (!agentsData || agentsData.length === 0) {
                return res.status(404).json({ error: "No agents found for the requested page." });
            }

            // Step 4: Prepare data structure (if fullRecord is false)
            const filteredAgentsData = fullRecord
                ? agentsData.map((agent) => agent.LDES_raw.object)
                : agentsData.map((agent) => ({
                    "@context": COMMON_CONTEXT,
                    "@id": `${BASE_URI}id/agent/${agent.agent_ID}`,
                    "@type": "Persoon",
                    "Persoon.identificator": [
                        {
                            "@type": "Identificator",
                            "Identificator.identificator": {
                                "@value": agent.agent_ID,
                            },
                        },
                    ],
                }));

            // Step 5: Compute pagination metadata
            const totalPages = Math.ceil(total / itemsPerPage);

            // Step 6: Build the response
            res.status(200).json({
                "@context": [
                    ...COMMON_CONTEXT,
                    { hydra: "http://www.w3.org/ns/hydra/context.jsonld" },
                ],
                "@type": "GecureerdeCollectie",
                "@id": `${BASE_URI}id/agents`,
                "hydra:totalItems": total,
                "hydra:view": {
                    "@id": `${BASE_URI}id/agents?pageNumber=${pageNumber}`,
                    "@type": "PartialCollectionView",
                    "hydra:first": `${BASE_URI}id/agents?pageNumber=1`,
                    "hydra:last": `${BASE_URI}id/agents?pageNumber=${totalPages}`,
                    "hydra:previous":
                        pageNumber > 1 ? `${BASE_URI}id/agents?pageNumber=${pageNumber - 1}` : null,
                    "hydra:next":
                        pageNumber < totalPages
                            ? `${BASE_URI}id/agents?pageNumber=${pageNumber + 1}`
                            : null,
                },
                "GecureerdeCollectie.curator": "Design Museum Gent",
                "GecureerdeCollectie.bestaatUit": filteredAgentsData,
            });
        } catch (error) {
            console.error("Error in requestAgents:", error);
            res.status(500).json({ error: "Internal server error." });
        }
    });
}