import {fetchLDESAllAgents, fetchLDESRecordByAgentID} from "../utils/parsers.js";
import * as console from "node:console";
import e from "express";

export function requestAgents(app, BASE_URI) {
    app.get('/v1/id/agents/', async(req, res) => {

        // get limit and offset of the query
        let limit = parseInt(req.query.limit) || 10; // Default limit is 10.
        let offset = parseInt(req.query.offset) || 0; // Default offset is 0
        let page = parseInt(req.query.page) || 1; // Default page is 1 // calculate start and end for supabase's range method
        let start = (page - 1) * limit;
        let end = start + limit - 1;

        try {
            // fetch only required agents
            const agentsData = await fetchLDESAllAgents(start, end)
            const agents = agentsData.map(agentData => ({
                "@context": [
                    "https://apidg.gent.be/opendata/adlib2eventstream/v1/context/persoon-basis.jsonld",
                    "https://apidg.gent.be/opendata/adlib2eventstream/v1/context/cultureel-erfgoed-object-ap.jsonld",
                    "https://apidg.gent.be/opendata/adlib2eventstream/v1/context/cultureel-erfgoed-event-ap.jsonld"
                ],
                "@id": `${BASE_URI}id/agent/${agentData["agent_ID"]}`,
                "@type": "Persoon",
                "Persoon.identificator": [{
                    "@type": "Identificator",
                    "Identificator.identificator": {
                        "@value": agentData["agent_ID"]
                    }
                }]
            }));

            res.send(agents)

            if (agents.length === 0) {
                return res.status(404).send('No agents found')
            }

        } catch(e) {
            console.error(e);
            res.status(500).send("Internal Server Error");
        }
    })

    app.get('/v1/id/agent/:agentPID', async (req, res) => {
        try {
            const agentData = await fetchLDESRecordByAgentID(req.params.agentPID);
            if (!agentData) {
                return res.status(404).send('Agent not found');
            }

            res.set('Content-Type', 'application/json;charset=utf-8');
            return res.send(agentData);
        } catch (error) {
            console.error(error);
            return res.status(500).send('Internal server error');
        }
    });
}

// ark
