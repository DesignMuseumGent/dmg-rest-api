import { fetchPaginatedExhibitions } from "../../utils/parsers.js";

const parseIdentification = (title) => ({
    "@type": "cidoc:E33_E41_Linguistic_Appelation",
    "inhoud": {
        "@value": title,
        "@language": "nl",
    },
});

const parseExhibition = (exh, BASE_URI) => {
    let title = "title unknown";
    try {
        // Try full URL format first
        const identifiedBy = exh["LDES_raw"]?.["object"]?.["http://www.cidoc-crm.org/cidoc-crm/P1_is_identified_by"];
        if (identifiedBy?.["http://www.cidoc-crm.org/cidoc-crm/P190_has_symbolic_content"]?.["@value"]) {
            title = identifiedBy["http://www.cidoc-crm.org/cidoc-crm/P190_has_symbolic_content"]["@value"];
        }
        // Fallback to prefixed version with "inhoud" if it exists in some records
        else if (exh["LDES_raw"]?.["object"]?.["cidoc:P1_is_identified_by"]?.["inhoud"]?.["@value"]) {
            title = exh["LDES_raw"]["object"]["cidoc:P1_is_identified_by"]["inhoud"]["@value"];
        }
    } catch (e) {
        console.error(`Error parsing exhibition title: ${e.message}`);
    }

    return {
        "@id": `${BASE_URI}id/exhibition/${exh["exh_PID"]}`,
        "@type": "Activiteit",
        "cidoc:P1_is_identified_by": parseIdentification(title),
    };
};

export function requestExhibitions(app, BASE_URI) {
    app.get("/v1/id/exhibitions", async (req, res) => {
        try {
            // Step 1: Set headers
            res.setHeader("Content-type", "application/ld+json");
            res.setHeader("Content-Disposition", "inline");

            // Step 2: Extract query parameters
            let { pageNumber = 1, itemsPerPage = 20 , fullRecord= true} = req.query;
            pageNumber = Math.max(Number(pageNumber), 1); // Ensure positive page numbers
            itemsPerPage = Math.max(Number(itemsPerPage), 1); // Ensure positive items per page
            fullRecord = fullRecord === "true" // explicitely check if true

            const from = (pageNumber - 1) * itemsPerPage;
            const to = pageNumber * itemsPerPage - 1;

            // Step 3: Fetch paginated data from the database
            const { data: exhibitions, total } = await fetchPaginatedExhibitions(from, to);

            if (!exhibitions || exhibitions.length === 0) {
                return res.status(404).json({ error: "No exhibitions found for the requested page." });
            }

            // Step 4: Parse exhibitions
            let filteredExhibitions = []
            if (!fullRecord) {
                filteredExhibitions = exhibitions.map((exh) => parseExhibition(exh, BASE_URI));
            } else {
                filteredExhibitions = exhibitions.map((exh) => exh["LDES_raw"]["object"]);
            }

            // Step 5: Compute pagination metadata
            const totalPages = Math.ceil(total / itemsPerPage);

            // Step 6: Build and send the response
            res.status(200).json({
                "@context": [
                    "https://data.vlaanderen.be/doc/applicatieprofiel/DCAT-AP-VL/erkendestandaard/2022-04-21/context/DCAT-AP-VL-20.jsonld",
                    "https://data.vlaanderen.be/doc/applicatieprofiel/cultureel-erfgoed-event/erkendestandaard/2021-04-22/context/cultureel-erfgoed-event-ap.jsonld",
                    "https://data.vlaanderen.be/doc/applicatieprofiel/cultureel-erfgoed-object/erkendestandaard/2021-04-22/context/cultureel-erfgoed-object-ap.jsonld",
                    {
                        "cidoc": "https://www.cidoc-crm.org/cidoc-crm/",
                        "hydra": "http://www.w3.org/ns/hydra/context.jsonld",
                    },
                ],
                "@type": "GecureerdeCollectie",
                "@id": `${BASE_URI}id/exhibitions`,
                "hydra:view": {
                    "@id": `${BASE_URI}id/exhibitions?pageNumber=${pageNumber}`,
                    "@type": "PartialCollectionView",
                    "hydra:first": `${BASE_URI}id/exhibitions?pageNumber=1`,
                    "hydra:last": `${BASE_URI}id/exhibitions?pageNumber=${totalPages}`,
                    "hydra:previous": pageNumber > 1 ? `${BASE_URI}id/exhibitions?pageNumber=${pageNumber - 1}` : null,
                    "hydra:next": pageNumber < totalPages ? `${BASE_URI}id/exhibitions?pageNumber=${pageNumber + 1}` : null,
                },
                "GecureerdeCollectie.curator": "Design Museum Gent",
                "GecureerdeCollectie.bestaatUit": filteredExhibitions,
            });
        } catch (error) {
            console.error(`Error in requestExhibitions: ${error.message}`);
            res.status(500).json({ error: "Internal server error." });
        }
    });
}