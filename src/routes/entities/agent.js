import {fetchLDESRecordByAgentID} from "../../utils/parsers.js";
import console from "node:console";

export function requestAgent(app, BASE_URI) {

    const agentHandler = async(req, res) => {

        // set Headers
        res.setHeader('Content-type', 'application/ld+json');
        res.setHeader('Content-Dispositon', 'inline');

        try {
            const agentData = await fetchLDESRecordByAgentID(req.params.agentPID);
            if (!agentData) {
                return res.status(404).send('Agent not found');
            }

            return res.status(200).json(agentData["LDES_raw"]["object"])

        } catch (error) {
            console.error(error);
            return res.status(500).send('Error fetching agent data');
        }
    }

    app.get('/v1/id/agent/:agentPID', agentHandler)
    app.get('/v1/id/ark:/29417/agent/:agentPID', agentHandler)
}