import {fetchLDESAllAgents, fetchLDESRecordByAgentID} from "../../utils/parsers.js";
const COMMON_CONTEXT = [
    "https://apidg.gent.be/opendata/adlib2eventstream/v1/context/persoon-basis.jsonld",
    "https://apidg.gent.be/opendata/adlib2eventstream/v1/context/cultureel-erfgoed-object-ap.jsonld",
    "https://apidg.gent.be/opendata/adlib2eventstream/v1/context/cultureel-erfgoed-event-ap.jsonld"
]

export function requestAgents(app, BASE_URI) {
    app.get('/v1/id/agents/', async(req, res) => {

        res.setHeader('Content-type', 'application/ld+json');
        res.setHeader('Content-Dispositon', 'inline');

        const agentsData = await fetchLDESAllAgents()
        const filteredAgentsData = [];

        // pagination
        let { pageNumber = 1, itemsPerPage = 20, fullRecord = true} = req.query
        pageNumber = Number(pageNumber)
        itemsPerPage = Number(itemsPerPage)
        fullRecord = Boolean(fullRecord)

        const totalPages = Math.ceil(agentsData.length / itemsPerPage);

        for (let i = ( pageNumber - 1 ) * itemsPerPage; i < pageNumber * itemsPerPage;  i++) {
            if (i < agentsData.length) {

                if (!fullRecord) {
                    let agent = {
                        "@context": COMMON_CONTEXT,
                        "@id": `${BASE_URI}id/agent/${agentsData[i]["agent_ID"]}`,
                        "@type": "Persoon",
                        "Persoon.identificator": [{
                            "@type": "Identificator",
                            "Identificator.identificator": {
                                "@value": agentsData[i]["agent_ID"]
                            }
                        }]
                    }
                    filteredAgentsData.push(agent)
                } else {
                    filteredAgentsData.push(agentsData[i]["LDES_raw"]["object"])
                }
            }

        }

        res.status(200).json({
            "@context":  [...COMMON_CONTEXT, { "hydra": "http://www.w3.org/ns/hydra/context.jsonld" }],
            "@type": "GecureerdeCollectie",
            "@id": `${BASE_URI}id/agents`,
            "hydra: totalItems": agentsData.length,
            "hydra: view": {
                "@id": `${BASE_URI}id/agents?pageNumber=${pageNumber}`,
                "@type": "PartialCollectionView",
                "hydra:first": `${BASE_URI}id/agents?pageNumber=1`,
                "hydra:last": `${BASE_URI}id/agents?pageNumber=${totalPages}`,
                "hydra:previous": pageNumber > 1 ? `${BASE_URI}id/agents?pageNumber=${pageNumber - 1}` : null,
                "hydra:next": pageNumber < totalPages ? `${BASE_URI}id/agents?pageNumber=${pageNumber + 1}` : null,
            },
            "GecureerdeCollectie.curator": "Design Museum Gent",
            "GecureerdeCollectie.bestaatUit": filteredAgentsData
        })

        if (filteredAgentsData.length === 0) {
            return res.status(404).send('No agents found')
        }
    })
}

// ark
