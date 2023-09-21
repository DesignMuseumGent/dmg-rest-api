import {fetchLDESAllAgents, fetchLDESRecordByAgentID} from "../utils/parsers.js";

export function requestAgents(app) {
    app.get('/id/agents/', async(req, res) => {
        const x = await fetchLDESAllAgents();

        let limit = 10; // if no limit set, return all items.
        let offset = parseInt(req.query.offset) || 0; // Default offset is 0
        const _agents = []

        //check if limit exceeds max.
        if (limit >= x.length) {
            limit = x.length
        }

        //check max offset.
        const maxOffset = x.length / limit
        if (offset > maxOffset) {
            offset = maxOffset
        }

        for( let i = 0; i < x.length; i ++) {
            let _agent = {}
            const baseURI = "https://data.designmuseumgent.be/"

            _agent["@context"] = [
                "https://apidg.gent.be/opendata/adlib2eventstream/v1/context/persoon-basis.jsonld",
                "https://apidg.gent.be/opendata/adlib2eventstream/v1/context/cultureel-erfgoed-object-ap.jsonld",
                "https://apidg.gent.be/opendata/adlib2eventstream/v1/context/cultureel-erfgoed-event-ap.jsonld"
            ]
            _agent["@id"] = baseURI+"id/agent/"+x[i]["agent_ID"]
            _agent["@type"] = "Persoon"
            _agent["Persoon.identificator"]=[
                {
                    "@type": "Identificator",
                    "Identificator.identificator": {
                        "@value": x[i]["agent_ID"]
                    }
                }
            ]

            // push to list to publish.
            _agents.push(_agent)
        }

        // show only a certain amount of agents (LIMIT).
        const agents = _agents.slice(offset, offset + limit)

        // error handling.
        if (agents.length !== 0) {
            res.send(agents)
        } else {
            res.status(503).send('will be available soon!')
        }
    })

    app.get('/id/agent/:agentPID', async(req, res) => {
        const x = await fetchLDESRecordByAgentID(req.params.agentPID);
        const result_cidoc = x[0]["LDES_raw"];
        res.send(x[0]["LDES_raw"])
    })
}

// ark
