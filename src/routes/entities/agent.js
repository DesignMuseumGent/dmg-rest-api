import {fetchLDESRecordByAgentID} from "../../utils/parsers.js";
import console from "node:console";

export function requestAgent(app, BASE_URI) {
    const agentHandler = async(req, res) => {
        try {
            const agentData = await fetchLDESRecordByAgentID(req.params.agentPID);
            if (!agentData) {
                return res.status(404).send('Agent not found');
            }

            return res.status(200).json(agentData)

        } catch (error) {
            console.error(error);
            return res.status(500).send('Internal server error');
        }
    }

    app.get('/v1/id/agent/:agentPID', agentHandler)
    app.get('/v1/id/ark:/29417/agent/:agentPID', agentHandler)
}